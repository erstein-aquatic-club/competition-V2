import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CoachAssignment } from "@/lib/api/types";

type SlotStatus = {
  slotKey: "AM" | "PM";
  expected: boolean;
  completed: boolean;
  absent: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function weekdayMondayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

function slotToSlotKey(slot: string | null): "AM" | "PM" {
  if (!slot) return "AM";
  const norm = slot.toLowerCase();
  if (norm === "evening" || norm.includes("soir") || norm === "pm") return "PM";
  return "AM";
}

export type DaySlot = {
  key: "swim-morning" | "swim-evening" | "strength";
  label: string;
  type: "swim" | "strength";
  scheduledSlot: "morning" | "evening" | null;
  assignment: CoachAssignment | null;
};

const DAY_SLOTS: Omit<DaySlot, "assignment">[] = [
  { key: "swim-morning", label: "Nage — Matin", type: "swim", scheduledSlot: "morning" },
  { key: "swim-evening", label: "Nage — Soir", type: "swim", scheduledSlot: "evening" },
  { key: "strength", label: "Musculation", type: "strength", scheduledSlot: null },
];

interface UseCoachCalendarStateProps {
  groupId?: number | null;
  userId?: number | null;
  enabled: boolean;
}

export function useCoachCalendarState({ groupId, userId, enabled }: UseCoachCalendarStateProps) {
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedISO, setSelectedISO] = useState(() => toISODate(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);

  // Grid: 6 weeks x 7 days = 42 cells
  const gridDates = useMemo(() => {
    const startIndex = weekdayMondayIndex(monthStart);
    const gridStart = addDays(monthStart, -startIndex);
    const dates: Date[] = [];
    for (let i = 0; i < 42; i++) dates.push(addDays(gridStart, i));
    return dates;
  }, [monthStart]);

  // Date range for the query (grid start -> grid end)
  const dateRange = useMemo(() => {
    const from = toISODate(gridDates[0]);
    const to = toISODate(gridDates[gridDates.length - 1]);
    return { from, to };
  }, [gridDates]);

  const hasFilter = Boolean(groupId || userId);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["coach-calendar-assignments", groupId, userId, dateRange.from, dateRange.to],
    queryFn: () =>
      api.getCoachAssignments({
        groupId: groupId ?? null,
        userId: userId ?? null,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: enabled && hasFilter,
  });

  // Index assignments by ISO date
  const assignmentsByISO = useMemo(() => {
    const map = new Map<string, CoachAssignment[]>();
    for (const a of assignments) {
      const iso = a.scheduledDate?.slice(0, 10);
      if (!iso) continue;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(a);
    }
    return map;
  }, [assignments]);

  // Build completionByISO — same shape as Dashboard for CalendarGrid compatibility
  const completionByISO = useMemo(() => {
    const map: Record<string, {
      completed: number;
      total: number;
      slots: SlotStatus[];
    }> = {};

    for (const d of gridDates) {
      const iso = toISODate(d);
      const dayAssignments = assignmentsByISO.get(iso) ?? [];

      const hasAM = dayAssignments.some((a) => slotToSlotKey(a.scheduledSlot) === "AM");
      const hasPM = dayAssignments.some((a) => slotToSlotKey(a.scheduledSlot) === "PM");
      const total = (hasAM ? 1 : 0) + (hasPM ? 1 : 0);

      // For the coach view: "completed" = pill is colored (has assignment)
      // We use completed === total so pills appear green/colored
      const slots: SlotStatus[] = [
        { slotKey: "AM", expected: hasAM, completed: hasAM, absent: false },
        { slotKey: "PM", expected: hasPM, completed: hasPM, absent: false },
      ];

      map[iso] = { completed: total, total, slots };
    }

    return map;
  }, [gridDates, assignmentsByISO]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedISO]);

  const assignmentsForSelectedDay = useMemo(
    () => assignmentsByISO.get(selectedISO) ?? [],
    [assignmentsByISO, selectedISO]
  );

  const slotsForSelectedDay = useMemo((): DaySlot[] => {
    const dayAssignments = assignmentsForSelectedDay;
    return DAY_SLOTS.map((slot) => {
      const matches = dayAssignments.filter((a) => {
        if (slot.type !== a.type) return false;
        if (slot.type === "swim") return slotToSlotKey(a.scheduledSlot) === (slot.scheduledSlot === "morning" ? "AM" : "PM");
        return true; // strength: any strength assignment matches
      });
      // Prefer user-level assignment over group-level (user override takes priority)
      const userMatch = matches.find((a) => a.targetType === "user");
      const groupMatch = matches.find((a) => a.targetType === "group");
      return { ...slot, assignment: userMatch ?? groupMatch ?? null };
    });
  }, [assignmentsForSelectedDay]);

  const hasStrengthByISO = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const d of gridDates) {
      const iso = toISODate(d);
      const dayAssignments = assignmentsByISO.get(iso) ?? [];
      map[iso] = dayAssignments.some((a) => a.type === "strength");
    }
    return map;
  }, [gridDates, assignmentsByISO]);

  const selectedDayStatus = completionByISO[selectedISO] ?? {
    completed: 0,
    total: 0,
    slots: [
      { slotKey: "AM" as const, expected: false, completed: false, absent: false },
      { slotKey: "PM" as const, expected: false, completed: false, absent: false },
    ],
  };

  const prevMonth = useCallback(() => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const jumpToday = useCallback(() => {
    setMonthCursor(startOfMonth(new Date()));
    setSelectedISO(toISODate(new Date()));
  }, []);

  const openDay = useCallback((iso: string) => {
    setSelectedISO(iso);
    setDrawerOpen(true);
  }, []);

  return {
    today,
    monthCursor,
    selectedISO,
    selectedDayIndex,
    drawerOpen,
    gridDates,
    completionByISO,
    selectedDate,
    selectedDayStatus,
    assignmentsForSelectedDay,
    slotsForSelectedDay,
    hasStrengthByISO,
    isLoading,
    hasFilter,
    setSelectedISO,
    setSelectedDayIndex,
    setDrawerOpen,
    prevMonth,
    nextMonth,
    jumpToday,
    openDay,
  };
}

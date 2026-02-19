import { useState } from "react";
import { CalendarHeader } from "@/components/dashboard/CalendarHeader";
import { CalendarGrid } from "@/components/dashboard/CalendarGrid";
import { useCoachCalendarState } from "@/hooks/useCoachCalendarState";
import CoachSectionHeader from "./CoachSectionHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CalendarPlus, Dumbbell, Waves } from "lucide-react";
import type { CoachAssignment } from "@/lib/api/types";

type FilterMode = "group" | "user";

interface CoachCalendarProps {
  onBack: () => void;
  onAssign: (prefillDate?: string) => void;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null }>;
  groups: Array<{ id: number | string; name: string }>;
}

function slotLabel(slot: string | null): string {
  if (!slot) return "—";
  const norm = slot.toLowerCase();
  if (norm === "morning" || norm.includes("mat") || norm === "am") return "Matin";
  if (norm === "evening" || norm.includes("soir") || norm === "pm") return "Soir";
  return slot;
}

function statusLabel(status: string): string {
  switch (status) {
    case "assigned": return "Assigné";
    case "in_progress": return "En cours";
    case "completed": return "Terminé";
    default: return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed": return "default";
    case "in_progress": return "secondary";
    default: return "outline";
  }
}

function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function CoachCalendar({ onBack, onAssign, athletes, groups }: CoachCalendarProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("group");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const groupId = filterMode === "group" && selectedGroupId ? Number(selectedGroupId) : null;
  const userId = filterMode === "user" && selectedUserId ? Number(selectedUserId) : null;

  const {
    today,
    monthCursor,
    selectedISO,
    selectedDayIndex,
    drawerOpen,
    gridDates,
    completionByISO,
    selectedDayStatus,
    assignmentsForSelectedDay,
    hasFilter,
    setSelectedISO,
    setSelectedDayIndex,
    setDrawerOpen,
    prevMonth,
    nextMonth,
    jumpToday,
    openDay,
  } = useCoachCalendarState({
    groupId,
    userId,
    enabled: true,
  });

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
    if (e.key === "ArrowRight") nextIndex = Math.min(gridDates.length - 1, index + 1);
    if (e.key === "ArrowUp") nextIndex = Math.max(0, index - 7);
    if (e.key === "ArrowDown") nextIndex = Math.min(gridDates.length - 1, index + 7);
    if (nextIndex !== index) {
      e.preventDefault();
      setSelectedDayIndex(nextIndex);
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const d = gridDates[nextIndex];
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      setSelectedISO(iso);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const d = gridDates[index];
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      openDay(iso);
    }
  };

  return (
    <div className="space-y-4">
      <CoachSectionHeader
        title="Calendrier"
        description="Vue mensuelle des assignations"
        onBack={onBack}
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          value={filterMode}
          onValueChange={(v) => {
            if (v === "group" || v === "user") setFilterMode(v);
          }}
          className="shrink-0"
        >
          <ToggleGroupItem value="group" className="text-xs px-3">Groupe</ToggleGroupItem>
          <ToggleGroupItem value="user" className="text-xs px-3">Nageur</ToggleGroupItem>
        </ToggleGroup>

        {filterMode === "group" ? (
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Choisir un groupe" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={String(g.id)} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Choisir un nageur" />
            </SelectTrigger>
            <SelectContent>
              {athletes
                .filter((a) => a.id != null)
                .map((a) => (
                  <SelectItem key={String(a.id)} value={String(a.id)}>
                    {a.display_name}
                    {a.group_label ? ` · ${a.group_label}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Calendar */}
      {!hasFilter ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Sélectionnez un groupe ou un nageur pour afficher le calendrier.
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-sm">
          <CalendarHeader
            monthCursor={monthCursor}
            selectedDayStatus={selectedDayStatus}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onJumpToday={jumpToday}
          />
          <CalendarGrid
            monthCursor={monthCursor}
            gridDates={gridDates}
            completionByISO={completionByISO}
            selectedISO={selectedISO}
            selectedDayIndex={selectedDayIndex}
            today={today}
            onDayClick={openDay}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      {/* Day detail drawer (Sheet) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-3">
            <SheetTitle className="capitalize text-left">
              {formatDateFR(selectedISO)}
              {assignmentsForSelectedDay.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({assignmentsForSelectedDay.length} assignation{assignmentsForSelectedDay.length !== 1 ? "s" : ""})
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Détail des assignations pour cette journée
            </SheetDescription>
          </SheetHeader>

          {assignmentsForSelectedDay.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune assignation ce jour.
            </p>
          ) : (
            <div className="space-y-2">
              {assignmentsForSelectedDay.map((a) => (
                <AssignmentCard key={a.id} assignment={a} />
              ))}
            </div>
          )}

          <div className="pt-4">
            <Button
              className="w-full"
              onClick={() => onAssign(selectedISO)}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Assigner une séance
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: CoachAssignment }) {
  const isSwim = assignment.type === "swim";
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <div className="mt-0.5">
        {isSwim ? (
          <Waves className="h-4 w-4 text-blue-500" />
        ) : (
          <Dumbbell className="h-4 w-4 text-orange-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{assignment.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {isSwim ? "Nage" : "Muscu"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {slotLabel(assignment.scheduledSlot)}
          </span>
          <Badge variant={statusVariant(assignment.status)} className="text-[10px] px-1.5 py-0">
            {statusLabel(assignment.status)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

import React, { memo } from "react";
import { Moon, Trophy } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toISODate(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type SlotStatus = { slotKey: "AM" | "PM"; expected: boolean; completed: boolean; absent: boolean };

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  status: { completed: number; total: number; slots: SlotStatus[] };
  strengthAssigned?: boolean;
  hasCompetition?: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export const DayCell = memo(function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  isFocused,
  status,
  strengthAssigned,
  hasCompetition,
  onClick,
  onKeyDown,
}: DayCellProps) {
  const { total, slots } = status;
  const isRest = total === 0;
  const expectedSlots = slots.filter((s) => s.expected);
  const allAbsent = expectedSlots.length > 0 && expectedSlots.every((s) => s.absent);
  const allDone = total > 0 && status.completed === total && !allAbsent;
  const bg = hasCompetition
    ? "bg-amber-50 dark:bg-amber-950/30"
    : isRest ? "bg-muted/30" : allDone ? "bg-status-success/10" : "bg-card";
  const border = hasCompetition ? "border-amber-200 dark:border-amber-900/40" : "border-border";

  const ring = isSelected ? "ring-2 ring-primary/30" : "";
  const todayRing = isToday && !isSelected ? "ring-2 ring-primary/50" : "";
  const focusRing = isFocused ? "ring-2 ring-primary" : "";

  const amSlot = slots.find((s) => s.slotKey === "AM");
  const pmSlot = slots.find((s) => s.slotKey === "PM");

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      data-calendar-cell="true"
      className={cn(
        "aspect-square min-w-0 rounded-2xl border p-1 transition",
        bg,
        border,
        !inMonth && "opacity-40",
        "hover:shadow-sm focus:outline-none",
        ring,
        todayRing,
        focusRing
      )}
      aria-label={`${toISODate(date)} — ${isRest ? "Repos" : `${status.completed}/${total}`}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="text-[12px] font-semibold text-foreground">{date.getDate()}</div>
          {hasCompetition ? (
            <Trophy className="h-3 w-3 text-amber-500" />
          ) : (
            <div className="h-[14px] w-[14px]" />
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          {isRest && !strengthAssigned ? (
            <Moon className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <>
              <div className="w-6">
                <div className="flex gap-1">
                  {amSlot?.expected ? (
                    <span className={cn("h-1.5 flex-1 rounded-full", amSlot.completed ? "bg-status-success" : amSlot.absent ? "bg-muted-foreground/15" : "bg-muted-foreground/30")} />
                  ) : (
                    <span className="flex-1" />
                  )}
                  {pmSlot?.expected ? (
                    <span className={cn("h-1.5 flex-1 rounded-full", pmSlot.completed ? "bg-status-success" : pmSlot.absent ? "bg-muted-foreground/15" : "bg-muted-foreground/30")} />
                  ) : (
                    <span className="flex-1" />
                  )}
                </div>
              </div>
              {strengthAssigned ? (
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
              ) : null}
            </>
          )}
        </div>
      </div>
    </button>
  );
});

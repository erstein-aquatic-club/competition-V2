import React, { memo } from "react";
import { Minus } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toISODate(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type SlotStatus = { slotKey: "AM" | "PM"; expected: boolean; completed: boolean };

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  status: { completed: number; total: number; slots: SlotStatus[] };
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
  onClick,
  onKeyDown,
}: DayCellProps) {
  const { total, slots } = status;
  const isRest = total === 0;

  const bg = isRest ? "bg-muted/30" : "bg-card";
  const border = "border-border";

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
          <div className="h-[14px] w-[14px]" />
        </div>

        <div className="flex items-center justify-end">
          {isRest ? (
            <Minus className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <div className="w-6">
              <div className="flex gap-1">
                {/* AM pill (left position) */}
                {amSlot?.expected ? (
                  <span className={cn("h-1.5 flex-1 rounded-full", amSlot.completed ? "bg-status-success" : "bg-muted-foreground/30")} />
                ) : (
                  <span className="flex-1" />
                )}
                {/* PM pill (right position) */}
                {pmSlot?.expected ? (
                  <span className={cn("h-1.5 flex-1 rounded-full", pmSlot.completed ? "bg-status-success" : "bg-muted-foreground/30")} />
                ) : (
                  <span className="flex-1" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

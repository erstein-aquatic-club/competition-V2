import React, { memo } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toISODate(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toneForDay({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return "rest";
  if (completed >= total) return "full";
  if (completed > 0) return "half";
  return "none";
}

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  status: { completed: number; total: number };
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
  const { completed, total } = status;
  const tone = toneForDay(status);

  const bg =
    tone === "full"
      ? "bg-primary"
      : tone === "half"
      ? "bg-primary/10"
      : tone === "none"
      ? "bg-muted"
      : "bg-muted/50";

  const border =
    tone === "full"
      ? "border-primary"
      : tone === "half"
      ? "border-primary/30"
      : tone === "none"
      ? "border-muted-foreground/20"
      : "border-border";

  const text = tone === "full" ? "text-primary-foreground" : "text-foreground";

  // micro-progress 2 segments (no overflow)
  const segOff = tone === "full" ? "bg-primary-foreground/25" : "bg-muted-foreground/30";
  const segOn = tone === "full" ? "bg-primary-foreground" : "bg-primary";

  const ring = isSelected
    ? tone === "full"
      ? "ring-2 ring-primary-foreground/50"
      : "ring-2 ring-primary/30"
    : "";

  // Aujourd'hui = contour accentué (sans texte)
  const todayRing = isToday
    ? tone === "full"
      ? "ring-2 ring-primary-foreground/40"
      : "ring-2 ring-primary/50"
    : "";

  // Keyboard focus ring
  const focusRing = isFocused ? "ring-2 ring-primary" : "";

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
      aria-label={`${toISODate(date)} — ${total === 0 ? "Repos" : `${completed}/${total}`}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className={cn("text-[12px] font-semibold", text)}>{date.getDate()}</div>
          <div className="h-[14px] w-[14px]" />
        </div>

        <div className="flex items-center justify-end">
          {total > 0 && (
            <div className="w-6">
              <div className="flex gap-1">
                <span className={cn("h-1.5 flex-1 rounded-full", completed >= 1 ? segOn : segOff)} />
                <span className={cn("h-1.5 flex-1 rounded-full", completed >= 2 ? segOn : segOff)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

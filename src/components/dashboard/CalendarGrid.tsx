import React from "react";
import { DayCell } from "./DayCell";

const WEEKDAYS_FR_SHORT = ["L", "M", "M", "J", "V", "S", "D"]; // mobile
const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]; // desktop

function toISODate(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface CalendarGridProps {
  monthCursor: Date;
  gridDates: Date[];
  completionByISO: Record<string, { completed: number; total: number }>;
  selectedISO: string;
  selectedDayIndex: number | null;
  today: Date;
  onDayClick: (iso: string) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
}

export function CalendarGrid({
  monthCursor,
  gridDates,
  completionByISO,
  selectedISO,
  selectedDayIndex,
  today,
  onDayClick,
  onKeyDown,
}: CalendarGridProps) {
  return (
    <div className="p-3 sm:p-5">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS_FR_SHORT.map((wd, idx) => (
          <div key={wd + idx} className="px-0.5 pb-1 text-[10px] font-semibold text-muted-foreground text-center">
            <span className="sm:hidden">{wd}</span>
            <span className="hidden sm:inline">{WEEKDAYS_FR[idx]}</span>
          </div>
        ))}

        {gridDates.map((d, index) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const isSel = iso === selectedISO;
          const status = completionByISO[iso] || { completed: 0, total: 2 };
          const isToday = isSameDay(d, today);
          const isFocused = selectedDayIndex === index || (selectedDayIndex === null && isToday);
          return (
            <DayCell
              key={iso}
              date={d}
              inMonth={inMonth}
              isToday={isToday}
              isSelected={isSel}
              isFocused={isFocused}
              status={status}
              onClick={() => onDayClick(iso)}
              onKeyDown={(e) => onKeyDown(e, index)}
            />
          );
        })}
      </div>
    </div>
  );
}

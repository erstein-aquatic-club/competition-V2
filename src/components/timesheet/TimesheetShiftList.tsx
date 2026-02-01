import React from "react";
import { format } from "date-fns";
import { formatMinutes, getShiftDurationMinutes, type TimesheetShift } from "@/pages/timesheetHelpers";

export type TimesheetShiftGroup = {
  date: string;
  totalMinutes: number;
  shifts: TimesheetShift[];
};

interface TimesheetShiftListProps {
  groups: TimesheetShiftGroup[];
  onEdit: (shift: TimesheetShift) => void;
  onDelete: (id: number) => void;
}

const formatShiftTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "HH:mm");
};

const formatShiftDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

export function TimesheetShiftList({ groups, onEdit, onDelete }: TimesheetShiftListProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
      {groups.length === 0 ? (
        <div className="px-4 py-4 text-sm text-slate-500">Aucun shift pour l’instant.</div>
      ) : (
        groups.map((group) => (
          <div key={group.date}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black capitalize text-slate-900">
              <span>{formatShiftDate(group.date)}</span>
              <span>{formatMinutes(group.totalMinutes)}</span>
            </div>
            <div>
              {group.shifts.map((shift) => {
                const duration = getShiftDurationMinutes(shift);
                const isOngoing = duration === null;
                return (
                  <div
                    key={shift.id}
                    className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-3 py-3"
                  >
                    <span
                      className={
                        shift.is_travel
                          ? "rounded-full border border-slate-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-slate-900"
                          : "rounded-full border border-slate-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-slate-900"
                      }
                    >
                      {shift.is_travel ? "Trajet" : "Travail"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-black text-slate-900">
                          {formatShiftTime(shift.start_time)} → {shift.end_time ? formatShiftTime(shift.end_time) : "En cours"}
                          {duration !== null ? (
                            <span className="ml-1 text-xs font-semibold text-slate-500">
                              ({formatMinutes(duration)})
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                            onClick={() => onEdit(shift)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                            onClick={() => onDelete(shift.id)}
                          >
                            Suppr.
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {shift.location || "Lieu non précisé"}
                      </div>
                      {isOngoing ? <div className="mt-1 text-xs text-slate-500">En cours</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

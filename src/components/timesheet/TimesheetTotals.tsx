import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatMinutes, type TimesheetTotals } from "@/pages/timesheetHelpers";

interface TimesheetTotalsProps {
  todayMinutes: number;
  weekTotals: TimesheetTotals;
  monthTotals: TimesheetTotals;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function TimesheetTotals({
  todayMinutes,
  weekTotals,
  monthTotals,
  expanded,
  onToggleExpanded,
}: TimesheetTotalsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Aujourd’hui</div>
          <div className="text-lg font-black text-slate-900">{formatMinutes(todayMinutes)}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={onToggleExpanded}
        >
          Totaux {expanded ? <ChevronUp className="ml-1 inline h-3.5 w-3.5" /> : <ChevronDown className="ml-1 inline h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="h-px bg-slate-200" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Semaine</div>
              <div className="text-sm font-black text-slate-900">
                Travail {formatMinutes(weekTotals.workMinutes)} · Trajet {formatMinutes(weekTotals.travelMinutes)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-sm font-black text-slate-900">{formatMinutes(weekTotals.totalMinutes)}</div>
            </div>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Mois</div>
              <div className="text-sm font-black text-slate-900">
                Travail {formatMinutes(monthTotals.workMinutes)} · Trajet {formatMinutes(monthTotals.travelMinutes)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-sm font-black text-slate-900">{formatMinutes(monthTotals.totalMinutes)}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

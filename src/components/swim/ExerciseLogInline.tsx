import { useState, useCallback } from "react";
import { ChevronUp, Activity, Timer, Hash, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSwimTime, parseSwimTime } from "@/lib/swimConsultationUtils";
import type { SwimSessionItem, SwimExerciseLogInput, SplitTimeEntry, StrokeCountEntry } from "@/lib/api/types";
import type { SwimPayloadFields } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect number of repetitions from a SwimSessionItem */
export function detectRepetitions(item: SwimSessionItem): number {
  const payload = (item.raw_payload ?? {}) as SwimPayloadFields;

  // 1. Explicit numeric field
  const explicit = Number(payload.exercise_repetitions);
  if (Number.isFinite(explicit) && explicit >= 1) return explicit;

  // 2. Parse from label: "6x50m", "6×50m", "6 x 50"
  const label = item.label ?? "";
  const match = label.match(/^(\d+)\s*[x×]/i);
  if (match) return parseInt(match[1], 10);

  return 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ExerciseLogInlineProps {
  item: SwimSessionItem;
  log: SwimExerciseLogInput;
  onChange: (log: SwimExerciseLogInput) => void;
  onCollapse: () => void;
}

export function ExerciseLogInline({ item, log, onChange, onCollapse }: ExerciseLogInlineProps) {
  const reps = detectRepetitions(item);

  // Pre-populate arrays to N entries
  const initSplits = (): SplitTimeEntry[] =>
    Array.from({ length: reps }, (_, i) => {
      const existing = log.split_times?.find((s) => s.rep === i + 1);
      return { rep: i + 1, time_seconds: existing?.time_seconds ?? 0 };
    });

  const initStrokes = (): StrokeCountEntry[] =>
    Array.from({ length: reps }, (_, i) => {
      const existing = log.stroke_count?.find((s) => s.rep === i + 1);
      return { rep: i + 1, count: existing?.count ?? 0 };
    });

  const [splits, setSplits] = useState<SplitTimeEntry[]>(initSplits);
  const [strokes, setStrokes] = useState<StrokeCountEntry[]>(initStrokes);
  // Local text state for time inputs (allows typing "1:23:45" freely)
  const [splitTexts, setSplitTexts] = useState<string[]>(() =>
    initSplits().map((s) => formatSwimTime(s.time_seconds)),
  );

  const emit = useCallback(
    (patch: Partial<SwimExerciseLogInput>) => {
      onChange({ ...log, ...patch });
    },
    [log, onChange],
  );

  // -- Field handlers --------------------------------------------------------

  const handleTempoChange = (value: string) => {
    const n = parseFloat(value);
    emit({ tempo: Number.isFinite(n) ? n : null });
  };

  const handleSplitTextChange = (index: number, text: string) => {
    setSplitTexts((prev) => prev.map((t, i) => (i === index ? text : t)));
  };

  const handleSplitBlur = (index: number) => {
    const parsed = parseSwimTime(splitTexts[index]);
    const formatted = formatSwimTime(parsed);
    setSplitTexts((prev) => prev.map((t, i) => (i === index ? formatted : t)));
    const next = splits.map((s, i) =>
      i === index ? { ...s, time_seconds: parsed } : s,
    );
    setSplits(next);
    emit({ split_times: next });
  };

  const handleStrokeChange = (index: number, value: string) => {
    const n = parseInt(value, 10);
    const next = strokes.map((s, i) =>
      i === index ? { ...s, count: Number.isFinite(n) ? n : 0 } : s,
    );
    setStrokes(next);
    emit({ stroke_count: next });
  };

  const handleNotesChange = (value: string) => {
    emit({ notes: value || null });
  };

  // -- Render ----------------------------------------------------------------

  return (
    <div className="border-t border-border/40 bg-muted/30 px-3 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Détails techniques</span>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="number"
              step={0.1}
              inputMode="decimal"
              placeholder="tempo"
              value={log.tempo ?? ""}
              onChange={(e) => handleTempoChange(e.target.value)}
              className={cn(
                "h-7 w-16 rounded-md border border-input bg-background px-1.5 text-xs text-center",
                "focus:outline-none focus:ring-1 focus:ring-ring",
              )}
            />
            <span className="text-[10px] text-muted-foreground">c/min</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="p-1 rounded-md hover:bg-muted"
          aria-label="Replier"
        >
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Table: Rep | Temps | Coups de bras */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1 pr-2 text-left font-medium w-10">Rep</th>
              <th className="py-1 px-1 text-center font-medium">
                <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />Temps</span>
              </th>
              <th className="py-1 pl-1 text-center font-medium">
                <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />Coups</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {splits.map((s, i) => (
              <tr key={s.rep} className="border-t border-border/30">
                <td className="py-1 pr-2 text-xs font-medium text-muted-foreground">{s.rep}</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ss:cc"
                    value={splitTexts[i] ?? ""}
                    onChange={(e) => handleSplitTextChange(i, e.target.value)}
                    onBlur={() => handleSplitBlur(i)}
                    className={cn(
                      "h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-center",
                      "focus:outline-none focus:ring-1 focus:ring-ring",
                    )}
                  />
                </td>
                <td className="py-1 pl-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="nb"
                    value={strokes[i]?.count || ""}
                    onChange={(e) => handleStrokeChange(i, e.target.value)}
                    className={cn(
                      "h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-center",
                      "focus:outline-none focus:ring-1 focus:ring-ring",
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Notes</span>
        </div>
        <textarea
          rows={2}
          placeholder="Notes libres..."
          value={log.notes ?? ""}
          onChange={(e) => handleNotesChange(e.target.value)}
          className={cn(
            "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm resize-none",
            "focus:outline-none focus:ring-1 focus:ring-ring",
          )}
        />
      </div>
    </div>
  );
}

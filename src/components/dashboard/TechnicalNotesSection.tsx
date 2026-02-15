import React, { useState } from "react";
import { ChevronRight, Plus, Trash2, Timer, Activity, Hash } from "lucide-react";
import type { SwimExerciseLogInput, SwimSessionItem } from "@/lib/api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface TechnicalNotesSectionProps {
  exerciseLogs: SwimExerciseLogInput[];
  assignmentItems?: SwimSessionItem[];
  disabled?: boolean;
  onLogsChange: (logs: SwimExerciseLogInput[]) => void;
}

export function TechnicalNotesSection({
  exerciseLogs,
  assignmentItems,
  disabled = false,
  onLogsChange,
}: TechnicalNotesSectionProps) {
  const [expanded, setExpanded] = useState(exerciseLogs.length > 0);
  const [customLabel, setCustomLabel] = useState("");

  const addFromAssignment = (item: SwimSessionItem) => {
    const label = item.label || `Exercice ${item.ordre ?? ""}`;
    // Avoid duplicates
    if (exerciseLogs.some((l) => l.source_item_id === item.id)) return;
    onLogsChange([
      ...exerciseLogs,
      {
        exercise_label: label,
        source_item_id: item.id ?? null,
        split_times: [],
        tempo: null,
        stroke_count: [],
        notes: null,
      },
    ]);
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    onLogsChange([
      ...exerciseLogs,
      {
        exercise_label: label,
        source_item_id: null,
        split_times: [],
        tempo: null,
        stroke_count: [],
        notes: null,
      },
    ]);
    setCustomLabel("");
  };

  const removeLog = (index: number) => {
    onLogsChange(exerciseLogs.filter((_, i) => i !== index));
  };

  const updateLog = (index: number, patch: Partial<SwimExerciseLogInput>) => {
    onLogsChange(exerciseLogs.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const items = Array.isArray(assignmentItems) ? assignmentItems : [];
  const availableItems = items.filter(
    (item) => item.id != null && !exerciseLogs.some((l) => l.source_item_id === item.id),
  );

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-semibold transition",
          disabled
            ? "text-muted-foreground border-border cursor-not-allowed"
            : "text-foreground border-border hover:bg-muted",
        )}
      >
        <span className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Notes techniques
          {exerciseLogs.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {exerciseLogs.length}
            </span>
          )}
        </span>
        <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && !disabled && (
        <div className="mt-2 space-y-3">
          {/* Exercise picker from assignment */}
          {availableItems.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Exercices de la seance</div>
              <div className="flex flex-wrap gap-1.5">
                {availableItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromAssignment(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
                  >
                    <Plus className="h-3 w-3" />
                    {item.label || `Ex. ${item.ordre ?? ""}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom exercise input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Exercice libre (ex: 4x50 max)"
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customLabel.trim()}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                !customLabel.trim()
                  ? "bg-muted text-muted-foreground border-border cursor-not-allowed"
                  : "bg-card text-foreground border-border hover:bg-muted",
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Exercise log entries */}
          {exerciseLogs.map((log, idx) => (
            <ExerciseLogEntry
              key={idx}
              log={log}
              onUpdate={(patch) => updateLog(idx, patch)}
              onRemove={() => removeLog(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ExerciseLogEntryProps {
  log: SwimExerciseLogInput;
  onUpdate: (patch: Partial<SwimExerciseLogInput>) => void;
  onRemove: () => void;
}

function ExerciseLogEntry({ log, onUpdate, onRemove }: ExerciseLogEntryProps) {
  const [showSplits, setShowSplits] = useState((log.split_times?.length ?? 0) > 0);
  const [showStrokes, setShowStrokes] = useState((log.stroke_count?.length ?? 0) > 0);

  const splits = log.split_times ?? [];
  const strokes = log.stroke_count ?? [];

  const addSplit = () => {
    onUpdate({ split_times: [...splits, { rep: splits.length + 1, time_seconds: 0 }] });
    setShowSplits(true);
  };

  const updateSplit = (i: number, time_seconds: number) => {
    onUpdate({
      split_times: splits.map((s, j) => (j === i ? { ...s, time_seconds } : s)),
    });
  };

  const removeSplit = (i: number) => {
    const updated = splits.filter((_, j) => j !== i).map((s, j) => ({ ...s, rep: j + 1 }));
    onUpdate({ split_times: updated });
    if (updated.length === 0) setShowSplits(false);
  };

  const addStroke = () => {
    onUpdate({ stroke_count: [...strokes, { rep: strokes.length + 1, count: 0 }] });
    setShowStrokes(true);
  };

  const updateStroke = (i: number, count: number) => {
    onUpdate({
      stroke_count: strokes.map((s, j) => (j === i ? { ...s, count } : s)),
    });
  };

  const removeStroke = (i: number) => {
    const updated = strokes.filter((_, j) => j !== i).map((s, j) => ({ ...s, rep: j + 1 }));
    onUpdate({ stroke_count: updated });
    if (updated.length === 0) setShowStrokes(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-sm font-semibold text-foreground truncate">{log.exercise_label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
          aria-label="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Tempo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground min-w-[80px]">
            <Activity className="h-3.5 w-3.5" />
            Tempo
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={log.tempo ?? ""}
            onChange={(e) => onUpdate({ tempo: e.target.value ? Number(e.target.value) : null })}
            placeholder="coups/min"
            className="w-24 rounded-xl border border-border bg-background px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>

        {/* Split times */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              Temps
            </div>
            <button
              type="button"
              onClick={addSplit}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition"
            >
              <Plus className="h-3 w-3" />
              Rep
            </button>
          </div>
          {showSplits && splits.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-4 text-right">{s.rep}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    value={s.time_seconds || ""}
                    onChange={(e) => updateSplit(i, Number(e.target.value) || 0)}
                    placeholder="sec"
                    className="w-16 rounded-lg border border-border bg-background px-1.5 py-1 text-xs text-center outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeSplit(i)}
                    className="p-0.5 text-muted-foreground hover:text-destructive transition"
                    aria-label={`Supprimer rep ${s.rep}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stroke count */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Coups de bras
            </div>
            <button
              type="button"
              onClick={addStroke}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition"
            >
              <Plus className="h-3 w-3" />
              Rep
            </button>
          </div>
          {showStrokes && strokes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {strokes.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-4 text-right">{s.rep}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={s.count || ""}
                    onChange={(e) => updateStroke(i, Number(e.target.value) || 0)}
                    placeholder="nb"
                    className="w-14 rounded-lg border border-border bg-background px-1.5 py-1 text-xs text-center outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeStroke(i)}
                    className="p-0.5 text-muted-foreground hover:text-destructive transition"
                    aria-label={`Supprimer rep ${s.rep}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Free notes */}
        <div>
          <textarea
            value={log.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value || null })}
            placeholder="Notes libres..."
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
      </div>
    </div>
  );
}

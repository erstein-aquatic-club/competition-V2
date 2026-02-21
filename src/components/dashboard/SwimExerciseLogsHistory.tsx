import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SwimExerciseLog, SwimExerciseLogInput } from "@/lib/api";
import { Timer, Activity, Hash, FileText, ChevronRight, Pencil, Check, X, Trash2, Plus } from "lucide-react";
import { formatSwimTime, parseSwimTime } from "@/lib/swimConsultationUtils";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

interface SwimExerciseLogsHistoryProps {
  userId: string;
  expanded: boolean;
  onToggle: () => void;
}

export function SwimExerciseLogsHistory({ userId, expanded, onToggle }: SwimExerciseLogsHistoryProps) {
  const queryClient = useQueryClient();
  const { data: logs, isLoading } = useQuery({
    queryKey: ["swim-exercise-logs-history", userId],
    queryFn: () => api.getSwimExerciseLogsHistory(userId, 100),
    enabled: !!userId && expanded,
  });

  const updateMutation = useMutation({
    mutationFn: ({ logId, patch }: { logId: string; patch: Partial<SwimExerciseLogInput> }) =>
      api.updateSwimExerciseLog(logId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swim-exercise-logs-history", userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (logId: string) => api.deleteSwimExerciseLog(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swim-exercise-logs-history", userId] });
    },
  });

  // Group logs by date
  const groupedByDate = React.useMemo(() => {
    if (!logs?.length) return [];
    const map = new Map<string, SwimExerciseLog[]>();
    for (const log of logs) {
      const date = (log.created_at ?? "").slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(log);
    }
    return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }));
  }, [logs]);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-2xl border border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Historique notes techniques
        </span>
        <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {isLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">Chargement...</div>
          )}

          {!isLoading && groupedByDate.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Aucune note technique enregistree.
            </div>
          )}

          {groupedByDate.map(({ date, entries }) => (
            <div key={date} className="rounded-2xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                {formatDate(date)}
              </div>
              <div className="divide-y divide-border">
                {entries.map((log) => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    onSave={(patch) => updateMutation.mutate({ logId: log.id, patch })}
                    onDelete={() => deleteMutation.mutate(log.id)}
                    saving={updateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LogEntryProps {
  log: SwimExerciseLog;
  onSave: (patch: Partial<SwimExerciseLogInput>) => void;
  onDelete: () => void;
  saving: boolean;
}

function LogEntry({ log, onSave, onDelete, saving }: LogEntryProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    notes: log.notes ?? "",
    tempo: log.tempo,
    split_times: log.split_times,
    stroke_count: log.stroke_count,
  });
  const [splitTexts, setSplitTexts] = useState<string[]>([]);

  const startEdit = () => {
    setDraft({
      notes: log.notes ?? "",
      tempo: log.tempo,
      split_times: [...log.split_times],
      stroke_count: [...log.stroke_count],
    });
    setSplitTexts(log.split_times.map((s) => formatSwimTime(s.time_seconds)));
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = () => {
    onSave({
      notes: draft.notes.trim() || null,
      tempo: draft.tempo,
      split_times: draft.split_times,
      stroke_count: draft.stroke_count,
    });
    setEditing(false);
  };

  const addSplit = () => {
    setDraft((d) => ({
      ...d,
      split_times: [...d.split_times, { rep: d.split_times.length + 1, time_seconds: 0 }],
    }));
    setSplitTexts((prev) => [...prev, ""]);
  };

  const handleSplitTextChange = (i: number, text: string) => {
    setSplitTexts((prev) => prev.map((t, j) => (j === i ? text : t)));
  };

  const handleSplitBlur = (i: number) => {
    const parsed = parseSwimTime(splitTexts[i]);
    const formatted = formatSwimTime(parsed);
    setSplitTexts((prev) => prev.map((t, j) => (j === i ? formatted : t)));
    setDraft((d) => ({
      ...d,
      split_times: d.split_times.map((s, j) => (j === i ? { ...s, time_seconds: parsed } : s)),
    }));
  };

  const removeSplit = (i: number) => {
    setDraft((d) => ({
      ...d,
      split_times: d.split_times.filter((_, j) => j !== i).map((s, j) => ({ ...s, rep: j + 1 })),
    }));
    setSplitTexts((prev) => prev.filter((_, j) => j !== i));
  };

  const addStroke = () => {
    setDraft((d) => ({
      ...d,
      stroke_count: [...d.stroke_count, { rep: d.stroke_count.length + 1, count: 0 }],
    }));
  };

  const updateStroke = (i: number, count: number) => {
    setDraft((d) => ({
      ...d,
      stroke_count: d.stroke_count.map((s, j) => (j === i ? { ...s, count } : s)),
    }));
  };

  const removeStroke = (i: number) => {
    setDraft((d) => ({
      ...d,
      stroke_count: d.stroke_count.filter((_, j) => j !== i).map((s, j) => ({ ...s, rep: j + 1 })),
    }));
  };

  if (editing) {
    return (
      <div className="px-3 py-2.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{log.exercise_label}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition"
              aria-label="Enregistrer"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={cancel}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

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
            value={draft.tempo ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, tempo: e.target.value ? Number(e.target.value) : null }))}
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
          {draft.split_times.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {draft.split_times.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-4 text-right">{s.rep}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={splitTexts[i] ?? ""}
                    onChange={(e) => handleSplitTextChange(i, e.target.value)}
                    onBlur={() => handleSplitBlur(i)}
                    placeholder="ss:cc"
                    className="w-16 rounded-lg border border-border bg-background px-1.5 py-1 text-xs text-center outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeSplit(i)}
                    className="p-0.5 text-muted-foreground hover:text-destructive transition"
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
          {draft.stroke_count.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {draft.stroke_count.map((s, i) => (
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
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Notes libres..."
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
        />
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 space-y-1.5 group">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">{log.exercise_label}</div>
        <button
          type="button"
          onClick={startEdit}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
          aria-label="Modifier"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {log.tempo != null && (
          <span className="inline-flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {log.tempo} c/min
          </span>
        )}

        {log.split_times.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {log.split_times.map((s) => formatSwimTime(s.time_seconds) || "\u2014").join(" / ")}
          </span>
        )}

        {log.stroke_count.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {log.stroke_count.map((s) => s.count).join(" / ")} cps
          </span>
        )}
      </div>

      {log.notes && (
        <div className="text-xs text-foreground/70 italic">{log.notes}</div>
      )}
    </div>
  );
}

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SwimExerciseLog } from "@/lib/api";
import { Timer, Activity, Hash, FileText, ChevronRight } from "lucide-react";

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

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
}

interface SwimExerciseLogsHistoryProps {
  userId: string;
  expanded: boolean;
  onToggle: () => void;
}

export function SwimExerciseLogsHistory({ userId, expanded, onToggle }: SwimExerciseLogsHistoryProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["swim-exercise-logs-history", userId],
    queryFn: () => api.getSwimExerciseLogsHistory(userId, 100),
    enabled: !!userId && expanded,
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
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: SwimExerciseLog }) {
  return (
    <div className="px-3 py-2.5 space-y-1.5">
      <div className="text-sm font-semibold text-foreground">{log.exercise_label}</div>

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
            {log.split_times.map((s) => formatTime(s.time_seconds)).join(" / ")}
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

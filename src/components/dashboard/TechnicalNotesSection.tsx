import { ChevronRight, Timer, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import type { SwimExerciseLogInput } from "@/lib/api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface TechnicalNotesSectionProps {
  exerciseLogs: SwimExerciseLogInput[];
  assignmentId?: number;
  disabled?: boolean;
  onLogsChange: (logs: SwimExerciseLogInput[]) => void;
}

export function TechnicalNotesSection({
  exerciseLogs,
  assignmentId,
  disabled = false,
}: TechnicalNotesSectionProps) {
  const [, setLocation] = useLocation();
  const filledCount = exerciseLogs.filter((l) => {
    const hasSplits = (l.split_times ?? []).some((s) => s.time_seconds > 0);
    const hasStrokes = (l.stroke_count ?? []).some((s) => s.count > 0);
    return hasSplits || hasStrokes || l.tempo != null || l.notes?.trim();
  }).length;

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled || !assignmentId}
        onClick={() => {
          if (assignmentId) setLocation(`/swim-session?assignmentId=${assignmentId}`);
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-semibold transition",
          disabled || !assignmentId
            ? "text-muted-foreground border-border cursor-not-allowed"
            : "text-foreground border-border hover:bg-muted",
        )}
      >
        <span className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Notes techniques
          {filledCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-3 w-3" />
              {filledCount}
            </span>
          )}
        </span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

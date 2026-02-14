import React from "react";
import { ChevronRight } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type StrokeDraft = { NL: string; DOS: string; BR: string; PAP: string; QN: string };

const STROKE_LABELS: Record<keyof StrokeDraft, string> = {
  NL: "NL",
  DOS: "Dos",
  BR: "Brasse",
  PAP: "Pap",
  QN: "4N",
};

interface StrokeDetailFormProps {
  strokes: StrokeDraft;
  showStrokeDetail: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onChange: (strokes: StrokeDraft) => void;
}

export function StrokeDetailForm({ strokes, showStrokeDetail, disabled = false, onToggle, onChange }: StrokeDetailFormProps) {
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-semibold transition",
          disabled ? "text-muted-foreground border-border cursor-not-allowed" : "text-foreground border-border hover:bg-muted"
        )}
      >
        <span>Détail par nage</span>
        <ChevronRight className={cn("h-4 w-4 transition-transform", showStrokeDetail && "rotate-90")} />
      </button>
      {showStrokeDetail && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {(Object.keys(STROKE_LABELS) as (keyof StrokeDraft)[]).map((key) => (
            <div key={key} className="space-y-1">
              <label className="block text-center text-xs font-medium text-muted-foreground">{STROKE_LABELS[key]}</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                disabled={disabled}
                value={strokes[key]}
                onChange={(e) =>
                  onChange({
                    ...strokes,
                    [key]: e.target.value,
                  })
                }
                placeholder="0"
                className={cn(
                  "w-full rounded-xl border px-1 py-2 text-center text-sm outline-none",
                  disabled ? "bg-muted text-muted-foreground" : "bg-card text-foreground border-border focus:ring-2 focus:ring-foreground/10"
                )}
              />
              <div className="text-center text-[10px] text-muted-foreground">m</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

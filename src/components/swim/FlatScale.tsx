import { scoreToColor } from "@/lib/score";
import { cn } from "@/lib/utils";

type ScaleTone = "hard" | "good" | "fatigue";

const paletteMap: Record<ScaleTone, string[]> = {
  hard: [
    "bg-muted border-border",
    "bg-yellow-100 border-yellow-300 text-yellow-900",
    "bg-orange-200 border-orange-300 text-orange-900",
    "bg-red-300 border-red-400 text-red-900",
    "bg-red-600 border-red-700 text-white",
  ],
  good: [
    "bg-muted border-border",
    "bg-emerald-100 border-emerald-300 text-emerald-900",
    "bg-emerald-200 border-emerald-300 text-emerald-900",
    "bg-emerald-300 border-emerald-400 text-emerald-900",
    "bg-emerald-600 border-emerald-700 text-white",
  ],
  fatigue: [
    "bg-sky-100 border-sky-300 text-sky-900",
    "bg-emerald-100 border-emerald-300 text-emerald-900",
    "bg-yellow-100 border-yellow-300 text-yellow-900",
    "bg-orange-200 border-orange-300 text-orange-900",
    "bg-red-600 border-red-700 text-white",
  ],
};

type FlatScaleProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tone: ScaleTone;
  useScoreColor?: boolean;
};

export function FlatScale({ label, value, onChange, tone, useScoreColor = false }: FlatScaleProps) {
  const palette = paletteMap[tone];

  return (
    <div className="space-y-2">
      <div className="text-sm font-bold text-foreground">{label}</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score === value;
          const scoreColor = useScoreColor ? scoreToColor(score) : null;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={cn(
                "flex-1 h-10 rounded-xl border text-sm font-black transition active:scale-[0.99]",
                active
                  ? useScoreColor
                    ? "text-white"
                    : palette[score - 1]
                  : "bg-background border-border text-foreground"
              )}
              style={
                active && useScoreColor
                  ? { backgroundColor: scoreColor ?? undefined, borderColor: scoreColor ?? undefined }
                  : undefined
              }
              aria-pressed={active}
              aria-label={`${label} ${score}/5`}
              title={`${label} ${score}/5`}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}

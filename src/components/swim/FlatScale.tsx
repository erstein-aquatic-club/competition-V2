import { scoreToColor } from "@/lib/score";
import { cn } from "@/lib/utils";

type ScaleTone = "hard" | "good" | "fatigue";

const paletteMap: Record<ScaleTone, string[]> = {
  hard: [
    "bg-muted border-border",
    "bg-intensity-3-bg border-intensity-3 text-foreground",
    "bg-intensity-4-bg border-intensity-4 text-foreground",
    "bg-intensity-5-bg border-intensity-5 text-foreground",
    "bg-intensity-5 border-intensity-5 text-white",
  ],
  good: [
    "bg-muted border-border",
    "bg-intensity-1-bg border-intensity-1 text-foreground",
    "bg-intensity-1-bg border-intensity-1 text-foreground",
    "bg-intensity-1-bg border-intensity-1 text-foreground",
    "bg-intensity-1 border-intensity-1 text-white",
  ],
  fatigue: [
    "bg-sky-100 border-sky-300 text-sky-900",
    "bg-intensity-1-bg border-intensity-1 text-foreground",
    "bg-intensity-3-bg border-intensity-3 text-foreground",
    "bg-intensity-4-bg border-intensity-4 text-foreground",
    "bg-intensity-5 border-intensity-5 text-white",
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
                "flex-1 h-11 rounded-xl border text-sm font-black transition active:scale-[0.99] cursor-pointer",
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

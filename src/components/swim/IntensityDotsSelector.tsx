import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

const intensityScale = ["V0", "V1", "V2", "V3", "Max", "Prog"] as const;

const intensityTone: Record<string, string> = {
  V0: "bg-intensity-1",
  V1: "bg-intensity-2",
  V2: "bg-intensity-3",
  V3: "bg-intensity-4",
  Max: "bg-intensity-5",
  Prog: "bg-intensity-prog",
};

const legacyIntensityMap: Record<string, (typeof intensityScale)[number]> = {
  souple: "V0",
  facile: "V0",
  relache: "V0",
  "relâché": "V0",
};

const normalizeIntensityValue = (value?: string | null) => {
  if (!value) return "V0";
  const trimmed = value.trim();
  if (!trimmed) return "V0";
  const lower = trimmed.toLowerCase();
  if (legacyIntensityMap[lower]) {
    return legacyIntensityMap[lower];
  }
  if (lower === "prog" || lower === "progressif") return "Prog";
  const upper = trimmed.toUpperCase();
  if (upper === "MAX") return "Max";
  if (upper.startsWith("V")) {
    const level = upper.replace("V", "V");
    if (level === "V4" || level === "V5") {
      return "Max";
    }
    return level;
  }
  return trimmed;
};

type IntensityDotsSelectorProps = {
  value?: string | null;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
};

export function IntensityDotsSelector({
  value,
  onChange,
  className,
  ariaLabel = "Sélection d'intensité",
}: IntensityDotsSelectorProps) {
  const normalizedValue = normalizeIntensityValue(value);
  const normalized = intensityScale.includes(normalizedValue as (typeof intensityScale)[number])
    ? (normalizedValue as (typeof intensityScale)[number])
    : "Max";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {intensityScale.map((level) => {
        const isSelected = normalized === level;
        const label = level === "Max" ? "MAX" : level === "Prog" ? "Prog" : level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Intensité ${label}`}
            onClick={() => onChange(level)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-muted-foreground transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isSelected ? "text-foreground" : "hover:text-foreground",
            )}
          >
            {level === "Prog" ? (
              <TrendingUp
                className={cn(
                  "h-3 w-3",
                  isSelected ? "text-intensity-prog" : "text-muted-foreground",
                )}
              />
            ) : (
              <span
                className={cn(
                  "h-3 w-3 rounded-full",
                  isSelected ? intensityTone[level] ?? "bg-primary" : "bg-muted",
                )}
              />
            )}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

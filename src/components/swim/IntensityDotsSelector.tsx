import { cn } from "@/lib/utils";

const intensityScale = ["V0", "V1", "V2", "V3", "Max"] as const;

const intensityTone: Record<string, string> = {
  V0: "bg-emerald-500",
  V1: "bg-green-500",
  V2: "bg-yellow-500",
  V3: "bg-orange-500",
  Max: "bg-red-600",
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
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {intensityScale.map((level) => {
        const isSelected = normalized === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Intensité ${level === "Max" ? "MAX" : level}`}
            onClick={() => onChange(level)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-muted-foreground transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isSelected ? "text-foreground" : "hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "h-3 w-3 rounded-full",
                isSelected ? intensityTone[level] ?? "bg-primary" : "bg-slate-200",
              )}
            />
            <span>{level === "Max" ? "MAX" : level}</span>
          </button>
        );
      })}
    </div>
  );
}

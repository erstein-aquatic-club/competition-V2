import { cn } from "@/lib/utils";

export const intensityScale = ["V0", "V1", "V2", "V3", "Max", "Prog"] as const;

export const intensityTone: Record<string, string> = {
  V0: "bg-intensity-1",
  V1: "bg-intensity-2",
  V2: "bg-intensity-3",
  V3: "bg-intensity-4",
  Max: "bg-intensity-5",
  Prog: "bg-intensity-prog",
};

export const formatIntensityLabel = (value: string) => {
  if (value === "Max") return "MAX";
  if (value === "Prog") return "Prog ↗";
  return value;
};

type IntensityDotsProps = {
  value: string;
  className?: string;
  size?: "sm" | "md";
};

const dotScale = ["V0", "V1", "V2", "V3", "Max"] as const;

export function IntensityDots({ value, className, size = "md" }: IntensityDotsProps) {
  const normalized = intensityScale.includes(value as (typeof intensityScale)[number])
    ? (value as (typeof intensityScale)[number])
    : "Max";
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  if (normalized === "Prog") {
    return (
      <div className={cn("flex items-center gap-1.5", className)} role="img" aria-label="Intensité Progressive">
        <span className={cn(dotSize, "rounded-full bg-intensity-prog")} />
        <span className={cn("font-semibold text-intensity-prog", size === "sm" ? "text-xs" : "text-sm")}>
          {formatIntensityLabel("Prog")}
        </span>
      </div>
    );
  }

  const filled = dotScale.indexOf(normalized as (typeof dotScale)[number]) + 1;

  return (
    <div className={cn("flex items-center gap-1.5", className)} role="img" aria-label={`Intensité ${formatIntensityLabel(normalized)}`}>
      <div className="flex items-center gap-1">
        {dotScale.map((level, index) => (
          <span
            key={level}
            className={cn(
              dotSize,
              "rounded-full",
              index < filled ? intensityTone[level] ?? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <span className={cn("font-semibold text-foreground", size === "sm" ? "text-xs" : "text-sm")}>
        {formatIntensityLabel(normalized)}
      </span>
    </div>
  );
}

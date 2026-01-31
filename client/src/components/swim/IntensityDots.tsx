import { cn } from "@/lib/utils";

export const intensityScale = ["V0", "V1", "V2", "V3", "Max"] as const;

export const intensityTone: Record<string, string> = {
  V0: "bg-emerald-500",
  V1: "bg-green-500",
  V2: "bg-yellow-500",
  V3: "bg-orange-500",
  Max: "bg-red-600",
};

export const formatIntensityLabel = (value: string) => (value === "Max" ? "MAX" : value);

type IntensityDotsProps = {
  value: string;
  className?: string;
  size?: "sm" | "md";
};

export function IntensityDots({ value, className, size = "md" }: IntensityDotsProps) {
  const normalized = intensityScale.includes(value as (typeof intensityScale)[number])
    ? (value as (typeof intensityScale)[number])
    : intensityScale[intensityScale.length - 1];
  const filled = intensityScale.indexOf(normalized) + 1;
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={`Intensité ${formatIntensityLabel(normalized)}`}>
      {intensityScale.map((level, index) => (
        <span
          key={level}
          className={cn(
            dotSize,
            "rounded-full",
            index < filled ? intensityTone[level] ?? "bg-primary" : "bg-slate-200",
          )}
        />
      ))}
    </div>
  );
}

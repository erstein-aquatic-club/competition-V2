import React from "react";
import { Badge } from "@/components/ui/badge";
import { scoreToColor } from "@/lib/score";
import { getContrastTextColor } from "@/lib/design-tokens";

const kpiBadgeClass = "rounded-full px-3 py-1 text-lg font-mono font-bold md:text-xl";

type HallOfFameValueProps = {
  value: string;
  toneScore: number | null;
};

export function HallOfFameValue({ value, toneScore }: HallOfFameValueProps) {
  const color = scoreToColor(toneScore ?? null) ?? "hsl(var(--muted-foreground))";

  return (
    <Badge
      className={kpiBadgeClass}
      style={{
        backgroundColor: color,
        color: getContrastTextColor(color),
      }}
    >
      {value}
    </Badge>
  );
}

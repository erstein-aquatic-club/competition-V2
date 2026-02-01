import React from "react";
import { Badge } from "@/components/ui/badge";
import { scoreToColor } from "@/lib/score";

const kpiBadgeClass = "rounded-full px-3 py-1 text-lg font-mono font-bold md:text-xl";

const getContrastTextColor = (color: string) => {
  const match = color.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) {
    return "#000";
  }
  const [, hRaw, sRaw, lRaw] = match;
  const h = Number(hRaw);
  const s = Number(sRaw) / 100;
  const l = Number(lRaw) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
  } else if (h >= 120 && h < 180) {
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 155 ? "#000" : "#fff";
};

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

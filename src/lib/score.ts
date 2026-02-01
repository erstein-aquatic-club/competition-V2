export type ScoreTone = {
  low: string;
  mid: string;
  high: string;
  empty?: string;
};

const defaultScoreTone: ScoreTone = {
  low: "hsl(0 84% 60%)",
  mid: "hsl(48 96% 53%)",
  high: "hsl(142 70% 45%)",
  empty: "hsl(var(--muted-foreground))",
};

export type ScoreColorOptions = {
  invert?: boolean;
  tone?: ScoreTone;
};

export function scoreToColor(
  value: number | null | undefined,
  { invert = false, tone = defaultScoreTone }: ScoreColorOptions = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return tone.empty ?? defaultScoreTone.empty;
  }

  const lowColor = invert ? tone.high : tone.low;
  const highColor = invert ? tone.low : tone.high;

  if (value >= 4) {
    return highColor;
  }
  if (value >= 3) {
    return tone.mid;
  }
  return lowColor;
}

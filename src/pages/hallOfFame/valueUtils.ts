export type ValueRange = {
  min: number;
  max: number;
};

export const normalizeHallOfFameScore = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num <= 5) return Math.min(5, num);
  return Math.min(5, num / 2);
};

export const getValueRange = (values: Array<number | null | undefined>): ValueRange | null => {
  const finiteValues = values.filter((value): value is number => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return {
    min: Math.min(...finiteValues),
    max: Math.max(...finiteValues),
  };
};

export const toRelativeScore = (value: number | null | undefined, range: ValueRange | null) => {
  if (!Number.isFinite(value) || value === null || value === undefined || value <= 0) {
    return null;
  }
  if (!range) return null;
  if (range.max <= 0) return null;
  if (range.max === range.min) return 5;
  const ratio = (value - range.min) / (range.max - range.min);
  const score = 1 + ratio * 4;
  return Math.max(1, Math.min(5, score));
};

export const formatHallOfFameValue = (
  value: number | null | undefined,
  options?: { decimals?: number; suffix?: string },
) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  const { decimals = 0, suffix } = options ?? {};
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (!suffix) return formatted;
  return `${formatted} ${suffix}`;
};

import type { SwimSessionItem } from "@/lib/api";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateSwimTotalDistance = (items: SwimSessionItem[] = []) =>
  items.reduce((total, item) => {
    const payload = (item.raw_payload as Record<string, unknown>) ?? {};
    const blockRepetitions = toNumber(payload.block_repetitions);
    const exerciseRepetitions = toNumber(payload.exercise_repetitions);
    const distance = toNumber(item.distance);
    return total + blockRepetitions * exerciseRepetitions * distance;
  }, 0);

export const splitModalitiesLines = (value?: string | null) =>
  value
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

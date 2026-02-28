import type { NeurotypCode, NeurotypScores, NeurotypResult } from "./api/types";
import { NEUROTYPE_QUESTIONS } from "./neurotype-quiz-data";

// Fixed max points per category (from scoring document)
const MAX_POINTS: Record<NeurotypCode, number> = {
  "1A": 490,
  "1B": 680,
  "2A": 845,
  "2B": 680,
  "3": 700,
};

/**
 * Calculate neurotype scores from user answers using weighted scoring.
 * Each option carries a weight applied to all its listed categories.
 * @param answers - Map of questionId -> selected option index (0-based)
 */
export function calculateNeurotypScores(
  answers: Record<number, number>
): NeurotypResult {
  const codes: NeurotypCode[] = ["1A", "1B", "2A", "2B", "3"];
  const points: Record<NeurotypCode, number> = { "1A": 0, "1B": 0, "2A": 0, "2B": 0, "3": 0 };

  for (const q of NEUROTYPE_QUESTIONS) {
    const selectedIdx = answers[q.id];
    if (selectedIdx !== undefined && q.options[selectedIdx]) {
      const opt = q.options[selectedIdx];
      for (const code of opt.scores) {
        points[code] += opt.weight;
      }
    }
  }

  // Calculate percentages against fixed max points
  const scores = {} as NeurotypScores;
  for (const code of codes) {
    scores[code] = Math.round((points[code] / MAX_POINTS[code]) * 100);
  }

  // Find dominant
  const dominant = codes.reduce((best, code) =>
    scores[code] > scores[best] ? code : best
  );

  return {
    dominant,
    scores,
    takenAt: new Date().toISOString(),
  };
}

/** Get the level label for a percentage */
export function getNeurotypLevel(pct: number): "match" | "potential" | "unsuited" {
  if (pct >= 71) return "match";
  if (pct >= 49) return "potential";
  return "unsuited";
}

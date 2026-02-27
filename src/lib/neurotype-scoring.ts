import type { NeurotypCode, NeurotypScores, NeurotypResult } from "./api/types";
import { NEUROTYPE_QUESTIONS } from "./neurotype-quiz-data";

/**
 * Calculate neurotype scores from user answers.
 * @param answers - Map of questionId -> selected option index (0-based)
 */
export function calculateNeurotypScores(
  answers: Record<number, number>
): NeurotypResult {
  const codes: NeurotypCode[] = ["1A", "1B", "2A", "2B", "3"];
  const points: Record<NeurotypCode, number> = { "1A": 0, "1B": 0, "2A": 0, "2B": 0, "3": 0 };
  const maxPoints: Record<NeurotypCode, number> = { "1A": 0, "1B": 0, "2A": 0, "2B": 0, "3": 0 };

  for (const q of NEUROTYPE_QUESTIONS) {
    // Count max possible points for this question (union of all option scores)
    const allCodes = new Set<NeurotypCode>();
    for (const opt of q.options) {
      for (const code of opt.scores) allCodes.add(code);
    }
    for (const code of allCodes) maxPoints[code]++;

    // Add points for selected answer
    const selectedIdx = answers[q.id];
    if (selectedIdx !== undefined && q.options[selectedIdx]) {
      for (const code of q.options[selectedIdx].scores) {
        points[code]++;
      }
    }
  }

  // Calculate percentages
  const scores = {} as NeurotypScores;
  for (const code of codes) {
    scores[code] = maxPoints[code] > 0
      ? Math.round((points[code] / maxPoints[code]) * 100)
      : 0;
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

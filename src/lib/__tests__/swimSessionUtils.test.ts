import assert from "node:assert/strict";
import { test } from "node:test";
import type { SwimSessionItem } from "@/lib/api";
import { calculateSwimTotalDistance, splitModalitiesLines } from "@/lib/swimSessionUtils";

test("calculateSwimTotalDistance multiplies block, exercise, and distance", () => {
  const items: SwimSessionItem[] = [
    {
      distance: 50,
      raw_payload: {
        block_repetitions: 3,
        exercise_repetitions: 4,
      },
    },
  ];

  assert.equal(calculateSwimTotalDistance(items), 600);
});

test("splitModalitiesLines trims and removes empty entries", () => {
  const lines = splitModalitiesLines("  Respiration \n\n  Récup active \n");
  assert.deepEqual(lines, ["Respiration", "Récup active"]);
});

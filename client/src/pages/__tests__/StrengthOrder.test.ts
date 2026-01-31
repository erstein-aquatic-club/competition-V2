import assert from "node:assert/strict";
import { test } from "node:test";
import { orderStrengthItems } from "@/pages/Strength";

test("orderStrengthItems respects DIM order_index when provided", () => {
  const items = [
    { exercise_id: 1, order_index: 2, sets: 0, reps: 0, rest_seconds: 0, percent_1rm: 0 },
    { exercise_id: 2, order_index: 0, sets: 0, reps: 0, rest_seconds: 0, percent_1rm: 0 },
    { exercise_id: 3, order_index: 1, sets: 0, reps: 0, rest_seconds: 0, percent_1rm: 0 },
  ];

  const ordered = orderStrengthItems(items);

  assert.deepEqual(
    ordered.map((item) => item.exercise_id),
    [2, 3, 1],
  );
});

test("orderStrengthItems preserves current order when DIM order is missing", () => {
  const items = [
    { exercise_id: 1, order_index: NaN, sets: 0, reps: 0, rest_seconds: 0, percent_1rm: 0 },
    { exercise_id: 2, order_index: NaN, sets: 0, reps: 0, rest_seconds: 0, percent_1rm: 0 },
  ];

  const ordered = orderStrengthItems(items);

  assert.deepEqual(
    ordered.map((item) => item.exercise_id),
    [1, 2],
  );
});

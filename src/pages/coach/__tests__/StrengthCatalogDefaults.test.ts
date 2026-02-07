import assert from "node:assert/strict";
import { test } from "node:test";
import { createStrengthItemFromExercise } from "@/pages/coach/StrengthCatalog";
import type { Exercise } from "@/lib/api";

test("createStrengthItemFromExercise prefills fields from DIM_exercices", () => {
  const exercise = {
    id: 10,
    nom_exercice: "Squat",
    exercise_type: "strength",
    Nb_series_endurance: 4,
    Nb_reps_endurance: 12,
    pct_1rm_endurance: 65,
    recup_endurance: 90,
  };

  const item = createStrengthItemFromExercise(exercise as unknown as Exercise, "endurance", 2);

  assert.equal(item.exercise_id, 10);
  assert.equal(item.order_index, 2);
  assert.equal(item.sets, 4);
  assert.equal(item.reps, 12);
  assert.equal(item.percent_1rm, 65);
  assert.equal(item.rest_seconds, 90);
});

test("createStrengthItemFromExercise keeps manual overrides after creation", () => {
  const exercise = {
    id: 20,
    nom_exercice: "Tractions",
    exercise_type: "strength",
    Nb_series_endurance: 3,
    Nb_reps_endurance: 8,
    pct_1rm_endurance: 70,
    recup_endurance: 120,
  };

  const item = createStrengthItemFromExercise(exercise as unknown as Exercise, "endurance", 0);
  const overridden = { ...item, sets: 6 };

  assert.equal(overridden.sets, 6);
  assert.equal(overridden.reps, 8);
});

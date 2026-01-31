import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HallOfFameValue } from "@/pages/hallOfFame/HallOfFameValue";
import { normalizeHallOfFameScore } from "@/pages/hallOfFame/valueUtils";

test("normalizeHallOfFameScore converts 10-point values to 5-point scale", () => {
  assert.equal(normalizeHallOfFameScore(8), 4);
  assert.equal(normalizeHallOfFameScore(10), 5);
  assert.equal(normalizeHallOfFameScore(4.5), 4.5);
});

test("normalizeHallOfFameScore guards invalid values", () => {
  assert.equal(normalizeHallOfFameScore(null), null);
  assert.equal(normalizeHallOfFameScore(undefined), null);
  assert.equal(normalizeHallOfFameScore(-1), null);
  assert.equal(normalizeHallOfFameScore(Number.NaN), null);
});

test("HallOfFameValue renders the provided value", () => {
  const markup = renderToStaticMarkup(<HallOfFameValue value="4.2" toneScore={4.2} />);
  assert.ok(markup.includes("4.2"));
});

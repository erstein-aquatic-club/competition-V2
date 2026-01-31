import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreToColor } from "@/lib/score";

test("scoreToColor returns muted color when value is empty", () => {
  assert.ok(scoreToColor(null).includes("hsl("));
});

test("scoreToColor returns red tone for low values by default", () => {
  assert.equal(scoreToColor(1), "hsl(0 84% 60%)");
  assert.equal(scoreToColor(2.5), "hsl(0 84% 60%)");
});

test("scoreToColor returns yellow tone for mid values", () => {
  assert.equal(scoreToColor(3), "hsl(48 96% 53%)");
  assert.equal(scoreToColor(3.7), "hsl(48 96% 53%)");
});

test("scoreToColor returns green tone for high values", () => {
  assert.equal(scoreToColor(4), "hsl(142 70% 45%)");
  assert.equal(scoreToColor(5), "hsl(142 70% 45%)");
});

test("scoreToColor maps low scores to red and high scores to less red", () => {
  assert.equal(scoreToColor(1), "hsl(0 84% 60%)");
  assert.equal(scoreToColor(5), "hsl(142 70% 45%)");
});

test("scoreToColor inverts tones when invert option is true", () => {
  assert.equal(scoreToColor(1, { invert: true }), "hsl(142 70% 45%)");
  assert.equal(scoreToColor(5, { invert: true }), "hsl(0 84% 60%)");
});

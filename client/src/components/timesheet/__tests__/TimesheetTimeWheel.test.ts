import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTimeValue } from "@/components/timesheet/TimesheetTimeWheel";

test("normalizeTimeValue clamps and formats HH:MM values", () => {
  assert.equal(normalizeTimeValue("9:5"), "09:05");
  assert.equal(normalizeTimeValue("25:62"), "23:55");
});

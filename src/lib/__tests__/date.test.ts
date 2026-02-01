import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSwimSessionDefaultTitle } from "@/lib/date";

test("formatSwimSessionDefaultTitle formats the default swim session title", () => {
  const date = new Date(2024, 3, 5);
  assert.equal(formatSwimSessionDefaultTitle(date), "Séance du 05/04/2024 - Soir - Matin");
});

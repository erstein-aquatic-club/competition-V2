import assert from "node:assert/strict";
import { test } from "node:test";
import { canDeleteSwimCatalog } from "@/pages/coach/SwimCatalog";
import type { Assignment } from "@/lib/api";

test("canDeleteSwimCatalog returns false when assignments are unknown", () => {
  assert.equal(canDeleteSwimCatalog(10, null), false);
});

test("canDeleteSwimCatalog blocks deletion when session is assigned", () => {
  const assignments = [{ session_type: "swim", session_id: 10 }];
  assert.equal(canDeleteSwimCatalog(10, assignments as unknown as Assignment[]), false);
});

test("canDeleteSwimCatalog allows deletion when session is unused", () => {
  const assignments = [{ session_type: "swim", session_id: 12 }];
  assert.equal(canDeleteSwimCatalog(10, assignments as unknown as Assignment[]), true);
});

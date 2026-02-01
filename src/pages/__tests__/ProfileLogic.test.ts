import assert from "node:assert/strict";
import { test } from "node:test";
import { getRoleLabel, shouldShowRecords } from "@/pages/Profile";

test("getRoleLabel returns readable labels per role", () => {
  assert.equal(getRoleLabel("coach"), "Entraineur EAC");
  assert.equal(getRoleLabel("admin"), "Admin");
  assert.equal(getRoleLabel("comite"), "Comité");
  assert.equal(getRoleLabel("athlete"), "Nageur");
  assert.equal(getRoleLabel(null), "Nageur");
});

test("shouldShowRecords hides records for coach/admin/comite", () => {
  assert.equal(shouldShowRecords("coach"), false);
  assert.equal(shouldShowRecords("admin"), false);
  assert.equal(shouldShowRecords("comite"), false);
  assert.equal(shouldShowRecords("athlete"), true);
  assert.equal(shouldShowRecords(null), true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { getNavItemsForRole } from "@/components/layout/navItems";

test("Coach nav items include coach tab first and expected labels", () => {
  const items = getNavItemsForRole("coach");
  const labels = items.map((item) => item.label);

  assert.equal(labels[0], "Coach");
  assert.ok(labels.includes("Messagerie"));
  assert.ok(labels.includes("Administratif"));
  assert.ok(labels.includes("Profil"));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { getNavItemsForRole } from "@/components/layout/navItems";

test("Coach nav items include expected labels", () => {
  const items = getNavItemsForRole("coach");
  const labels = items.map((item) => item.label);

  assert.equal(labels[0], "Natation");
  assert.ok(labels.includes("Calendrier"));
  assert.ok(labels.includes("Nageurs"));
  assert.ok(labels.includes("Profil"));
});

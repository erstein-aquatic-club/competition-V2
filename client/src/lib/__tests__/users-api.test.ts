import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/lib/api";
import { supabaseConfig } from "@/lib/config";

test("updateUserRole returns skipped when Supabase is not configured", async () => {
  // In test environment, Supabase is not configured (no env vars)
  assert.equal(supabaseConfig.hasSupabase, false);

  const result = await api.updateUserRole({ userId: 42, role: "comite" });
  assert.deepEqual(result, { status: "skipped" });
});

test("disableUser returns skipped when Supabase is not configured", async () => {
  assert.equal(supabaseConfig.hasSupabase, false);

  const result = await api.disableUser({ userId: 42 });
  assert.deepEqual(result, { status: "skipped" });
});

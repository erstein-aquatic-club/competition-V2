import assert from "node:assert/strict";
import { test } from "node:test";
import { supabaseConfig } from "@/lib/config";

test("supabaseConfig exposes hasSupabase flag", () => {
  assert.equal(typeof supabaseConfig.hasSupabase, "boolean");
  assert.equal(typeof supabaseConfig.url, "string");
  assert.equal(typeof supabaseConfig.anonKey, "string");
});

test("supabaseConfig.hasSupabase is false when env vars are missing", () => {
  // In test environment, VITE_SUPABASE_URL is not set
  assert.equal(supabaseConfig.hasSupabase, false);
});

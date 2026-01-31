import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeApiError } from "@/lib/api";

test("summarizeApiError maps worker mismatch errors", () => {
  const error = new Error("Not Found") as { status?: number; code?: string };
  error.status = 404;
  error.code = "unknown_action";
  const summary = summarizeApiError(error, "Fallback");
  assert.equal(summary.message, "Action inconnue côté Worker. Déploiement incomplet ?");
});

test("summarizeApiError maps auth errors", () => {
  const error = new Error("Unauthorized") as { status?: number };
  error.status = 401;
  const summary = summarizeApiError(error, "Fallback");
  assert.equal(summary.message, "Authentification expirée ou manquante.");
});

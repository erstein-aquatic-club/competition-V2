import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTH_ENDPOINT_MISSING_MESSAGE,
  buildAuthUrl,
} from "@/lib/authRequests";
import { syncConfig } from "@/lib/config";

test("buildAuthUrl uses configured endpoint for auth actions", () => {
  const originalEndpoint = syncConfig.endpoint;
  (syncConfig as { endpoint: string }).endpoint = "https://example.com/";

  const precheckUrl = buildAuthUrl("auth_login_precheck");
  const loginUrl = buildAuthUrl("auth_login");

  assert.ok(precheckUrl?.startsWith("https://example.com/"));
  assert.ok(precheckUrl?.includes("action=auth_login_precheck"));
  assert.ok(loginUrl?.startsWith("https://example.com/"));
  assert.ok(loginUrl?.includes("action=auth_login"));

  (syncConfig as { endpoint: string }).endpoint = originalEndpoint;
});

test("buildAuthUrl throws when endpoint is missing and avoids fetch", async () => {
  const originalEndpoint = syncConfig.endpoint;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  (syncConfig as { endpoint: string }).endpoint = "";

  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };

  let errorMessage = "";
  try {
    const url = buildAuthUrl("auth_login_precheck");
    if (url) {
      await fetch(url);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  assert.equal(fetchCalled, false);
  assert.equal(errorMessage, AUTH_ENDPOINT_MISSING_MESSAGE);

  globalThis.fetch = originalFetch;
  (syncConfig as { endpoint: string }).endpoint = originalEndpoint;
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/lib/api";
import { syncConfig } from "@/lib/config";

test("updateUserRole sends role update request", async () => {
  const originalEndpoint = syncConfig.endpoint;
  const originalFetch = global.fetch;
  const requests: { url: string; body: string | null }[] = [];

  (syncConfig as { endpoint: string }).endpoint = "https://example.com";

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: typeof init?.body === "string" ? init.body : null });
    return new Response(JSON.stringify({ ok: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  await api.updateUserRole({ userId: 42, role: "comite" });

  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.includes("action=users_update"));
  assert.ok(requests[0].body?.includes("\"user_id\":42"));
  assert.ok(requests[0].body?.includes("\"role\":\"comite\""));

  global.fetch = originalFetch;
  (syncConfig as { endpoint: string }).endpoint = originalEndpoint;
});

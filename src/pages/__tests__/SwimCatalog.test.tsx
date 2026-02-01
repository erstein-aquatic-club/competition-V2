import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SwimCatalog from "@/pages/coach/SwimCatalog";
import { api } from "@/lib/api";

test("SwimCatalog renders coach list header", () => {
  const original = api.getSwimCatalog;
  api.getSwimCatalog = async () => [];

  const queryClient = new QueryClient();
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <SwimCatalog />
    </QueryClientProvider>,
  );

  assert.ok(markup.includes("Coach"));
  assert.ok(markup.includes("Nouvelle"));

  api.getSwimCatalog = original;
});

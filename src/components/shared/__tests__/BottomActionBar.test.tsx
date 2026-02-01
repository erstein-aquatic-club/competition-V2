import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomActionBar } from "@/components/shared/BottomActionBar";

test("BottomActionBar renders children", () => {
  const markup = renderToStaticMarkup(
    <BottomActionBar>
      <button type="button">Action</button>
    </BottomActionBar>,
  );

  assert.ok(markup.includes("Action"));
});

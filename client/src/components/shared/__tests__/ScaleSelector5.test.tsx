import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScaleSelector5 } from "@/components/shared/ScaleSelector5";

test("ScaleSelector5 renders five scale buttons", () => {
  const markup = renderToStaticMarkup(<ScaleSelector5 value={3} />);

  const buttonMatches = markup.match(/<button/g) ?? [];
  assert.equal(buttonMatches.length, 5);
  assert.ok(/aria-pressed=\"true\"/.test(markup));
});

// src/pages/__tests__/Podium.test.tsx
import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Podium, type PodiumEntry } from "@/pages/hallOfFame/Podium";

test("Podium renders 3 entries in correct order (2-1-3)", () => {
  const entries: PodiumEntry[] = [
    { name: "ALICE", value: "12.4 km", toneScore: 5 },
    { name: "BOB", value: "9.8 km", toneScore: 3 },
    { name: "CHARLIE", value: "7.2 km", toneScore: 1 },
  ];
  const markup = renderToStaticMarkup(<Podium entries={entries} />);
  // #2 (BOB) appears before #1 (ALICE) in DOM (left column first)
  const bobIdx = markup.indexOf("BOB");
  const aliceIdx = markup.indexOf("ALICE");
  const charlieIdx = markup.indexOf("CHARLIE");
  assert.ok(bobIdx < aliceIdx, "BOB (#2) should be before ALICE (#1) in DOM");
  assert.ok(aliceIdx < charlieIdx, "ALICE (#1) should be before CHARLIE (#3) in DOM");
});

test("Podium renders 2 entries without crashing", () => {
  const entries: PodiumEntry[] = [
    { name: "ALICE", value: "12.4 km", toneScore: 5 },
    { name: "BOB", value: "9.8 km", toneScore: 3 },
  ];
  const markup = renderToStaticMarkup(<Podium entries={entries} />);
  assert.ok(markup.includes("ALICE"));
  assert.ok(markup.includes("BOB"));
});

test("Podium renders 1 entry as solo champion", () => {
  const entries: PodiumEntry[] = [
    { name: "ALICE", value: "12.4 km", toneScore: 5 },
  ];
  const markup = renderToStaticMarkup(<Podium entries={entries} />);
  assert.ok(markup.includes("ALICE"));
});

test("Podium renders empty state", () => {
  const markup = renderToStaticMarkup(<Podium entries={[]} />);
  assert.ok(markup.includes("Aucune donn"));
});

import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SwimKpiCompactGrid } from "@/pages/Progress";

test("SwimKpiCompactGrid renders compact KPI labels", () => {
  const markup = renderToStaticMarkup(
    <SwimKpiCompactGrid
      avgRpe={3.2}
      avgPerformance={4.1}
      avgEngagement={3.8}
      avgFatigue={2.4}
    />,
  );

  assert.ok(markup.includes("Difficulté Moy"));
  assert.ok(markup.includes("Performance Moy"));
  assert.ok(markup.includes("Engagement Moy"));
  assert.ok(markup.includes("Fatigue Moy"));
});

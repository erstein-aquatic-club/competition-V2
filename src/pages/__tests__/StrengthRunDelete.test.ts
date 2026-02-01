import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInProgressRunCache, createInProgressRun, resetStrengthRunState } from "@/pages/Strength";

test("resetStrengthRunState clears in-progress session state", () => {
  let activeSession: any = { id: 1 };
  let activeAssignment: any = { id: 10 };
  let activeRunId: number | null = 42;
  let activeRunLogs: any[] | null = [{ id: 1 }];
  let activeRunnerStep = 3;
  let screenMode: "list" | "reader" | "focus" | "settings" = "focus";

  resetStrengthRunState({
    setActiveSession: (value) => {
      activeSession = value;
    },
    setActiveAssignment: (value) => {
      activeAssignment = value;
    },
    setActiveRunId: (value) => {
      activeRunId = value;
    },
    setActiveRunLogs: (value) => {
      activeRunLogs = value;
    },
    setActiveRunnerStep: (value) => {
      activeRunnerStep = value;
    },
    setScreenMode: (value) => {
      screenMode = value;
    },
  });

  assert.equal(activeSession, null);
  assert.equal(activeAssignment, null);
  assert.equal(activeRunId, null);
  assert.equal(activeRunLogs, null);
  assert.equal(activeRunnerStep, 0);
  assert.equal(screenMode, "list");
});

test("createInProgressRun builds an in-progress run snapshot for immediate UI state", () => {
  const run = createInProgressRun({
    runId: 123,
    assignmentId: 77,
    startedAt: "2024-01-01T10:00:00.000Z",
  });

  assert.equal(run.id, 123);
  assert.equal(run.assignment_id, 77);
  assert.equal(run.status, "in_progress");
  assert.equal(run.progress_pct, 0);
});

test("buildInProgressRunCache clears the run state without a refresh", () => {
  const cache = buildInProgressRunCache(null);

  assert.equal(cache.runs.length, 0);
  assert.equal(cache.pagination.total, 0);
});

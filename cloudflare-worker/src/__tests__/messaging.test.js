import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMessageTargetUserIds } from "../index.js";

test("buildMessageTargetUserIds expands group recipients and includes sender", () => {
  const targets = [{ target_group_id: 5 }, { target_user_id: 12 }];
  const groupMembersById = new Map([[5, [12, 20]]]);

  const resolved = buildMessageTargetUserIds({ targets, groupMembersById, senderId: 7 }).sort((a, b) => a - b);

  assert.deepEqual(resolved, [7, 12, 20]);
});

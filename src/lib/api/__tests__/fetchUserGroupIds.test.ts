import assert from "node:assert/strict";
import { test } from "node:test";
import { partitionGroupIds } from "@/lib/api/client";

test("partitionGroupIds: no groups returns empty sets", () => {
  const result = partitionGroupIds([]);
  assert.deepEqual(result.permanentGroupIds, []);
  assert.deepEqual(result.temporaryGroupIds, []);
  assert.equal(result.hasActiveTemporary, false);
});

test("partitionGroupIds: only permanent groups", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 2, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1, 2]);
  assert.deepEqual(result.temporaryGroupIds, []);
  assert.equal(result.hasActiveTemporary, false);
});

test("partitionGroupIds: active temporary suspends permanent", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 10, groups: { is_temporary: true, is_active: true, parent_group_id: null } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1]);
  assert.deepEqual(result.temporaryGroupIds, [10]);
  assert.equal(result.hasActiveTemporary, true);
});

test("partitionGroupIds: sub-group includes parent", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 10, groups: { is_temporary: true, is_active: true, parent_group_id: null } },
    { group_id: 11, groups: { is_temporary: true, is_active: true, parent_group_id: 10 } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1]);
  assert.equal(result.hasActiveTemporary, true);
  assert.ok(result.temporaryGroupIds.includes(10));
  assert.ok(result.temporaryGroupIds.includes(11));
});

test("partitionGroupIds: inactive temporary ignored", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 10, groups: { is_temporary: true, is_active: false, parent_group_id: null } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1]);
  assert.deepEqual(result.temporaryGroupIds, []);
  assert.equal(result.hasActiveTemporary, false);
});

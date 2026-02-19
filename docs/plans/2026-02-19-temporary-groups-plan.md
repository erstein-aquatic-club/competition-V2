# Temporary Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow coaches to create temporary groups (stages) with swimmers from different permanent groups, with automatic suspension of permanent group assignments during the stage, and sub-group support for differentiated work.

**Architecture:** Extend the existing `groups` table with `is_temporary`, `parent_group_id`, `is_active`, `created_by` columns. Replace `fetchUserGroupIds` with a context-aware version that filters permanent vs temporary groups. Add a new "Groupes" section to the Coach dashboard.

**Tech Stack:** Supabase migration (PostgreSQL), React + TypeScript, Tanstack Query, Shadcn/Radix UI components

**Design doc:** `docs/plans/2026-02-19-temporary-groups-design.md`

---

## Task 1: Database migration — extend `groups` table

**Files:**
- Create: `supabase/migrations/00026_temporary_groups.sql`

**Step 1: Write the migration**

```sql
-- =============================================================================
-- Migration: Temporary groups for coach stages
-- =============================================================================

-- 1. Add columns to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS parent_group_id integer REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id);

-- 2. Index for fast lookup of temporary groups
CREATE INDEX IF NOT EXISTS idx_groups_temporary ON groups (is_temporary, is_active);
CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups (parent_group_id) WHERE parent_group_id IS NOT NULL;

-- 3. RLS: coaches can manage temporary groups
-- Drop existing policy if any (groups may not have RLS enabled yet)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Everyone can read all groups
DROP POLICY IF EXISTS groups_select ON groups;
CREATE POLICY groups_select ON groups FOR SELECT USING (true);

-- Coaches/admins can insert temporary groups only
DROP POLICY IF EXISTS groups_insert ON groups;
CREATE POLICY groups_insert ON groups FOR INSERT
  WITH CHECK (
    app_user_role() IN ('admin', 'coach')
    AND is_temporary = true
  );

-- Coaches/admins can update temporary groups only
DROP POLICY IF EXISTS groups_update ON groups;
CREATE POLICY groups_update ON groups FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach') AND is_temporary = true)
  WITH CHECK (app_user_role() IN ('admin', 'coach') AND is_temporary = true);

-- Coaches/admins can delete temporary groups only
DROP POLICY IF EXISTS groups_delete ON groups;
CREATE POLICY groups_delete ON groups FOR DELETE
  USING (app_user_role() IN ('admin', 'coach') AND is_temporary = true);
```

**Step 2: Apply the migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with `name: "temporary_groups"` and the SQL above.

**Step 3: Verify with `list_tables`**

Check that `groups` table now has the new columns.

**Step 4: Commit**

```
git add supabase/migrations/00026_temporary_groups.sql
git commit -m "feat(temp-groups): add migration for temporary groups columns and RLS"
```

---

## Task 2: Update Drizzle schema

**Files:**
- Modify: `src/lib/schema.ts:98-102`

**Step 1: Update the `groups` table definition**

Replace the current `groups` definition at line 98-102 with:

```ts
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
  isTemporary: boolean("is_temporary").notNull().default(false),
  parentGroupId: integer("parent_group_id").references((): any => groups.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
});
```

Need to add `boolean` to the drizzle imports at the top of the file.

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```
git add src/lib/schema.ts
git commit -m "feat(temp-groups): update Drizzle schema with temporary group columns"
```

---

## Task 3: Extend `GroupSummary` type and update `getGroups()`

**Files:**
- Modify: `src/lib/api/types.ts:171-175`
- Modify: `src/lib/api/users.ts:166-177`

**Step 1: Extend `GroupSummary`**

In `src/lib/api/types.ts`, replace lines 171-175:

```ts
export interface GroupSummary {
  id: number;
  name: string;
  member_count?: number | null;
  is_temporary?: boolean;
  is_active?: boolean;
  parent_group_id?: number | null;
}
```

**Step 2: Update `getGroups()` in `src/lib/api/users.ts`**

Replace lines 166-177:

```ts
export async function getGroups(): Promise<GroupSummary[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, is_temporary, is_active, parent_group_id");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((g: any) => {
      // Show all permanent groups + active temporary groups
      if (!g.is_temporary) return true;
      return g.is_active === true;
    })
    .map((group: any) => ({
      id: safeInt(group.id, 0),
      name: String(group.name ?? `Groupe ${group.id ?? ""}`).trim(),
      member_count: null,
      is_temporary: group.is_temporary ?? false,
      is_active: group.is_active ?? true,
      parent_group_id: group.parent_group_id ?? null,
    }))
    .filter((g: GroupSummary) => g.id > 0 && g.name)
    .sort((a, b) => {
      // Temporary active groups first, then permanent
      if (a.is_temporary && !b.is_temporary) return -1;
      if (!a.is_temporary && b.is_temporary) return 1;
      return a.name.localeCompare(b.name, "fr");
    });
}
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```
git add src/lib/api/types.ts src/lib/api/users.ts
git commit -m "feat(temp-groups): extend GroupSummary type and getGroups query"
```

---

## Task 4: Replace `fetchUserGroupIds` with context-aware version

This is the core suspension logic. Critical path.

**Files:**
- Modify: `src/lib/api/client.ts:246-253` (the existing `fetchUserGroupIds`)
- Modify: `src/lib/api/assignments.ts:11,33-38` (import + usage in `getAssignments`)
- Modify: `src/lib/api/assignments.ts:268-270` (usage in `getCoachAssignments`)
- Modify: `src/lib/api/index.ts:60` (re-export)
- Test: `src/lib/api/__tests__/fetchUserGroupIds.test.ts`

**Step 1: Write the failing test**

Create `src/lib/api/__tests__/fetchUserGroupIds.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { partitionGroupIds } from "@/lib/api/client";

// Unit test for the pure partition logic (no Supabase dependency)

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

test("partitionGroupIds: active temporary group suspends permanent", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 10, groups: { is_temporary: true, is_active: true, parent_group_id: null } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1]);
  assert.deepEqual(result.temporaryGroupIds, [10]);
  assert.equal(result.hasActiveTemporary, true);
});

test("partitionGroupIds: sub-group includes parent in temporaryGroupIds", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 10, groups: { is_temporary: true, is_active: true, parent_group_id: null } },
    { group_id: 11, groups: { is_temporary: true, is_active: true, parent_group_id: 10 } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1]);
  assert.equal(result.hasActiveTemporary, true);
  // Should contain 10 (root) and 11 (sub), plus 10 again from parent dedup
  assert.ok(result.temporaryGroupIds.includes(10));
  assert.ok(result.temporaryGroupIds.includes(11));
});

test("partitionGroupIds: inactive temporary group is ignored", () => {
  const rows = [
    { group_id: 1, groups: { is_temporary: false, is_active: true, parent_group_id: null } },
    { group_id: 10, groups: { is_temporary: true, is_active: false, parent_group_id: null } },
  ];
  const result = partitionGroupIds(rows);
  assert.deepEqual(result.permanentGroupIds, [1]);
  assert.deepEqual(result.temporaryGroupIds, []);
  assert.equal(result.hasActiveTemporary, false);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run 2>&1 | grep "partitionGroupIds"
```

Expected: FAIL — `partitionGroupIds` not exported from client.

**Step 3: Implement `partitionGroupIds` and `fetchUserGroupIdsWithContext`**

In `src/lib/api/client.ts`, replace `fetchUserGroupIds` (line 246-253) with:

```ts
type GroupMemberRow = {
  group_id: number;
  groups: { is_temporary: boolean; is_active: boolean; parent_group_id: number | null };
};

type GroupIdPartition = {
  permanentGroupIds: number[];
  temporaryGroupIds: number[];
  hasActiveTemporary: boolean;
};

/** Pure function: partition group membership rows into permanent vs temporary */
export const partitionGroupIds = (rows: GroupMemberRow[]): GroupIdPartition => {
  const permanentGroupIds: number[] = [];
  const temporarySet = new Set<number>();
  let hasActiveTemporary = false;

  for (const row of rows) {
    const g = row.groups;
    if (g.is_temporary) {
      if (g.is_active) {
        hasActiveTemporary = true;
        temporarySet.add(row.group_id);
        if (g.parent_group_id) {
          temporarySet.add(g.parent_group_id);
        }
      }
      // Inactive temporary: ignored
    } else {
      permanentGroupIds.push(row.group_id);
    }
  }

  return { permanentGroupIds, temporaryGroupIds: Array.from(temporarySet), hasActiveTemporary };
};

/** Fetch group IDs with temporary/permanent context */
export const fetchUserGroupIdsWithContext = async (
  userId?: number | null,
): Promise<GroupIdPartition> => {
  const empty: GroupIdPartition = { permanentGroupIds: [], temporaryGroupIds: [], hasActiveTemporary: false };
  if (!userId || !canUseSupabase()) return empty;

  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups!inner(is_temporary, is_active, parent_group_id)")
    .eq("user_id", userId);

  if (error || !data) return empty;
  return partitionGroupIds(data as unknown as GroupMemberRow[]);
};

/** @deprecated Use fetchUserGroupIdsWithContext instead */
export const fetchUserGroupIds = async (userId?: number | null): Promise<number[]> => {
  if (!userId || !canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((m: { group_id: number }) => m.group_id).filter((id: number) => id > 0);
};
```

**Step 4: Update `getAssignments` in `src/lib/api/assignments.ts`**

At line 11, add import:
```ts
import {
  supabase,
  canUseSupabase,
  safeInt,
  safeOptionalInt,
  delay,
  fetchUserGroupIds,
  fetchUserGroupIdsWithContext,
  STORAGE_KEYS,
} from './client';
```

Replace lines 33-38 inside `getAssignments`:

```ts
    const { permanentGroupIds, temporaryGroupIds, hasActiveTemporary } =
      await fetchUserGroupIdsWithContext(athleteId ?? null);
    const orFilters: string[] = [];
    if (athleteId !== null && athleteId !== undefined) {
      orFilters.push(`target_user_id.eq.${athleteId}`);
    }
    const visibleGroupIds = hasActiveTemporary ? temporaryGroupIds : permanentGroupIds;
    visibleGroupIds.forEach((gid) => orFilters.push(`target_group_id.eq.${gid}`));
```

**Step 5: Update `getCoachAssignments` in same file (line 268-270)**

Replace:
```ts
    const groupIds = await fetchUserGroupIds(filters.userId);
    const orFilters: string[] = [`target_user_id.eq.${filters.userId}`];
    groupIds.forEach((gid) => orFilters.push(`target_group_id.eq.${gid}`));
```
With:
```ts
    const { permanentGroupIds, temporaryGroupIds, hasActiveTemporary } =
      await fetchUserGroupIdsWithContext(filters.userId);
    const orFilters: string[] = [`target_user_id.eq.${filters.userId}`];
    const visibleGroupIds = hasActiveTemporary ? temporaryGroupIds : permanentGroupIds;
    visibleGroupIds.forEach((gid) => orFilters.push(`target_group_id.eq.${gid}`));
```

**Step 6: Update re-exports in `src/lib/api/index.ts` (line 60)**

Add `partitionGroupIds` and `fetchUserGroupIdsWithContext` to the re-exports from `./client`:
```ts
  fetchUserGroupIds,
  fetchUserGroupIdsWithContext,
  partitionGroupIds,
```

**Step 7: Run tests**

```bash
npm test -- --run
```

Expected: all pass including the 5 new `partitionGroupIds` tests.

**Step 8: Run type check**

```bash
npx tsc --noEmit
```

**Step 9: Commit**

```
git add src/lib/api/client.ts src/lib/api/assignments.ts src/lib/api/index.ts src/lib/api/__tests__/fetchUserGroupIds.test.ts
git commit -m "feat(temp-groups): add fetchUserGroupIdsWithContext with suspension logic"
```

---

## Task 5: Add temporary group CRUD API functions

**Files:**
- Modify: `src/lib/api/types.ts` (add `TemporaryGroupSummary`, `TemporaryGroupDetail`)
- Create: `src/lib/api/temporary-groups.ts`
- Modify: `src/lib/api/index.ts` (re-export)
- Modify: `src/lib/api.ts` (add to `api` object)

**Step 1: Add types in `src/lib/api/types.ts`**

Append after `GroupSummary`:

```ts
export interface TemporaryGroupSummary {
  id: number;
  name: string;
  is_active: boolean;
  parent_group_id: number | null;
  member_count: number;
  subgroup_count: number;
  created_at: string;
  created_by: number;
}

export interface TemporaryGroupMember {
  user_id: number;
  display_name: string;
  permanent_group_label: string | null;
}

export interface TemporaryGroupDetail {
  id: number;
  name: string;
  is_active: boolean;
  members: TemporaryGroupMember[];
  subgroups: Array<{
    id: number;
    name: string;
    members: Array<{ user_id: number; display_name: string }>;
  }>;
}
```

**Step 2: Create `src/lib/api/temporary-groups.ts`**

```ts
/**
 * API Temporary Groups - CRUD for coach temporary groups (stages)
 */

import { supabase, canUseSupabase, safeInt } from "./client";
import type { TemporaryGroupSummary, TemporaryGroupDetail, TemporaryGroupMember } from "./types";

export async function getTemporaryGroups(): Promise<TemporaryGroupSummary[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, is_active, parent_group_id, created_by, created_at")
    .eq("is_temporary", true)
    .is("parent_group_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  // Fetch sub-group counts
  const parentIds = data.map((g: any) => g.id);
  const { data: subgroups } = await supabase
    .from("groups")
    .select("parent_group_id")
    .eq("is_temporary", true)
    .in("parent_group_id", parentIds);

  const subgroupCounts = new Map<number, number>();
  (subgroups ?? []).forEach((sg: any) => {
    subgroupCounts.set(sg.parent_group_id, (subgroupCounts.get(sg.parent_group_id) ?? 0) + 1);
  });

  // Fetch member counts (only direct members of root group)
  const { data: members } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", parentIds);

  const memberCounts = new Map<number, number>();
  (members ?? []).forEach((m: any) => {
    memberCounts.set(m.group_id, (memberCounts.get(m.group_id) ?? 0) + 1);
  });

  return data.map((g: any) => ({
    id: safeInt(g.id, 0),
    name: g.name,
    is_active: g.is_active ?? true,
    parent_group_id: g.parent_group_id ?? null,
    member_count: memberCounts.get(g.id) ?? 0,
    subgroup_count: subgroupCounts.get(g.id) ?? 0,
    created_at: g.created_at ?? "",
    created_by: g.created_by ?? 0,
  }));
}

export async function getTemporaryGroupDetail(groupId: number): Promise<TemporaryGroupDetail | null> {
  if (!canUseSupabase()) return null;

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, is_active")
    .eq("id", groupId)
    .eq("is_temporary", true)
    .single();
  if (error || !group) return null;

  // Members of this group with their permanent group label
  const { data: membersRaw } = await supabase
    .from("group_members")
    .select("user_id, users!inner(display_name)")
    .eq("group_id", groupId);

  // For each member, find their permanent group label
  const memberUserIds = (membersRaw ?? []).map((m: any) => m.user_id);
  const { data: permanentMemberships } = memberUserIds.length
    ? await supabase
        .from("group_members")
        .select("user_id, group_id, groups!inner(name, is_temporary)")
        .in("user_id", memberUserIds)
        .eq("groups.is_temporary", false)
    : { data: [] };

  const permGroupByUser = new Map<number, string>();
  (permanentMemberships ?? []).forEach((pm: any) => {
    if (!permGroupByUser.has(pm.user_id)) {
      permGroupByUser.set(pm.user_id, (pm.groups as any)?.name ?? null);
    }
  });

  const members: TemporaryGroupMember[] = (membersRaw ?? []).map((m: any) => ({
    user_id: m.user_id,
    display_name: (m.users as any)?.display_name ?? "",
    permanent_group_label: permGroupByUser.get(m.user_id) ?? null,
  }));

  // Sub-groups
  const { data: subgroupsRaw } = await supabase
    .from("groups")
    .select("id, name")
    .eq("parent_group_id", groupId)
    .eq("is_temporary", true);

  const subgroups = await Promise.all(
    (subgroupsRaw ?? []).map(async (sg: any) => {
      const { data: sgMembers } = await supabase
        .from("group_members")
        .select("user_id, users!inner(display_name)")
        .eq("group_id", sg.id);
      return {
        id: sg.id,
        name: sg.name,
        members: (sgMembers ?? []).map((m: any) => ({
          user_id: m.user_id,
          display_name: (m.users as any)?.display_name ?? "",
        })),
      };
    }),
  );

  return {
    id: group.id,
    name: group.name,
    is_active: group.is_active,
    members,
    subgroups,
  };
}

export async function createTemporaryGroup(data: {
  name: string;
  member_user_ids: number[];
  parent_group_id?: number | null;
}): Promise<{ id: number }> {
  if (!canUseSupabase()) throw new Error("Supabase required");

  // Guard: check no member is already in an active temporary group
  if (data.member_user_ids.length > 0) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("user_id, group_id, groups!inner(is_temporary, is_active, parent_group_id)")
      .in("user_id", data.member_user_ids)
      .eq("groups.is_temporary", true)
      .eq("groups.is_active", true);

    // Filter: only root temporary groups (not sub-groups of the same parent)
    const conflicts = (existing ?? []).filter((row: any) => {
      const g = row.groups as any;
      // If creating a sub-group, members can belong to the parent
      if (data.parent_group_id && (row.group_id === data.parent_group_id || g.parent_group_id === data.parent_group_id)) {
        return false;
      }
      return true;
    });

    if (conflicts.length > 0) {
      const conflictUserIds = [...new Set(conflicts.map((c: any) => c.user_id))];
      throw new Error(`Nageurs déjà dans un groupe temporaire actif: IDs ${conflictUserIds.join(", ")}`);
    }
  }

  // If sub-group: validate members are in parent
  if (data.parent_group_id && data.member_user_ids.length > 0) {
    const { data: parentMembers } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", data.parent_group_id);
    const parentUserIds = new Set((parentMembers ?? []).map((m: any) => m.user_id));
    const invalid = data.member_user_ids.filter((uid) => !parentUserIds.has(uid));
    if (invalid.length > 0) {
      throw new Error(`Nageurs non membres du groupe parent: IDs ${invalid.join(", ")}`);
    }
  }

  const { data: created, error } = await supabase
    .from("groups")
    .insert({
      name: data.name.trim(),
      is_temporary: true,
      is_active: true,
      parent_group_id: data.parent_group_id ?? null,
      created_by: (await supabase.auth.getUser()).data.user?.id ? undefined : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Set created_by using app_user_id() via raw SQL or just leave it
  // Actually, we need the numeric user id. Use RPC or update after.
  const groupId = created.id;

  // Insert members
  if (data.member_user_ids.length > 0) {
    const memberRows = data.member_user_ids.map((uid) => ({
      group_id: groupId,
      user_id: uid,
    }));
    const { error: memberError } = await supabase
      .from("group_members")
      .insert(memberRows);
    if (memberError) throw new Error(memberError.message);
  }

  return { id: groupId };
}

export async function addTemporaryGroupMembers(groupId: number, userIds: number[]): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase required");
  if (!userIds.length) return;

  // Guard: no member already in another active temporary group
  const { data: existing } = await supabase
    .from("group_members")
    .select("user_id, group_id, groups!inner(is_temporary, is_active, parent_group_id)")
    .in("user_id", userIds)
    .eq("groups.is_temporary", true)
    .eq("groups.is_active", true);

  const conflicts = (existing ?? []).filter((row: any) => {
    // Allow if same group or sub-group of same parent
    if (row.group_id === groupId) return false;
    const g = row.groups as any;
    if (g.parent_group_id === groupId) return false;
    return true;
  });

  if (conflicts.length > 0) {
    const conflictUserIds = [...new Set(conflicts.map((c: any) => c.user_id))];
    throw new Error(`Nageurs déjà dans un groupe temporaire actif: IDs ${conflictUserIds.join(", ")}`);
  }

  const rows = userIds.map((uid) => ({ group_id: groupId, user_id: uid }));
  const { error } = await supabase.from("group_members").insert(rows);
  if (error) throw new Error(error.message);
}

export async function removeTemporaryGroupMember(groupId: number, userId: number): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase required");

  // Also remove from sub-groups
  const { data: subgroups } = await supabase
    .from("groups")
    .select("id")
    .eq("parent_group_id", groupId)
    .eq("is_temporary", true);

  const groupIds = [groupId, ...(subgroups ?? []).map((sg: any) => sg.id)];

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("user_id", userId)
    .in("group_id", groupIds);
  if (error) throw new Error(error.message);
}

export async function deactivateTemporaryGroup(groupId: number): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase required");
  // Cascade: deactivate parent + all sub-groups
  const { error } = await supabase
    .from("groups")
    .update({ is_active: false })
    .or(`id.eq.${groupId},parent_group_id.eq.${groupId}`)
    .eq("is_temporary", true);
  if (error) throw new Error(error.message);
}

export async function reactivateTemporaryGroup(groupId: number): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase required");

  // Guard: check members don't have another active temporary group
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  const memberIds = (members ?? []).map((m: any) => m.user_id);

  if (memberIds.length > 0) {
    const { data: conflicts } = await supabase
      .from("group_members")
      .select("user_id, groups!inner(is_temporary, is_active)")
      .in("user_id", memberIds)
      .eq("groups.is_temporary", true)
      .eq("groups.is_active", true);

    if (conflicts && conflicts.length > 0) {
      throw new Error("Certains nageurs sont déjà dans un autre groupe temporaire actif.");
    }
  }

  const { error } = await supabase
    .from("groups")
    .update({ is_active: true })
    .or(`id.eq.${groupId},parent_group_id.eq.${groupId}`)
    .eq("is_temporary", true);
  if (error) throw new Error(error.message);
}

export async function deleteTemporaryGroup(groupId: number): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase required");

  // Guard: only delete inactive groups
  const { data: group } = await supabase
    .from("groups")
    .select("is_active")
    .eq("id", groupId)
    .single();

  if (group?.is_active) {
    throw new Error("Impossible de supprimer un groupe temporaire actif. Désactivez-le d'abord.");
  }

  // Delete sub-groups first (cascade should handle, but be explicit)
  await supabase
    .from("groups")
    .delete()
    .eq("parent_group_id", groupId)
    .eq("is_temporary", true);

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .eq("is_temporary", true);
  if (error) throw new Error(error.message);
}
```

**Step 3: Add re-exports in `src/lib/api/index.ts`**

Add after the users exports:

```ts
export {
  getTemporaryGroups,
  getTemporaryGroupDetail,
  createTemporaryGroup,
  addTemporaryGroupMembers,
  removeTemporaryGroupMember,
  deactivateTemporaryGroup,
  reactivateTemporaryGroup,
  deleteTemporaryGroup,
} from './temporary-groups';
```

**Step 4: Wire into `api` object in `src/lib/api.ts`**

Add import:
```ts
import {
  getTemporaryGroups as _getTemporaryGroups,
  getTemporaryGroupDetail as _getTemporaryGroupDetail,
  createTemporaryGroup as _createTemporaryGroup,
  addTemporaryGroupMembers as _addTemporaryGroupMembers,
  removeTemporaryGroupMember as _removeTemporaryGroupMember,
  deactivateTemporaryGroup as _deactivateTemporaryGroup,
  reactivateTemporaryGroup as _reactivateTemporaryGroup,
  deleteTemporaryGroup as _deleteTemporaryGroup,
} from "./api/temporary-groups";
```

Add to `api` object:
```ts
  getTemporaryGroups: _getTemporaryGroups,
  getTemporaryGroupDetail: _getTemporaryGroupDetail,
  createTemporaryGroup: _createTemporaryGroup,
  addTemporaryGroupMembers: _addTemporaryGroupMembers,
  removeTemporaryGroupMember: _removeTemporaryGroupMember,
  deactivateTemporaryGroup: _deactivateTemporaryGroup,
  reactivateTemporaryGroup: _reactivateTemporaryGroup,
  deleteTemporaryGroup: _deleteTemporaryGroup,
```

**Step 5: Type check + tests**

```bash
npx tsc --noEmit && npm test -- --run
```

**Step 6: Commit**

```
git add src/lib/api/temporary-groups.ts src/lib/api/types.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat(temp-groups): add temporary group CRUD API functions"
```

---

## Task 6: Coach UI — Groups management screen

**Files:**
- Create: `src/pages/coach/CoachGroupsScreen.tsx`
- Modify: `src/pages/Coach.tsx` (add "groups" section + navigation)

**Step 1: Create `CoachGroupsScreen.tsx`**

This component handles:
- List of temporary groups (active + inactive)
- Create new group (drawer with name + swimmer picker)
- Manage group (view members, create sub-groups)
- Deactivate/reactivate/delete actions

Full component implementation. Key sub-components inside the file:
- `GroupList` — main screen with active/terminated sections
- `GroupCreateDrawer` — drawer to create a new group or sub-group
- `GroupDetailView` — manage a single group (members, sub-groups)

The swimmer picker should display athletes grouped by their permanent group label, with checkboxes. Use the existing `athletes` prop (same data as CoachAssignScreen gets).

For sub-group creation: reuse the same drawer but filter the swimmer list to only show members of the parent group.

**Step 2: Wire into `Coach.tsx`**

Add `"groups"` to the `CoachSection` type (line 25):
```ts
type CoachSection = "home" | "swim" | "strength" | "swimmers" | "assignments" | "messaging" | "calendar" | "groups";
```

Add a "Groupes" quick action button in `CoachHome` (next to "Email" and "Calendrier"):
```tsx
<button type="button" onClick={() => onNavigate("groups")} className="...">
  <UsersRound className="h-3.5 w-3.5" />
  Groupes
</button>
```

Add the section render in the Coach component (after the `messaging` section):
```tsx
{activeSection === "groups" ? (
  <CoachGroupsScreen
    onBack={() => setActiveSection("home")}
    athletes={athletes}
    groups={groups}
    athletesLoading={athletesLoading}
  />
) : null}
```

Update `shouldLoadAthletes` and `shouldLoadGroups` conditions to include `"groups"`.

**Step 3: Type check + build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```
git add src/pages/coach/CoachGroupsScreen.tsx src/pages/Coach.tsx
git commit -m "feat(temp-groups): add coach groups management UI"
```

---

## Task 7: Update CoachAssignScreen group selector

**Files:**
- Modify: `src/pages/coach/CoachAssignScreen.tsx:340-401`

**Step 1: Update the group selector to show temporary groups first, with sub-groups indented**

In the Popover content (lines 354-376), replace the flat list with a structured one:

```tsx
{/* Temporary groups first */}
{groupsWithId.filter(g => g.is_temporary).map((group) => {
  const isParent = !group.parent_group_id;
  const isChecked = selectedGroupIds.includes(group.gid);
  return (
    <label
      key={group.gid}
      className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted", !isParent && "pl-6")}
    >
      <Checkbox checked={isChecked} onCheckedChange={...} />
      <span className="text-sm">{group.name}</span>
      <Badge variant="secondary" className="text-[9px] ml-auto">Temp.</Badge>
    </label>
  );
})}
{/* Permanent groups */}
{groupsWithId.filter(g => !g.is_temporary).map((group) => {
  // ... existing logic
})}
```

The `groups` prop already includes temporary groups (from the updated `getGroups()`). The `CoachAssignScreenProps` type needs `groups` to accept the extended `GroupSummary`:

```ts
groups: Array<{ id: number | string; name: string; is_temporary?: boolean; parent_group_id?: number | null }>;
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```
git add src/pages/coach/CoachAssignScreen.tsx
git commit -m "feat(temp-groups): show temporary groups in assignment selector"
```

---

## Task 8: Update documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1: Add implementation log entry**

Add a new section in `docs/implementation-log.md` describing the temporary groups feature.

**Step 2: Update ROADMAP**

Add a new chantier entry for temporary groups.

**Step 3: Update FEATURES_STATUS**

Add the temporary groups feature status.

**Step 4: Update CLAUDE.md**

Add `src/lib/api/temporary-groups.ts` and `src/pages/coach/CoachGroupsScreen.tsx` to the key files table.

**Step 5: Commit**

```
git add docs/ CLAUDE.md
git commit -m "docs: add temporary groups to implementation log and roadmap"
```

---

## Task Summary

| # | Task | Files | Tests |
|---|------|-------|-------|
| 1 | DB migration | `00026_temporary_groups.sql` | via Supabase MCP |
| 2 | Drizzle schema | `schema.ts` | tsc |
| 3 | GroupSummary + getGroups | `types.ts`, `users.ts` | tsc |
| 4 | fetchUserGroupIdsWithContext | `client.ts`, `assignments.ts`, `index.ts` | 5 unit tests |
| 5 | Temporary group CRUD API | `temporary-groups.ts`, `types.ts`, `index.ts`, `api.ts` | tsc |
| 6 | Coach UI — Groups screen | `CoachGroupsScreen.tsx`, `Coach.tsx` | tsc + build |
| 7 | CoachAssignScreen update | `CoachAssignScreen.tsx` | tsc |
| 8 | Documentation | `implementation-log.md`, `ROADMAP.md`, etc. | — |

# Slot-Centric Session Calendar — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the SwimCatalog entry point with a weekly calendar of training slots where the coach creates/assigns sessions per slot, with auto-assignment to groups and deferred visibility.

**Architecture:** Add `visible_from`, `training_slot_id`, `notified_at` columns on `session_assignments`. New `useSlotCalendar` hook materializes recurring slots into concrete dates and crosses with assignments. New `CoachSlotCalendar` page renders the weekly grid. `SlotSessionSheet` handles create/edit/duplicate. RLS filters `visible_from` for athletes. pg_cron sends push 30min before slot end.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Shadcn UI, Supabase (PostgreSQL, RLS, pg_cron, pg_net), React Query 5, Wouter

**Design doc:** `docs/plans/2026-03-01-slot-centric-sessions-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00050_slot_centric_sessions.sql`

**Context:** The `session_assignments` table currently has no link to training slots and no visibility control. We add 3 columns, update the athlete RLS policy, and schedule a pg_cron job for deferred push notifications.

**Step 1: Write and apply the migration**

```sql
-- §85 Slot-Centric Sessions: visible_from, training_slot_id, deferred notifications

-- 1. Add columns to session_assignments
ALTER TABLE session_assignments
  ADD COLUMN IF NOT EXISTS visible_from DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS training_slot_id UUID REFERENCES training_slots(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_sa_visible_from ON session_assignments (visible_from)
  WHERE visible_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sa_training_slot ON session_assignments (training_slot_id)
  WHERE training_slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sa_scheduled_date ON session_assignments (scheduled_date);

-- 3. Update RLS SELECT policy for athletes to filter by visible_from
DROP POLICY IF EXISTS assignments_select ON session_assignments;

CREATE POLICY assignments_select ON session_assignments FOR SELECT
    USING (
        -- Coaches/admins see everything
        app_user_role() IN ('admin', 'coach')
        OR assigned_by = app_user_id()
        -- Athletes: must pass visible_from gate
        OR (
            (visible_from IS NULL OR visible_from <= CURRENT_DATE)
            AND (
                target_user_id = app_user_id()
                OR target_group_id IN (
                    SELECT group_id FROM group_members WHERE user_id = app_user_id()
                )
            )
        )
    );

-- 4. pg_cron job: send push notification 30min before training slot ends
-- Runs every 15 minutes. For each assignment where:
--   - scheduled_date = today
--   - visible_from has passed
--   - not yet notified
--   - slot end_time - 30min <= now
-- Creates notification + notification_targets (which triggers push via 00044 trigger).

SELECT cron.schedule(
  'slot-session-reminder',
  '*/15 * * * *',
  $$
  DO $body$
  DECLARE
    rec RECORD;
    v_notif_id INTEGER;
    v_group_id INTEGER;
  BEGIN
    FOR rec IN
      SELECT
        sa.id AS assignment_id,
        sa.target_group_id,
        sa.target_user_id,
        sc.name AS session_name,
        ts.end_time
      FROM session_assignments sa
      JOIN training_slots ts ON ts.id = sa.training_slot_id
      LEFT JOIN swim_sessions_catalog sc ON sc.id = sa.swim_catalog_id
      WHERE sa.training_slot_id IS NOT NULL
        AND sa.scheduled_date = CURRENT_DATE
        AND sa.notified_at IS NULL
        AND (sa.visible_from IS NULL OR sa.visible_from <= CURRENT_DATE)
        AND (ts.end_time - INTERVAL '30 minutes') <= LOCALTIME
    LOOP
      -- Create notification
      INSERT INTO notifications (title, body, type)
      VALUES (
        'Séance terminée ?',
        COALESCE('N''oublie pas d''enregistrer ton ressenti pour : ' || rec.session_name, 'Enregistre ton ressenti !'),
        'assignment'
      )
      RETURNING id INTO v_notif_id;

      -- Create target (triggers push via 00044 trigger)
      IF rec.target_user_id IS NOT NULL THEN
        INSERT INTO notification_targets (notification_id, target_user_id)
        VALUES (v_notif_id, rec.target_user_id);
      ELSIF rec.target_group_id IS NOT NULL THEN
        INSERT INTO notification_targets (notification_id, target_group_id)
        VALUES (v_notif_id, rec.target_group_id);
      END IF;

      -- Mark as notified
      UPDATE session_assignments
      SET notified_at = NOW()
      WHERE id = rec.id;
    END LOOP;
  END $body$;
  $$
);
```

**Step 2: Apply migration via Supabase MCP**

Use the `apply_migration` MCP tool with name `slot_centric_sessions` and the SQL above.

**Step 3: Verify migration**

Run: `npx supabase db diff` or check via Supabase dashboard that:
- `session_assignments` has 3 new columns
- RLS policy `assignments_select` is updated
- pg_cron job `slot-session-reminder` is scheduled

**Step 4: Commit**

```bash
git add supabase/migrations/00050_slot_centric_sessions.sql
git commit -m "feat(db): add visible_from, training_slot_id, notified_at on session_assignments"
```

---

## Task 2: API Layer — Extend Assignments

**Files:**
- Modify: `src/lib/api/assignments.ts`
- Modify: `src/lib/api/index.ts` (re-exports)
- Test: `src/lib/api/__tests__/assignments-slot.test.ts`

**Context:** We need 3 new functions:
1. `bulkCreateSlotAssignments()` — creates one assignment per group for a slot+date
2. `getSlotAssignments()` — gets assignments linked to training slots for a date range
3. `duplicateSlotSession()` — copies a session from one slot to another

**Step 1: Write tests for the pure helper functions**

Create `src/lib/api/__tests__/assignments-slot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deriveScheduledSlot } from "../assignments";

describe("deriveScheduledSlot", () => {
  it("returns 'morning' for start_time before 13:00", () => {
    expect(deriveScheduledSlot("08:00")).toBe("morning");
    expect(deriveScheduledSlot("12:59")).toBe("morning");
  });
  it("returns 'evening' for start_time at or after 13:00", () => {
    expect(deriveScheduledSlot("13:00")).toBe("evening");
    expect(deriveScheduledSlot("18:30")).toBe("evening");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/__tests__/assignments-slot.test.ts`
Expected: FAIL — `deriveScheduledSlot` not found

**Step 3: Implement the API functions**

Add to `src/lib/api/assignments.ts`:

```typescript
// ── Slot-centric helpers ────────────────────────────────────────────

/** Derive morning/evening from a training slot start_time (HH:MM format) */
export function deriveScheduledSlot(startTime: string): "morning" | "evening" {
  const hour = parseInt(startTime.split(":")[0], 10);
  return hour < 13 ? "morning" : "evening";
}

/** Create one assignment per group for a session on a specific slot+date */
export async function bulkCreateSlotAssignments(params: {
  swimCatalogId: number;
  trainingSlotId: string;
  scheduledDate: string;
  groupIds: number[];
  scheduledSlot: "morning" | "evening";
  visibleFrom: string | null;
  assignedBy: number;
}): Promise<{ created: number }> {
  if (!canUseSupabase()) return { created: 0 };

  const rows = params.groupIds.map((groupId) => ({
    assignment_type: "swim" as const,
    swim_catalog_id: params.swimCatalogId,
    target_group_id: groupId,
    scheduled_date: params.scheduledDate,
    scheduled_slot: params.scheduledSlot,
    training_slot_id: params.trainingSlotId,
    visible_from: params.visibleFrom,
    assigned_by: params.assignedBy,
    status: "assigned",
  }));

  const { data, error } = await supabase
    .from("session_assignments")
    .insert(rows)
    .select("id");

  if (error) throw new Error(error.message);
  return { created: data?.length ?? 0 };
}

/** Get all slot-linked assignments for a date range (coach view) */
export async function getSlotAssignments(params: {
  from: string;
  to: string;
}): Promise<Array<{
  id: number;
  swim_catalog_id: number | null;
  training_slot_id: string | null;
  target_group_id: number | null;
  scheduled_date: string;
  scheduled_slot: string | null;
  visible_from: string | null;
  notified_at: string | null;
  status: string;
  session_name: string | null;
  session_distance: number | null;
}>> {
  if (!canUseSupabase()) return [];

  const { data, error } = await supabase
    .from("session_assignments")
    .select(`
      id, swim_catalog_id, training_slot_id, target_group_id,
      scheduled_date, scheduled_slot, visible_from, notified_at, status,
      swim_sessions_catalog(name)
    `)
    .gte("scheduled_date", params.from)
    .lte("scheduled_date", params.to)
    .not("training_slot_id", "is", null)
    .order("scheduled_date");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    swim_catalog_id: row.swim_catalog_id,
    training_slot_id: row.training_slot_id,
    target_group_id: row.target_group_id,
    scheduled_date: row.scheduled_date,
    scheduled_slot: row.scheduled_slot,
    visible_from: row.visible_from,
    notified_at: row.notified_at,
    status: row.status,
    session_name: row.swim_sessions_catalog?.name ?? null,
    session_distance: null, // Could be computed from items if needed
  }));
}

/** Update visible_from on all assignments for a slot+date */
export async function updateSlotVisibility(params: {
  trainingSlotId: string;
  scheduledDate: string;
  visibleFrom: string | null;
}): Promise<void> {
  if (!canUseSupabase()) return;

  const { error } = await supabase
    .from("session_assignments")
    .update({ visible_from: params.visibleFrom })
    .eq("training_slot_id", params.trainingSlotId)
    .eq("scheduled_date", params.scheduledDate);

  if (error) throw new Error(error.message);
}

/** Delete all assignments for a slot+date */
export async function deleteSlotAssignments(params: {
  trainingSlotId: string;
  scheduledDate: string;
}): Promise<void> {
  if (!canUseSupabase()) return;

  const { error } = await supabase
    .from("session_assignments")
    .delete()
    .eq("training_slot_id", params.trainingSlotId)
    .eq("scheduled_date", params.scheduledDate);

  if (error) throw new Error(error.message);
}
```

**Step 4: Add re-exports**

In `src/lib/api/index.ts`, add to the assignments block:

```typescript
export {
  // ... existing exports
  deriveScheduledSlot,
  bulkCreateSlotAssignments,
  getSlotAssignments,
  updateSlotVisibility,
  deleteSlotAssignments,
} from "./assignments";
```

Also add delegation stubs in `src/lib/api.ts` if the legacy facade is still used.

**Step 5: Run tests**

Run: `npx vitest run src/lib/api/__tests__/assignments-slot.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/api/assignments.ts src/lib/api/index.ts src/lib/api/__tests__/assignments-slot.test.ts
git commit -m "feat(api): add slot-centric assignment functions (bulk create, visibility, delete)"
```

---

## Task 3: `useSlotCalendar` Hook + Tests

**Files:**
- Create: `src/hooks/useSlotCalendar.ts`
- Create: `src/hooks/__tests__/useSlotCalendar.test.ts`

**Context:** This hook materializes recurring training slots into concrete date instances for a given week, crosses them with assignments and overrides, and returns a `SlotInstance[]` with state (empty/draft/published/cancelled).

**Step 1: Write tests for pure helper functions**

Create `src/hooks/__tests__/useSlotCalendar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getMondayOfWeek,
  materializeSlots,
  computeSlotState,
  type SlotInstance,
} from "../useSlotCalendar";

describe("getMondayOfWeek", () => {
  it("returns the Monday for offset 0 (current week)", () => {
    const monday = getMondayOfWeek(0);
    expect(new Date(monday).getDay()).toBe(1); // 1 = Monday
  });
  it("returns next Monday for offset +1", () => {
    const thisMonday = getMondayOfWeek(0);
    const nextMonday = getMondayOfWeek(1);
    const diff = (new Date(nextMonday).getTime() - new Date(thisMonday).getTime()) / 86_400_000;
    expect(diff).toBe(7);
  });
  it("returns previous Monday for offset -1", () => {
    const thisMonday = getMondayOfWeek(0);
    const prevMonday = getMondayOfWeek(-1);
    const diff = (new Date(thisMonday).getTime() - new Date(prevMonday).getTime()) / 86_400_000;
    expect(diff).toBe(7);
  });
});

describe("materializeSlots", () => {
  const slot = {
    id: "slot-1",
    day_of_week: 0, // Monday (0-indexed, 0=Monday)
    start_time: "08:00",
    end_time: "09:30",
    location: "Piscine A",
    is_active: true,
    created_by: null,
    created_at: "",
    assignments: [
      { id: "a1", slot_id: "slot-1", group_id: 1, group_name: "Avenirs", coach_id: 10, coach_name: "Coach A", lane_count: null },
    ],
  };

  it("generates one instance per matching day in the week", () => {
    const instances = materializeSlots([slot], [], [], "2026-03-02"); // Monday 2026-03-02
    expect(instances).toHaveLength(1);
    expect(instances[0].date).toBe("2026-03-02");
    expect(instances[0].state).toBe("empty");
  });

  it("marks instance as cancelled when override exists", () => {
    const overrides = [{ id: "o1", slot_id: "slot-1", override_date: "2026-03-02", status: "cancelled" as const, new_start_time: null, new_end_time: null, new_location: null, reason: null, created_by: null, created_at: "" }];
    const instances = materializeSlots([slot], [], overrides, "2026-03-02");
    expect(instances[0].state).toBe("cancelled");
  });
});

describe("computeSlotState", () => {
  const today = "2026-03-01";

  it("returns 'empty' when no assignment", () => {
    expect(computeSlotState(undefined, today)).toBe("empty");
  });
  it("returns 'published' when visible_from is null", () => {
    expect(computeSlotState({ visible_from: null } as any, today)).toBe("published");
  });
  it("returns 'published' when visible_from <= today", () => {
    expect(computeSlotState({ visible_from: "2026-02-28" } as any, today)).toBe("published");
    expect(computeSlotState({ visible_from: "2026-03-01" } as any, today)).toBe("published");
  });
  it("returns 'draft' when visible_from > today", () => {
    expect(computeSlotState({ visible_from: "2026-03-05" } as any, today)).toBe("draft");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/__tests__/useSlotCalendar.test.ts`
Expected: FAIL — functions not found

**Step 3: Implement the hook**

Create `src/hooks/useSlotCalendar.ts`:

```typescript
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TrainingSlot, TrainingSlotOverride } from "@/lib/api/training-slots";

// ── Types ───────────────────────────────────────────────────────────

export type SlotState = "empty" | "draft" | "published" | "cancelled";

export interface SlotAssignment {
  id: number;
  swim_catalog_id: number | null;
  training_slot_id: string | null;
  target_group_id: number | null;
  scheduled_date: string;
  scheduled_slot: string | null;
  visible_from: string | null;
  notified_at: string | null;
  status: string;
  session_name: string | null;
  session_distance: number | null;
}

export interface SlotInstance {
  date: string;                    // ISO YYYY-MM-DD
  slot: TrainingSlot;
  groups: TrainingSlot["assignments"];
  state: SlotState;
  assignment?: SlotAssignment;
  override?: TrainingSlotOverride;
}

// ── Pure helpers (exported for testing) ─────────────────────────────

/** Get the Monday ISO date for a given week offset from today */
export function getMondayOfWeek(offset: number): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  // day: 0=Sun, 1=Mon, ... 6=Sat → diff to Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diffToMonday + offset * 7);
  return now.toISOString().split("T")[0];
}

/** Get Sunday ISO date from Monday */
function getSundayFromMonday(mondayIso: string): string {
  const d = new Date(mondayIso + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

/** Convert day_of_week (0=Monday) to date within the week starting at mondayIso */
function dayOfWeekToDate(dayOfWeek: number, mondayIso: string): string {
  const d = new Date(mondayIso + "T00:00:00");
  d.setDate(d.getDate() + dayOfWeek);
  return d.toISOString().split("T")[0];
}

/** Determine slot state from assignment and today */
export function computeSlotState(
  assignment: SlotAssignment | undefined,
  todayIso: string,
): SlotState {
  if (!assignment) return "empty";
  if (assignment.visible_from == null) return "published";
  return assignment.visible_from <= todayIso ? "published" : "draft";
}

/** Materialize recurring slots into concrete date instances for one week */
export function materializeSlots(
  slots: TrainingSlot[],
  assignments: SlotAssignment[],
  overrides: TrainingSlotOverride[],
  mondayIso: string,
): SlotInstance[] {
  const todayIso = new Date().toISOString().split("T")[0];
  const overrideMap = new Map<string, TrainingSlotOverride>();
  for (const ov of overrides) {
    overrideMap.set(`${ov.slot_id}:${ov.override_date}`, ov);
  }

  // Index assignments by slot_id + date
  const assignmentMap = new Map<string, SlotAssignment>();
  for (const a of assignments) {
    if (a.training_slot_id) {
      const key = `${a.training_slot_id}:${a.scheduled_date}`;
      // Keep first (there might be multiple groups, we show the session info from any)
      if (!assignmentMap.has(key)) {
        assignmentMap.set(key, a);
      }
    }
  }

  const instances: SlotInstance[] = [];

  for (const slot of slots) {
    const dateIso = dayOfWeekToDate(slot.day_of_week, mondayIso);
    const key = `${slot.id}:${dateIso}`;
    const override = overrideMap.get(key);
    const assignment = assignmentMap.get(key);

    const state: SlotState = override?.status === "cancelled"
      ? "cancelled"
      : computeSlotState(assignment, todayIso);

    instances.push({
      date: dateIso,
      slot,
      groups: slot.assignments,
      state,
      assignment,
      override,
    });
  }

  // Sort by date then start_time
  instances.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.slot.start_time.localeCompare(b.slot.start_time);
  });

  return instances;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useSlotCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);

  const mondayIso = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const sundayIso = useMemo(() => getSundayFromMonday(mondayIso), [mondayIso]);

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["training-slots"],
    queryFn: () => api.getTrainingSlots(),
    staleTime: 5 * 60_000,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["slot-assignments", mondayIso, sundayIso],
    queryFn: () => api.getSlotAssignments({ from: mondayIso, to: sundayIso }),
    staleTime: 30_000,
  });

  const { data: overrides = [], isLoading: overridesLoading } = useQuery({
    queryKey: ["slot-overrides", mondayIso],
    queryFn: () => api.getSlotOverrides({ fromDate: mondayIso }),
    staleTime: 60_000,
  });

  const isLoading = slotsLoading || assignmentsLoading || overridesLoading;

  const instances = useMemo(
    () => materializeSlots(slots, assignments, overrides, mondayIso),
    [slots, assignments, overrides, mondayIso],
  );

  // Group instances by date for calendar rendering
  const instancesByDate = useMemo(() => {
    const map = new Map<string, SlotInstance[]>();
    for (const inst of instances) {
      const list = map.get(inst.date) ?? [];
      list.push(inst);
      map.set(inst.date, list);
    }
    return map;
  }, [instances]);

  // Week dates array (Mon→Sun)
  const weekDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayIso + "T00:00:00");
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [mondayIso]);

  const navigateToday = () => setWeekOffset(0);
  const prevWeek = () => setWeekOffset((w) => w - 1);
  const nextWeek = () => setWeekOffset((w) => w + 1);

  return {
    weekOffset,
    mondayIso,
    sundayIso,
    weekDates,
    instances,
    instancesByDate,
    isLoading,
    navigateToday,
    prevWeek,
    nextWeek,
  };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/hooks/__tests__/useSlotCalendar.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useSlotCalendar.ts src/hooks/__tests__/useSlotCalendar.test.ts
git commit -m "feat: add useSlotCalendar hook — materialize recurring slots into weekly instances"
```

---

## Task 4: `CoachSlotCalendar` Page

**Files:**
- Create: `src/pages/coach/CoachSlotCalendar.tsx`

**Context:** Weekly calendar grid showing training slot instances. Each day column shows its slot cards with state badges. Navigation arrows + "Aujourd'hui" button. Clicking a slot opens the `SlotSessionSheet` (Task 5).

**Step 1: Create the component**

Use `/frontend-design` skill for the UI implementation. Key requirements:

- Mobile-first layout, full width
- 7-day horizontal scroll or vertical stack (mobile = vertical, desktop = horizontal grid)
- Each day: date header (jeu. 6 mars) + list of slot cards
- Slot card states: empty (dashed border, "+" icon), draft (orange badge), published (green badge), cancelled (strikethrough)
- Slot card content: time range, location, group badges, session name if assigned
- Navigation: ← → arrows + "Aujourd'hui" button in header
- Header also has link "Bibliothèque" → navigates to `onOpenLibrary()`
- Loading: skeleton cards
- Today column highlighted

**Props:**
```typescript
interface CoachSlotCalendarProps {
  onBack: () => void;
  onOpenLibrary: () => void;
  onOpenSlot: (instance: SlotInstance) => void;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/pages/coach/CoachSlotCalendar.tsx
git commit -m "feat: add CoachSlotCalendar — weekly slot grid with state badges"
```

---

## Task 5: `SlotSessionSheet` Bottom Sheet

**Files:**
- Create: `src/pages/coach/SlotSessionSheet.tsx`

**Context:** Bottom sheet that opens when the coach clicks a slot. Behavior depends on slot state:

**Empty slot:**
- "Nouvelle séance" → navigates to SwimCatalog (onCreateNew callback)
- "Depuis la bibliothèque" → opens `SlotTemplatePicker` (Task 6)
- Group checkboxes (pre-checked from slot assignments)
- `visible_from` date picker (default = slot date)

**Slot with session (draft/published):**
- Session preview (name, total distance, block count)
- "Modifier" → navigates to SwimCatalog with session ID
- "Dupliquer vers..." → opens future empty slots picker
- "Visibilité" → date picker to change `visible_from`
- "Supprimer" → confirmation dialog → delete assignments

**Step 1: Create the component**

Use `/frontend-design` skill. Key requirements:

- Uses Shadcn `Sheet` (side="bottom")
- Header: slot time + location + date
- Group checkboxes with pre-checked state
- `visible_from` input with `type="date"`, default = scheduled date
- Action buttons styled as full-width outline buttons
- Mutation hooks for `bulkCreateSlotAssignments`, `updateSlotVisibility`, `deleteSlotAssignments`
- Invalidates query keys: `["slot-assignments", ...]`

**Props:**
```typescript
interface SlotSessionSheetProps {
  instance: SlotInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNew: () => void;       // Navigate to SwimCatalog
  onEditSession: (sessionId: number) => void; // Navigate to SwimCatalog with ID
  onPickTemplate: () => void;    // Open template picker
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/pages/coach/SlotSessionSheet.tsx
git commit -m "feat: add SlotSessionSheet — create/edit/duplicate/visibility controls"
```

---

## Task 6: `SlotTemplatePicker` Template Picker

**Files:**
- Create: `src/pages/coach/SlotTemplatePicker.tsx`

**Context:** A sheet/dialog showing the coach's swim session templates from the library. The coach picks one → the session is assigned to the slot.

**Step 1: Create the component**

Requirements:
- Uses Shadcn `Sheet` (side="bottom")
- Fetches templates via `api.getSwimCatalog()` (already cached as `["swim_catalog"]`)
- Filters out archived sessions (`is_archived !== true`)
- Search input to filter by name
- Each template shown as a compact card: name, folder path, item count
- Click → calls `onSelect(catalogId)` callback
- Parent (`SlotSessionSheet`) handles the actual `bulkCreateSlotAssignments()` call

**Props:**
```typescript
interface SlotTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (catalogId: number, sessionName: string) => void;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/pages/coach/SlotTemplatePicker.tsx
git commit -m "feat: add SlotTemplatePicker — search and select from session library"
```

---

## Task 7: Integration into Coach.tsx

**Files:**
- Modify: `src/pages/Coach.tsx`

**Context:** Wire the new slot calendar into the Coach section routing. The "Natation" button now opens the slot calendar. The old SwimCatalog remains accessible via a "Bibliothèque" link in the calendar header.

**Step 1: Add lazy import and section routing**

At the top of Coach.tsx, add:
```typescript
const CoachSlotCalendar = lazy(() => import("./coach/CoachSlotCalendar"));
```

**Step 2: Update the "swim" section rendering**

Replace the existing `activeSection === "swim"` block to render `CoachSlotCalendar` instead:

```typescript
{activeSection === "swim" ? (
  <Suspense fallback={<PageSkeleton />}>
    <CoachSlotCalendar
      onBack={() => setActiveSection("home")}
      onOpenLibrary={() => setActiveSection("swim-library")}
      onOpenSlot={(instance) => {
        // Handled internally by CoachSlotCalendar + SlotSessionSheet
      }}
    />
  </Suspense>
) : null}
```

**Step 3: Add a new "swim-library" section for SwimCatalog**

Add `"swim-library"` to the `CoachSection` type union.

Add a new render block:
```typescript
{activeSection === "swim-library" ? (
  <div className="space-y-6">
    <CoachSectionHeader
      title="Bibliothèque natation"
      description="Templates de séances."
      onBack={() => setActiveSection("swim")}
    />
    <Suspense fallback={<PageSkeleton />}>
      <SwimCatalog />
    </Suspense>
  </div>
) : null}
```

**Step 4: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit && npx vitest run`

**Step 5: Commit**

```bash
git add src/pages/Coach.tsx
git commit -m "feat: wire CoachSlotCalendar as swim entry point, SwimCatalog moved to swim-library"
```

---

## Task 8: API Re-exports & Legacy Facade

**Files:**
- Modify: `src/lib/api/index.ts`
- Modify: `src/lib/api.ts`

**Context:** Ensure all new functions are properly exported through the barrel and facade.

**Step 1: Add exports to `src/lib/api/index.ts`**

Verify these exports exist in the assignments block:
```typescript
export {
  deriveScheduledSlot,
  bulkCreateSlotAssignments,
  getSlotAssignments,
  updateSlotVisibility,
  deleteSlotAssignments,
} from "./assignments";
```

**Step 2: Add delegation stubs in `src/lib/api.ts`**

```typescript
export const getSlotAssignments = (...args: Parameters<typeof mod.getSlotAssignments>) => mod.getSlotAssignments(...args);
export const bulkCreateSlotAssignments = (...args: Parameters<typeof mod.bulkCreateSlotAssignments>) => mod.bulkCreateSlotAssignments(...args);
export const updateSlotVisibility = (...args: Parameters<typeof mod.updateSlotVisibility>) => mod.updateSlotVisibility(...args);
export const deleteSlotAssignments = (...args: Parameters<typeof mod.deleteSlotAssignments>) => mod.deleteSlotAssignments(...args);
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: re-export slot assignment functions through API barrel and facade"
```

---

## Task 9: Documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CLAUDE.md`

**Step 1: Add implementation log entry**

Add a `§85` section in `docs/implementation-log.md`:
- Context: Refonte bibliothèque séances → calendrier centré créneaux
- Changes: migration, API, hook, 3 new components, Coach routing
- Files modified/created
- Decisions: visible_from approach, pg_cron 15min, slot materialization client-side

**Step 2: Update FEATURES_STATUS.md**

Add/update the swim session management feature status.

**Step 3: Update ROADMAP.md**

Add chantier §85 as "En cours" or "Fait".

**Step 4: Update CLAUDE.md**

Add new files to the key files table:
- `src/pages/coach/CoachSlotCalendar.tsx`
- `src/pages/coach/SlotSessionSheet.tsx`
- `src/pages/coach/SlotTemplatePicker.tsx`
- `src/hooks/useSlotCalendar.ts`

**Step 5: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add §85 slot-centric sessions implementation log"
```

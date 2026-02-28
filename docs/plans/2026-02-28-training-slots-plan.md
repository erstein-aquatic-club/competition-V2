# Training Slots (Créneaux d'entraînement) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recurring weekly training slot management — coaches define slots (day + time + location), assign groups/coaches/lanes, and manage per-date exceptions. Swimmers see their schedule read-only.

**Architecture:** 3 new Supabase tables (`training_slots`, `training_slot_assignments`, `training_slot_overrides`) with RLS. New API module `src/lib/api/training-slots.ts`. New coach screen `CoachTrainingSlotsScreen.tsx`. Swimmer schedule section in existing profile/dashboard.

**Tech Stack:** Supabase (PostgreSQL + RLS), React 19, TypeScript, Tailwind CSS 4, Shadcn components, React Query 5, Zustand

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00041_training_slots.sql`

**Step 1: Write the migration**

```sql
-- Training Slots: recurring weekly time slots for training
-- Design doc: docs/plans/2026-02-28-training-slots-design.md

-- ── training_slots ──────────────────────────────────────────
CREATE TABLE training_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CHECK (end_time > start_time),
  UNIQUE (day_of_week, start_time, end_time, location)
);

-- ── training_slot_assignments ───────────────────────────────
CREATE TABLE training_slot_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES training_slots(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  coach_id INTEGER NOT NULL REFERENCES users(id),
  lane_count SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, group_id)
);

-- ── training_slot_overrides ─────────────────────────────────
CREATE TABLE training_slot_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES training_slots(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('cancelled', 'modified')),
  new_start_time TIME,
  new_end_time TIME,
  new_location TEXT,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, override_date)
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE training_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_slot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_slot_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
CREATE POLICY "training_slots_select" ON training_slots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_slot_assignments_select" ON training_slot_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_slot_overrides_select" ON training_slot_overrides
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: coach only
CREATE POLICY "training_slots_coach_insert" ON training_slots
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slots_coach_update" ON training_slots
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'))
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slots_coach_delete" ON training_slots
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_assignments_coach_insert" ON training_slot_assignments
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_assignments_coach_update" ON training_slot_assignments
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'))
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_assignments_coach_delete" ON training_slot_assignments
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_overrides_coach_insert" ON training_slot_overrides
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_overrides_coach_update" ON training_slot_overrides
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'))
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_overrides_coach_delete" ON training_slot_overrides
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_training_slots_day ON training_slots (day_of_week) WHERE is_active = true;
CREATE INDEX idx_training_slot_assignments_slot ON training_slot_assignments (slot_id);
CREATE INDEX idx_training_slot_assignments_group ON training_slot_assignments (group_id);
CREATE INDEX idx_training_slot_overrides_slot_date ON training_slot_overrides (slot_id, override_date);
```

**Step 2: Apply migration to Supabase**

Use the Supabase MCP `apply_migration` tool with project ID `jvbtfuxmyffftwkmyqxd`, name `training_slots`, and the SQL above.

**Step 3: Verify tables exist**

Run: `mcp__claude_ai_Supabase__list_tables` with schemas `["public"]` and confirm the 3 new tables appear.

**Step 4: Commit**

```bash
git add supabase/migrations/00041_training_slots.sql
git commit -m "feat: add training_slots tables with RLS (§76)"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/api/types.ts` (append at end)

**Step 1: Add types**

Append these interfaces at the end of `src/lib/api/types.ts`:

```typescript
// ── Training Slots ──────────────────────────────────────────

export interface TrainingSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  assignments: TrainingSlotAssignment[];
}

export interface TrainingSlotAssignment {
  id: string;
  slot_id: string;
  group_id: number;
  group_name: string;
  coach_id: number;
  coach_name: string;
  lane_count: number | null;
}

export interface TrainingSlotOverride {
  id: string;
  slot_id: string;
  override_date: string;
  status: 'cancelled' | 'modified';
  new_start_time: string | null;
  new_end_time: string | null;
  new_location: string | null;
  reason: string | null;
  created_by: number | null;
  created_at: string;
}

export interface TrainingSlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  assignments: Array<{
    group_id: number;
    coach_id: number;
    lane_count: number | null;
  }>;
}

export interface TrainingSlotOverrideInput {
  slot_id: string;
  override_date: string;
  status: 'cancelled' | 'modified';
  new_start_time?: string | null;
  new_end_time?: string | null;
  new_location?: string | null;
  reason?: string | null;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors from these types.

**Step 3: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat: add TrainingSlot types (§76)"
```

---

### Task 3: API Module

**Files:**
- Create: `src/lib/api/training-slots.ts`

**Step 1: Write the API module**

Follow the pattern from `src/lib/api/absences.ts` and `src/lib/api/competitions.ts`. Use `supabase` client and `canUseSupabase()` guard. Key functions:

```typescript
/**
 * API Training Slots - Recurring weekly training schedule management
 */

import { supabase, canUseSupabase } from "./client";
import type {
  TrainingSlot,
  TrainingSlotAssignment,
  TrainingSlotOverride,
  TrainingSlotInput,
  TrainingSlotOverrideInput,
} from "./types";

// ── GET all active slots with assignments ───────────────────

export async function getTrainingSlots(): Promise<TrainingSlot[]> {
  if (!canUseSupabase()) return [];

  // Fetch slots
  const { data: slots, error: slotsErr } = await supabase
    .from("training_slots")
    .select("*")
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");
  if (slotsErr) throw new Error(slotsErr.message);
  if (!slots || slots.length === 0) return [];

  // Fetch all assignments for active slots
  const slotIds = slots.map((s: any) => s.id);
  const { data: assignments, error: assignErr } = await supabase
    .from("training_slot_assignments")
    .select("*, groups:group_id(name), coach:coach_id(display_name)")
    .in("slot_id", slotIds);
  if (assignErr) throw new Error(assignErr.message);

  // Build lookup
  const assignmentsBySlot = new Map<string, TrainingSlotAssignment[]>();
  for (const a of assignments ?? []) {
    const mapped: TrainingSlotAssignment = {
      id: a.id,
      slot_id: a.slot_id,
      group_id: a.group_id,
      group_name: (a as any).groups?.name ?? "?",
      coach_id: a.coach_id,
      coach_name: (a as any).coach?.display_name ?? "?",
      lane_count: a.lane_count,
    };
    const list = assignmentsBySlot.get(a.slot_id) ?? [];
    list.push(mapped);
    assignmentsBySlot.set(a.slot_id, list);
  }

  return slots.map((s: any) => ({
    id: s.id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    location: s.location,
    is_active: s.is_active,
    created_by: s.created_by,
    created_at: s.created_at,
    assignments: assignmentsBySlot.get(s.id) ?? [],
  }));
}

// ── GET slots for a specific group (swimmer view) ───────────

export async function getTrainingSlotsForGroup(groupId: number): Promise<TrainingSlot[]> {
  const allSlots = await getTrainingSlots();
  return allSlots.filter((s) => s.assignments.some((a) => a.group_id === groupId));
}

// ── CREATE slot + assignments ───────────────────────────────

export async function createTrainingSlot(input: TrainingSlotInput): Promise<TrainingSlot> {
  if (!canUseSupabase()) throw new Error("Supabase not available");

  const { data: slot, error: slotErr } = await supabase
    .from("training_slots")
    .insert({
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location,
    })
    .select()
    .single();
  if (slotErr) throw new Error(slotErr.message);

  const assignmentRows = input.assignments.map((a) => ({
    slot_id: slot.id,
    group_id: a.group_id,
    coach_id: a.coach_id,
    lane_count: a.lane_count,
  }));

  if (assignmentRows.length > 0) {
    const { error: assignErr } = await supabase
      .from("training_slot_assignments")
      .insert(assignmentRows);
    if (assignErr) throw new Error(assignErr.message);
  }

  // Re-fetch to get joined names
  const allSlots = await getTrainingSlots();
  return allSlots.find((s) => s.id === slot.id)!;
}

// ── UPDATE slot + sync assignments ──────────────────────────

export async function updateTrainingSlot(slotId: string, input: TrainingSlotInput): Promise<TrainingSlot> {
  if (!canUseSupabase()) throw new Error("Supabase not available");

  // Update slot fields
  const { error: slotErr } = await supabase
    .from("training_slots")
    .update({
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location,
    })
    .eq("id", slotId);
  if (slotErr) throw new Error(slotErr.message);

  // Replace assignments: delete all then re-insert
  const { error: delErr } = await supabase
    .from("training_slot_assignments")
    .delete()
    .eq("slot_id", slotId);
  if (delErr) throw new Error(delErr.message);

  const assignmentRows = input.assignments.map((a) => ({
    slot_id: slotId,
    group_id: a.group_id,
    coach_id: a.coach_id,
    lane_count: a.lane_count,
  }));

  if (assignmentRows.length > 0) {
    const { error: assignErr } = await supabase
      .from("training_slot_assignments")
      .insert(assignmentRows);
    if (assignErr) throw new Error(assignErr.message);
  }

  const allSlots = await getTrainingSlots();
  return allSlots.find((s) => s.id === slotId)!;
}

// ── DELETE (soft) slot ──────────────────────────────────────

export async function deleteTrainingSlot(slotId: string): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase
    .from("training_slots")
    .update({ is_active: false })
    .eq("id", slotId);
  if (error) throw new Error(error.message);
}

// ── OVERRIDES ───────────────────────────────────────────────

export async function getSlotOverrides(options?: {
  slotId?: string;
  fromDate?: string;
}): Promise<TrainingSlotOverride[]> {
  if (!canUseSupabase()) return [];
  let query = supabase
    .from("training_slot_overrides")
    .select("*")
    .order("override_date", { ascending: true });
  if (options?.slotId) query = query.eq("slot_id", options.slotId);
  if (options?.fromDate) query = query.gte("override_date", options.fromDate);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingSlotOverride[];
}

export async function createSlotOverride(input: TrainingSlotOverrideInput): Promise<TrainingSlotOverride> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("training_slot_overrides")
    .upsert(
      {
        slot_id: input.slot_id,
        override_date: input.override_date,
        status: input.status,
        new_start_time: input.new_start_time ?? null,
        new_end_time: input.new_end_time ?? null,
        new_location: input.new_location ?? null,
        reason: input.reason ?? null,
      },
      { onConflict: "slot_id,override_date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TrainingSlotOverride;
}

export async function deleteSlotOverride(overrideId: string): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase
    .from("training_slot_overrides")
    .delete()
    .eq("id", overrideId);
  if (error) throw new Error(error.message);
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/api/training-slots.ts
git commit -m "feat: add training-slots API module (§76)"
```

---

### Task 4: Wire API Module Into Exports

**Files:**
- Modify: `src/lib/api/index.ts` — add re-exports for training-slots
- Modify: `src/lib/api.ts` — add type re-exports + delegation stubs
- Modify: `src/lib/api/types.ts` — already done in Task 2 (re-export check only)

**Step 1: Add re-exports to `src/lib/api/index.ts`**

Append after the interviews export block (~line 246):

```typescript
export {
  getTrainingSlots,
  getTrainingSlotsForGroup,
  createTrainingSlot,
  updateTrainingSlot,
  deleteTrainingSlot,
  getSlotOverrides,
  createSlotOverride,
  deleteSlotOverride,
} from './training-slots';
```

**Step 2: Add imports + delegation stubs to `src/lib/api.ts`**

Add import block (after the interviews import block, ~line 235):

```typescript
import {
  getTrainingSlots as _getTrainingSlots,
  getTrainingSlotsForGroup as _getTrainingSlotsForGroup,
  createTrainingSlot as _createTrainingSlot,
  updateTrainingSlot as _updateTrainingSlot,
  deleteTrainingSlot as _deleteTrainingSlot,
  getSlotOverrides as _getSlotOverrides,
  createSlotOverride as _createSlotOverride,
  deleteSlotOverride as _deleteSlotOverride,
} from './api/training-slots';
```

Add delegation stubs inside the `api` object (before closing `};`):

```typescript
  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Training Slots
  // ══════════════════════════════════════════════════════════════════
  async getTrainingSlots() { return _getTrainingSlots(); },
  async getTrainingSlotsForGroup(groupId: number) { return _getTrainingSlotsForGroup(groupId); },
  async createTrainingSlot(input: Parameters<typeof _createTrainingSlot>[0]) { return _createTrainingSlot(input); },
  async updateTrainingSlot(slotId: string, input: Parameters<typeof _updateTrainingSlot>[1]) { return _updateTrainingSlot(slotId, input); },
  async deleteTrainingSlot(slotId: string) { return _deleteTrainingSlot(slotId); },
  async getSlotOverrides(options?: Parameters<typeof _getSlotOverrides>[0]) { return _getSlotOverrides(options); },
  async createSlotOverride(input: Parameters<typeof _createSlotOverride>[0]) { return _createSlotOverride(input); },
  async deleteSlotOverride(overrideId: string) { return _deleteSlotOverride(overrideId); },
```

Add type re-exports in the type block at the top of `src/lib/api.ts` (~line 1-58):

```typescript
export type {
  // ... existing types ...
  TrainingSlot,
  TrainingSlotAssignment,
  TrainingSlotOverride,
  TrainingSlotInput,
  TrainingSlotOverrideInput,
} from "./api/types";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: wire training-slots API into exports (§76)"
```

---

### Task 5: Coach Screen — `CoachTrainingSlotsScreen.tsx`

**Files:**
- Create: `src/pages/coach/CoachTrainingSlotsScreen.tsx`

**Step 1: Write the coach screen**

This is the main implementation file. Follow the patterns from `CoachGroupsScreen.tsx` and `CoachCompetitionsScreen.tsx`:

- Use `CoachSectionHeader` with title "Créneaux" and description
- Use `useQuery` with key `["training-slots"]` to fetch all slots
- Use `useQuery` with key `["training-slot-overrides", "upcoming"]` to fetch upcoming overrides
- Use `useMutation` + `useQueryClient` for create/update/delete operations
- Group slots by `day_of_week` (1=Lun → 7=Dim) with day labels in French
- Each slot rendered as a Card with assignments listed inside
- Sheet for create/edit with dynamic assignment rows
- Sheet for exceptions
- AlertDialog for delete confirmation

Key UI constants:

```typescript
const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
```

Props pattern (matches other coach screens):

```typescript
type CoachTrainingSlotsScreenProps = {
  onBack: () => void;
  groups: Array<{ id: number | string; name: string }>;
  coaches: Array<{ id: number; display_name: string }>;
};
```

The screen needs a list of coaches. Fetch coaches from `api.listUsers({ role: 'coach' })` or receive them as props. Check how `CoachSmsScreen` or others handle this.

Components within the screen:
1. **SlotCard** — renders one slot with its assignments
2. **SlotFormSheet** — Sheet for creating/editing a slot (day, times, location, dynamic assignments)
3. **OverrideFormSheet** — Sheet for creating an exception
4. **OverridesList** — inline collapsible showing exceptions for a slot

Shadcn components to use: `Card`, `Sheet`, `Button`, `Input`, `Select`, `Badge`, `AlertDialog`, `Separator`, `Collapsible`.

Lucide icons: `Clock`, `MapPin`, `Users`, `Plus`, `Pencil`, `Trash2`, `AlertTriangle`, `ArrowLeft`.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Verify dev server renders the screen**

Run: `npm run dev`, navigate to the coach section, click the new "Créneaux" button (added in next task) and confirm the screen renders without errors.

**Step 4: Commit**

```bash
git add src/pages/coach/CoachTrainingSlotsScreen.tsx
git commit -m "feat: add CoachTrainingSlotsScreen UI (§76)"
```

---

### Task 6: Integrate Into Coach Navigation

**Files:**
- Modify: `src/pages/Coach.tsx`

**Step 1: Add import**

Add import at top with other coach screen imports (~line 19):

```typescript
import CoachTrainingSlotsScreen from "./coach/CoachTrainingSlotsScreen";
```

**Step 2: Add "training-slots" to CoachSection type**

Change line 28:

```typescript
type CoachSection = "home" | "swim" | "strength" | "swimmers" | "messaging" | "sms" | "calendar" | "groups" | "competitions" | "objectives" | "training-slots";
```

**Step 3: Add navigation button in CoachHome grid**

In the navigation grid section (~line 188-255), add a new button for "Créneaux":

```tsx
<button
  type="button"
  onClick={() => onNavigate("training-slots")}
  className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  <Clock className="h-5 w-5 text-primary mb-2" />
  <p className="text-sm font-bold">Créneaux</p>
  <p className="text-xs text-muted-foreground">Planning hebdo</p>
</button>
```

Import `Clock` from lucide-react in the existing import line.

**Step 4: Add the shouldLoadGroups condition**

In the coach main component, add `"training-slots"` to the `shouldLoadGroups` condition (~line 339):

```typescript
const shouldLoadGroups = activeSection === "messaging" || activeSection === "sms" || activeSection === "calendar" || activeSection === "groups" || activeSection === "training-slots";
```

**Step 5: Add conditional render**

After the objectives section (~line 591), add:

```tsx
{activeSection === "training-slots" ? (
  <CoachTrainingSlotsScreen
    onBack={() => setActiveSection("home")}
    groups={groups}
  />
) : null}
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add src/pages/Coach.tsx
git commit -m "feat: integrate training-slots into coach navigation (§76)"
```

---

### Task 7: Swimmer Schedule View (Read-Only)

**Files:**
- Modify: Athlete profile or dashboard page to add "Mon planning" section

**Step 1: Determine where to add the section**

Check the swimmer profile page. The section should show the swimmer's group training schedule as a compact list. Add it as a collapsible section in the athlete profile or in the Dashboard below the calendar.

**Step 2: Write the section component**

Create a lightweight inline component (not a separate file) that:
- Calls `api.getTrainingSlotsForGroup(userGroupId)` via `useQuery`
- Calls `api.getSlotOverrides({ fromDate: today })` for upcoming exceptions
- Renders a compact list: "Lun 06:00–08:00 Piscine Erstein"
- Shows upcoming exceptions with a warning badge

**Step 3: Verify renders correctly**

Run dev server and check the swimmer view.

**Step 4: Commit**

```bash
git add <modified-file>
git commit -m "feat: add swimmer schedule view (§76)"
```

---

### Task 8: Documentation Update

**Files:**
- Modify: `docs/implementation-log.md` — add §76 entry
- Modify: `docs/ROADMAP.md` — add chantier 40
- Modify: `docs/FEATURES_STATUS.md` — add training slots feature
- Modify: `CLAUDE.md` — add new files to key files table + chantier 40

**Step 1: Add implementation log entry**

Add a new section `§76 — Créneaux d'entraînement récurrents` to `docs/implementation-log.md` with:
- Context, changes, files modified, decisions, limitations

**Step 2: Update ROADMAP**

Add chantier 40 to the table in `docs/ROADMAP.md`.

**Step 3: Update FEATURES_STATUS**

Add training slots row.

**Step 4: Update CLAUDE.md**

Add new files to the key files table:
- `src/lib/api/training-slots.ts`
- `src/pages/coach/CoachTrainingSlotsScreen.tsx`

Add chantier 40 to the chantiers table.

**Step 5: Commit**

```bash
git add docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md CLAUDE.md
git commit -m "docs: add training slots documentation (§76)"
```

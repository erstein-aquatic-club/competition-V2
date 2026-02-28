# Créneaux personnalisés par nageur — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow coaches to customize training schedules per swimmer (inheriting from group slots) and improve mobile timeline readability.

**Architecture:** New `swimmer_training_slots` table with optional FK to `training_slot_assignments` for inheritance tracking. New API module `swimmer-slots.ts` with CRUD + init/reset. UI changes: coach slots screen (Select filter + horizontal scroll mobile), coach swimmer detail (5th tab), swimmer profile (resolve custom slots).

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), Tailwind CSS 4, Radix UI/Shadcn, React Query 5, Wouter

---

## Task 1: Database migration — `swimmer_training_slots` table

**Files:**
- Create: `supabase/migrations/00042_swimmer_training_slots.sql`

**Step 1: Write the migration SQL**

```sql
-- 00042_swimmer_training_slots.sql
-- Per-swimmer custom training slots with optional link to group assignment

CREATE TABLE IF NOT EXISTS swimmer_training_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_assignment_id UUID REFERENCES training_slot_assignments(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  location TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_swimmer_slots_user ON swimmer_training_slots (user_id) WHERE is_active;
CREATE INDEX idx_swimmer_slots_source ON swimmer_training_slots (source_assignment_id) WHERE source_assignment_id IS NOT NULL;

-- RLS
ALTER TABLE swimmer_training_slots ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read
CREATE POLICY "swimmer_slots_select" ON swimmer_training_slots
  FOR SELECT TO authenticated USING (true);

-- INSERT: coach and admin only
CREATE POLICY "swimmer_slots_insert" ON swimmer_training_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid()::text::integer)
        AND users.role IN ('coach', 'admin')
    )
  );

-- UPDATE: coach and admin only
CREATE POLICY "swimmer_slots_update" ON swimmer_training_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid()::text::integer)
        AND users.role IN ('coach', 'admin')
    )
  );

-- DELETE: coach and admin only
CREATE POLICY "swimmer_slots_delete" ON swimmer_training_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid()::text::integer)
        AND users.role IN ('coach', 'admin')
    )
  );
```

**Step 2: Apply the migration via Supabase MCP**

Use `apply_migration` with name `swimmer_training_slots` and the SQL above.

**Step 3: Verify the table exists**

Run: `execute_sql` with `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'swimmer_training_slots' ORDER BY ordinal_position;`

Expected: 10 columns (id, user_id, source_assignment_id, day_of_week, start_time, end_time, location, is_active, created_by, created_at).

**Step 4: Commit**

```bash
git add supabase/migrations/00042_swimmer_training_slots.sql
git commit -m "feat(db): add swimmer_training_slots table with RLS"
```

---

## Task 2: TypeScript types

**Files:**
- Modify: `src/lib/api/types.ts` (after line 648, after `TrainingSlotOverrideInput`)

**Step 1: Add the new types**

Append after the `TrainingSlotOverrideInput` interface:

```typescript
export interface SwimmerTrainingSlot {
  id: string;
  user_id: number;
  source_assignment_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
}

export interface SwimmerTrainingSlotInput {
  user_id: number;
  source_assignment_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors (pre-existing story errors are OK).

**Step 3: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat(types): add SwimmerTrainingSlot interfaces"
```

---

## Task 3: API module — `swimmer-slots.ts`

**Files:**
- Create: `src/lib/api/swimmer-slots.ts`
- Modify: `src/lib/api/index.ts` (add re-exports)
- Modify: `src/lib/api.ts` (add facade stubs + type re-exports)

**Step 1: Create the API module**

Create `src/lib/api/swimmer-slots.ts`:

```typescript
/**
 * API Swimmer Slots — Per-swimmer custom training schedule
 */

import { supabase, canUseSupabase } from "./client";
import type { SwimmerTrainingSlot, SwimmerTrainingSlotInput } from "./types";

// ── GET swimmer's custom slots ──────────────────────────────

export async function getSwimmerSlots(userId: number): Promise<SwimmerTrainingSlot[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("swimmer_training_slots")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");
  if (error) throw new Error(error.message);
  return (data ?? []) as SwimmerTrainingSlot[];
}

// ── CHECK if swimmer has custom slots ───────────────────────

export async function hasCustomSlots(userId: number): Promise<boolean> {
  if (!canUseSupabase()) return false;
  const { count, error } = await supabase
    .from("swimmer_training_slots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// ── INIT swimmer slots from group assignments ───────────────

export async function initSwimmerSlots(
  userId: number,
  groupId: number,
  createdBy: number,
): Promise<SwimmerTrainingSlot[]> {
  if (!canUseSupabase()) throw new Error("Supabase not available");

  // Fetch group's training slots with assignments
  const { data: assignments, error: assignErr } = await supabase
    .from("training_slot_assignments")
    .select("id, slot_id, training_slots!inner(day_of_week, start_time, end_time, location, is_active)")
    .eq("group_id", groupId);
  if (assignErr) throw new Error(assignErr.message);

  const rows = (assignments ?? [])
    .filter((a: any) => a.training_slots?.is_active)
    .map((a: any) => ({
      user_id: userId,
      source_assignment_id: a.id,
      day_of_week: a.training_slots.day_of_week,
      start_time: a.training_slots.start_time,
      end_time: a.training_slots.end_time,
      location: a.training_slots.location,
      created_by: createdBy,
    }));

  if (rows.length === 0) return [];

  const { error: insertErr } = await supabase
    .from("swimmer_training_slots")
    .insert(rows);
  if (insertErr) throw new Error(insertErr.message);

  return getSwimmerSlots(userId);
}

// ── CREATE a single custom slot ─────────────────────────────

export async function createSwimmerSlot(
  input: SwimmerTrainingSlotInput,
  createdBy: number,
): Promise<SwimmerTrainingSlot> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("swimmer_training_slots")
    .insert({
      user_id: input.user_id,
      source_assignment_id: input.source_assignment_id ?? null,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SwimmerTrainingSlot;
}

// ── UPDATE a swimmer slot ───────────────────────────────────

export async function updateSwimmerSlot(
  slotId: string,
  input: Partial<Pick<SwimmerTrainingSlotInput, "day_of_week" | "start_time" | "end_time" | "location">>,
): Promise<SwimmerTrainingSlot> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("swimmer_training_slots")
    .update(input)
    .eq("id", slotId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SwimmerTrainingSlot;
}

// ── DELETE (soft) a swimmer slot ────────────────────────────

export async function deleteSwimmerSlot(slotId: string): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase
    .from("swimmer_training_slots")
    .update({ is_active: false })
    .eq("id", slotId);
  if (error) throw new Error(error.message);
}

// ── RESET swimmer slots (delete all + re-init from group) ───

export async function resetSwimmerSlots(
  userId: number,
  groupId: number,
  createdBy: number,
): Promise<SwimmerTrainingSlot[]> {
  if (!canUseSupabase()) throw new Error("Supabase not available");

  // Soft-delete all existing custom slots
  const { error: delErr } = await supabase
    .from("swimmer_training_slots")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (delErr) throw new Error(delErr.message);

  // Re-init from group
  return initSwimmerSlots(userId, groupId, createdBy);
}

// ── GET swimmers affected by a group slot assignment ────────

export async function getSwimmersAffectedBySlot(
  assignmentId: string,
): Promise<Array<{ user_id: number; slot_id: string }>> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("swimmer_training_slots")
    .select("user_id, id")
    .eq("source_assignment_id", assignmentId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: any) => ({ user_id: d.user_id, slot_id: d.id }));
}
```

**Step 2: Add re-exports to `src/lib/api/index.ts`**

After the `training-slots` re-export block (after line 257), add:

```typescript
export {
  getSwimmerSlots,
  hasCustomSlots,
  initSwimmerSlots,
  createSwimmerSlot,
  updateSwimmerSlot,
  deleteSwimmerSlot,
  resetSwimmerSlots,
  getSwimmersAffectedBySlot,
} from './swimmer-slots';
```

**Step 3: Add type re-exports to `src/lib/api.ts`**

In the type re-export block (around line 62), add `SwimmerTrainingSlot` and `SwimmerTrainingSlotInput` to the list.

**Step 4: Add facade stubs to `src/lib/api.ts`**

At the top, add imports:

```typescript
import {
  getSwimmerSlots as _getSwimmerSlots,
  hasCustomSlots as _hasCustomSlots,
  initSwimmerSlots as _initSwimmerSlots,
  createSwimmerSlot as _createSwimmerSlot,
  updateSwimmerSlot as _updateSwimmerSlot,
  deleteSwimmerSlot as _deleteSwimmerSlot,
  resetSwimmerSlots as _resetSwimmerSlots,
  getSwimmersAffectedBySlot as _getSwimmersAffectedBySlot,
} from "./api/swimmer-slots";
```

Before the closing `};` of the `api` object (around line 721), add:

```typescript
  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Swimmer Training Slots
  // ══════════════════════════════════════════════════════════════════
  async getSwimmerSlots(userId: number) { return _getSwimmerSlots(userId); },
  async hasCustomSlots(userId: number) { return _hasCustomSlots(userId); },
  async initSwimmerSlots(userId: number, groupId: number, createdBy: number) { return _initSwimmerSlots(userId, groupId, createdBy); },
  async createSwimmerSlot(input: Parameters<typeof _createSwimmerSlot>[0], createdBy: number) { return _createSwimmerSlot(input, createdBy); },
  async updateSwimmerSlot(slotId: string, input: Parameters<typeof _updateSwimmerSlot>[1]) { return _updateSwimmerSlot(slotId, input); },
  async deleteSwimmerSlot(slotId: string) { return _deleteSwimmerSlot(slotId); },
  async resetSwimmerSlots(userId: number, groupId: number, createdBy: number) { return _resetSwimmerSlots(userId, groupId, createdBy); },
  async getSwimmersAffectedBySlot(assignmentId: string) { return _getSwimmersAffectedBySlot(assignmentId); },
```

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 6: Commit**

```bash
git add src/lib/api/swimmer-slots.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat(api): add swimmer-slots CRUD module"
```

---

## Task 4: Mobile timeline readability — horizontal scroll

**Files:**
- Modify: `src/pages/coach/CoachTrainingSlotsScreen.tsx`

**Context:** The current `MobileTimeline` component renders 7 day columns compressed into the viewport (~50px each). The design calls for wider columns (~80px) with horizontal scroll to show 4-5 days at once.

**Step 1: Update the MobileTimeline component**

In the `MobileTimeline` component, change the grid container from fitting all 7 columns to using fixed-width columns with horizontal overflow:

- Replace the grid template from `"1.5rem repeat(7, 1fr)"` to `"1.5rem repeat(7, 80px)"`
- Add `overflow-x-auto no-scrollbar` to the outer container
- Make the timeline area `min-w-max` so it doesn't compress
- Increase `MOBILE_PX_PER_HOUR` from `32` to `40` (same as desktop) for taller slots
- Auto-scroll to today's column on mount using a `useEffect` with `scrollIntoView`

Key changes in the JSX:
```tsx
// Outer wrapper: add overflow-x-auto
<div className="overflow-x-auto no-scrollbar rounded-xl border border-border bg-card">
  {/* Grid with fixed-width columns */}
  <div
    className="grid"
    style={{
      gridTemplateColumns: "1.5rem repeat(7, 80px)",
      height: `${mobileTimelineHeight}px`,
      position: "relative",
    }}
  >
    {/* ... day headers and slot blocks ... */}
  </div>
</div>
```

Add a ref to today's column header and scroll into view:
```tsx
const todayColRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  todayColRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
}, []);
```

**Step 2: Verify visually**

Run: `npm run dev`
Check on mobile viewport (375px width): the timeline should show ~4 columns with horizontal scroll. Today's column should be centered.

**Step 3: Commit**

```bash
git add src/pages/coach/CoachTrainingSlotsScreen.tsx
git commit -m "fix(ui): improve mobile timeline readability with horizontal scroll"
```

---

## Task 5: Replace filter pills with Select

**Files:**
- Modify: `src/pages/coach/CoachTrainingSlotsScreen.tsx`

**Context:** The current filter uses horizontal pill chips (`FilterChip` type, `filterChips` memo, ToggleGroup). The design calls for a single `<Select>` dropdown with grouped options: "Tous" | groups | separator | individual swimmers.

**Step 1: Remove filter pill code**

Remove:
- The `FilterChip` type definition
- The `filterChips` useMemo
- The mobile filter pills JSX (`<div className="flex gap-1.5 overflow-x-auto...">`)
- The `mode` and `groupFilter` states used by pills

**Step 2: Add new Select filter**

Replace with a single `<Select>` using Radix `SelectGroup` and `SelectSeparator`:

```tsx
// State
const [filterValue, setFilterValue] = useState<string>("all");

// Derive filtered slots from filterValue
const filteredSlots = useMemo(() => {
  if (filterValue === "all") return slots;
  if (filterValue.startsWith("group:")) {
    const gid = Number(filterValue.split(":")[1]);
    return slots.filter((s) => s.assignments.some((a) => a.group_id === gid));
  }
  // swimmer:userId handled separately (will use swimmer slots API)
  return slots;
}, [slots, filterValue]);
```

JSX for the Select:
```tsx
<Select value={filterValue} onValueChange={setFilterValue}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Filtrer..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Tous les créneaux</SelectItem>
    <SelectSeparator />
    {groups.map((g) => (
      <SelectItem key={g.id} value={`group:${g.id}`}>
        {g.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Note: swimmer options will be added in Task 7 when the swimmer slots UI is implemented.

**Step 3: Verify visually**

Run: `npm run dev`
Check: filter pills are gone, a clean Select dropdown replaces them.

**Step 4: Commit**

```bash
git add src/pages/coach/CoachTrainingSlotsScreen.tsx
git commit -m "refactor(ui): replace filter pills with Select dropdown"
```

---

## Task 6: Coach Swimmer Detail — Add "Créneaux" tab

**Files:**
- Modify: `src/pages/coach/CoachSwimmerDetail.tsx` (add 5th tab)
- Create: `src/components/coach/SwimmerSlotsTab.tsx` (new tab component)

**Step 1: Create `SwimmerSlotsTab.tsx`**

Create `src/components/coach/SwimmerSlotsTab.tsx`:

```typescript
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SwimmerTrainingSlot, SwimmerTrainingSlotInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Link2, Plus, RotateCcw, Trash2, Clock, MapPin } from "lucide-react";

const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Props = {
  athleteId: number;
  athleteName: string;
  groupId: number;
};

export default function SwimmerSlotsTab({ athleteId, athleteName, groupId }: Props) {
  const { userId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────
  const { data: customSlots, isLoading } = useQuery({
    queryKey: ["swimmer-slots", athleteId],
    queryFn: () => api.getSwimmerSlots(athleteId),
  });

  const { data: hasCustom } = useQuery({
    queryKey: ["swimmer-slots-exists", athleteId],
    queryFn: () => api.hasCustomSlots(athleteId),
  });

  const { data: groupSlots = [] } = useQuery({
    queryKey: ["training-slots", "group", groupId],
    queryFn: () => api.getTrainingSlotsForGroup(groupId),
  });

  const hasPersonalSlots = hasCustom === true;
  const displaySlots = hasPersonalSlots ? (customSlots ?? []) : [];

  // ── Mutations ───────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["swimmer-slots", athleteId] });
    qc.invalidateQueries({ queryKey: ["swimmer-slots-exists", athleteId] });
  };

  const initMut = useMutation({
    mutationFn: () => api.initSwimmerSlots(athleteId, groupId, userId!),
    onSuccess: () => { invalidate(); toast({ title: "Planning personnalisé créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: () => api.resetSwimmerSlots(athleteId, groupId, userId!),
    onSuccess: () => { invalidate(); toast({ title: "Planning réinitialisé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (slotId: string) => api.deleteSwimmerSlot(slotId),
    onSuccess: () => { invalidate(); toast({ title: "Créneau supprimé" }); },
  });

  const createMut = useMutation({
    mutationFn: (input: SwimmerTrainingSlotInput) => api.createSwimmerSlot(input, userId!),
    onSuccess: () => { invalidate(); toast({ title: "Créneau ajouté" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ slotId, input }: { slotId: string; input: Partial<SwimmerTrainingSlotInput> }) =>
      api.updateSwimmerSlot(slotId, input),
    onSuccess: () => { invalidate(); toast({ title: "Créneau modifié" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Sheet state for add/edit ────────────────────
  const [editSlot, setEditSlot] = useState<SwimmerTrainingSlot | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Group slots by day ──────────────────────────
  const slotsByDay = useMemo(() => {
    const source = hasPersonalSlots ? displaySlots : groupSlots;
    const map = new Map<number, typeof source>();
    for (const s of source) {
      const list = map.get(s.day_of_week) ?? [];
      list.push(s as any);
      map.set(s.day_of_week, list);
    }
    return map;
  }, [hasPersonalSlots, displaySlots, groupSlots]);

  // ── Loading ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        {!hasPersonalSlots ? (
          <Button size="sm" onClick={() => initMut.mutate()} disabled={initMut.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Personnaliser le planning
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setShowAddSheet(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Réinitialiser
            </Button>
          </>
        )}
      </div>

      {/* Banner when inheriting */}
      {!hasPersonalSlots && groupSlots.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
          Hérite du planning du groupe. Cliquez sur « Personnaliser » pour ajuster.
        </div>
      )}

      {/* Day-by-day list */}
      {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
        const daySlots = slotsByDay.get(dow);
        if (!daySlots || daySlots.length === 0) return null;
        return (
          <div key={dow} className="space-y-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {DAYS_FR[dow - 1]}
            </h3>
            {daySlots.map((s: any) => (
              <button
                key={s.id}
                type="button"
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/50 transition"
                onClick={() => hasPersonalSlots ? setEditSlot(s) : undefined}
              >
                <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {(s.start_time as string).slice(0, 5)} – {(s.end_time as string).slice(0, 5)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                  <MapPin className="h-3.5 w-3.5" />
                  {s.location}
                </div>
                {hasPersonalSlots && (s as SwimmerTrainingSlot).source_assignment_id && (
                  <Link2 className="h-3.5 w-3.5 text-blue-500 ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        );
      })}

      {slotsByDay.size === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Aucun créneau configuré.
        </p>
      )}

      {/* Add slot sheet — implement form fields for day, start_time, end_time, location */}
      {/* Edit slot sheet — prefilled form, delete button */}
      {/* Reset confirmation dialog */}
      {/* Delete confirmation dialog */}

      {/* Confirm reset dialog */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le planning ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les créneaux personnalisés seront supprimés et remplacés par ceux du groupe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resetMut.mutate(); setConfirmReset(false); }}
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
            <AlertDialogDescription>Le créneau sera retiré du planning personnel.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget); setDeleteTarget(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit sheet */}
      <Sheet open={!!editSlot} onOpenChange={(open) => !open && setEditSlot(null)}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Modifier le créneau</SheetTitle>
            <SheetDescription>Ajustez les horaires ou le lieu</SheetDescription>
          </SheetHeader>
          {editSlot && (
            <SlotEditForm
              slot={editSlot}
              onSave={(input) => {
                updateMut.mutate({ slotId: editSlot.id, input });
                setEditSlot(null);
              }}
              onDelete={() => { setDeleteTarget(editSlot.id); setEditSlot(null); }}
              isPending={updateMut.isPending}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Ajouter un créneau</SheetTitle>
            <SheetDescription>Nouveau créneau personnalisé</SheetDescription>
          </SheetHeader>
          <SlotAddForm
            onSave={(input) => {
              createMut.mutate({ ...input, user_id: athleteId });
              setShowAddSheet(false);
            }}
            isPending={createMut.isPending}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Slot Edit Form (inline) ─────────────────────

function SlotEditForm({
  slot,
  onSave,
  onDelete,
  isPending,
}: {
  slot: SwimmerTrainingSlot;
  onSave: (input: Partial<SwimmerTrainingSlotInput>) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [startTime, setStartTime] = useState(slot.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(slot.end_time.slice(0, 5));
  const [location, setLocation] = useState(slot.location);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Début</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label>Fin</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Lieu</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => onSave({ start_time: startTime, end_time: endTime, location })}
          disabled={isPending}
        >
          Enregistrer
        </Button>
        <Button variant="destructive" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Slot Add Form (inline) ──────────────────────

function SlotAddForm({
  onSave,
  isPending,
}: {
  onSave: (input: Omit<SwimmerTrainingSlotInput, "user_id">) => void;
  isPending: boolean;
}) {
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");

  return (
    <div className="space-y-4 pt-4">
      <div>
        <Label>Jour</Label>
        <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DAYS_FR.map((d, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Début</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label>Fin</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Lieu</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Piscine, Salle..." />
      </div>
      <Button
        className="w-full"
        onClick={() => onSave({
          day_of_week: Number(dayOfWeek),
          start_time: startTime,
          end_time: endTime,
          location,
        })}
        disabled={isPending || !location}
      >
        Ajouter
      </Button>
    </div>
  );
}
```

**Step 2: Add the 5th tab in `CoachSwimmerDetail.tsx`**

Import the new component and add to tabs:

```typescript
import SwimmerSlotsTab from "@/components/coach/SwimmerSlotsTab";
import { CalendarClock } from "lucide-react";
```

Change `grid-cols-4` → `grid-cols-5` on the `TabsList`.

Add the new tab trigger (after `entretiens`):
```tsx
<TabsTrigger value="creneaux" className="text-xs gap-1">
  <CalendarClock className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Créneaux</span>
</TabsTrigger>
```

Add the tab content:
```tsx
<TabsContent value="creneaux" className="mt-4">
  <SwimmerSlotsTab
    athleteId={athleteId}
    athleteName={displayName}
    groupId={profile?.group_id ?? 0}
  />
</TabsContent>
```

Note: `group_id` needs to come from the profile. Check that `getProfile` returns `group_id`. If not, query `group_members` separately or add `group_id` to the profile query.

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`

**Step 4: Verify visually**

Run: `npm run dev`
Navigate to a swimmer detail page → the 5th tab "Créneaux" should appear.

**Step 5: Commit**

```bash
git add src/components/coach/SwimmerSlotsTab.tsx src/pages/coach/CoachSwimmerDetail.tsx
git commit -m "feat(ui): add swimmer slots tab in coach swimmer detail"
```

---

## Task 7: Swimmer Select in CoachTrainingSlotsScreen

**Files:**
- Modify: `src/pages/coach/CoachTrainingSlotsScreen.tsx`

**Context:** Add swimmer options to the Select dropdown (from Task 5) so the coach can view a specific swimmer's custom slots in the main timeline view.

**Step 1: Fetch athletes list**

Add a query for athletes:
```typescript
const { data: athletes = [] } = useQuery({
  queryKey: ["athletes"],
  queryFn: () => api.getAthletes(),
});
```

**Step 2: Add swimmer options to Select**

After the group options, add a `SelectSeparator` and swimmer items:

```tsx
<SelectSeparator />
{athletes.map((a) => (
  <SelectItem key={`swimmer:${a.id}`} value={`swimmer:${a.id}`}>
    {a.display_name}
  </SelectItem>
))}
```

**Step 3: Handle swimmer filter selection**

When `filterValue.startsWith("swimmer:")`, fetch the swimmer's custom slots:

```typescript
const swimmerFilterId = filterValue.startsWith("swimmer:")
  ? Number(filterValue.split(":")[1])
  : null;

const { data: swimmerSlots } = useQuery({
  queryKey: ["swimmer-slots", swimmerFilterId],
  queryFn: () => api.getSwimmerSlots(swimmerFilterId!),
  enabled: swimmerFilterId != null,
});

const { data: swimmerHasCustom } = useQuery({
  queryKey: ["swimmer-slots-exists", swimmerFilterId],
  queryFn: () => api.hasCustomSlots(swimmerFilterId!),
  enabled: swimmerFilterId != null,
});
```

Update `filteredSlots` to handle swimmer mode:
- If swimmer has custom slots → convert `SwimmerTrainingSlot[]` to display format
- If not → show group slots with "Hérite du groupe" banner

**Step 4: Show banner for inherited slots**

When viewing a swimmer who hasn't customized yet, show a blue banner: "Ce nageur hérite des créneaux du groupe X. Personnaliser →" with a link to the swimmer detail tab.

**Step 5: Verify visually**

Run: `npm run dev`
Check: Select shows swimmer names, selecting one shows their schedule.

**Step 6: Commit**

```bash
git add src/pages/coach/CoachTrainingSlotsScreen.tsx
git commit -m "feat(ui): add swimmer view in coach training slots screen"
```

---

## Task 8: Swimmer Profile — resolve custom slots

**Files:**
- Modify: `src/pages/Profile.tsx` (the `SwimmerScheduleSection` component)

**Context:** Currently `SwimmerScheduleSection` always calls `api.getTrainingSlotsForGroup(groupId)`. It needs to first check if the swimmer has custom slots and use those instead.

**Step 1: Add custom slot resolution**

In `SwimmerScheduleSection`, add:

```typescript
const { userId } = useAuth();

const { data: hasCustom } = useQuery({
  queryKey: ["swimmer-slots-exists", userId],
  queryFn: () => api.hasCustomSlots(userId!),
  enabled: userId != null,
});

const { data: customSlots = [] } = useQuery({
  queryKey: ["swimmer-slots", userId],
  queryFn: () => api.getSwimmerSlots(userId!),
  enabled: hasCustom === true,
});
```

Update the slot resolution logic:
```typescript
const resolvedSlots = hasCustom ? customSlots : slots;
```

Use `resolvedSlots` instead of `slots` for the day grouping and display.

For custom slots, override matching still works on `source_assignment_id` — but for simplicity in this first iteration, show the slots without override matching (overrides apply to group slots, not directly to swimmer slots). Document this limitation.

**Step 2: Verify visually**

Run: `npm run dev`
Check: a swimmer with custom slots sees their personalized schedule on their profile.

**Step 3: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat(ui): resolve custom swimmer slots in profile schedule"
```

---

## Task 9: Documentation update

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CLAUDE.md`

**Step 1: Add implementation log entry**

Add a new entry in `docs/implementation-log.md` documenting:
- New `swimmer_training_slots` table
- New API module `swimmer-slots.ts`
- UI changes: CoachTrainingSlotsScreen (Select filter, horizontal scroll timeline), CoachSwimmerDetail (5th tab), Profile (custom slot resolution)
- Files created/modified

**Step 2: Update FEATURES_STATUS.md**

Add "Créneaux personnalisés par nageur" as ✅ under the relevant section.

**Step 3: Update ROADMAP.md**

Add new chantier entry (41) for swimmer custom slots, marked as Fait.

**Step 4: Update CLAUDE.md**

Add new files to the key files table:
- `src/lib/api/swimmer-slots.ts`
- `src/components/coach/SwimmerSlotsTab.tsx`

Update chantier 41 in the roadmap table.

**Step 5: Commit**

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md docs/ROADMAP.md CLAUDE.md
git commit -m "docs: document swimmer custom slots implementation"
```

---

## Summary of all tasks

| # | Task | Files | Est. |
|---|------|-------|------|
| 1 | DB migration `swimmer_training_slots` | `supabase/migrations/00042_swimmer_training_slots.sql` | 5 min |
| 2 | TypeScript types | `src/lib/api/types.ts` | 2 min |
| 3 | API module `swimmer-slots.ts` + wiring | `src/lib/api/swimmer-slots.ts`, `index.ts`, `api.ts` | 10 min |
| 4 | Mobile timeline horizontal scroll | `CoachTrainingSlotsScreen.tsx` | 5 min |
| 5 | Replace filter pills with Select | `CoachTrainingSlotsScreen.tsx` | 5 min |
| 6 | SwimmerSlotsTab + 5th tab in detail | `SwimmerSlotsTab.tsx`, `CoachSwimmerDetail.tsx` | 10 min |
| 7 | Swimmer Select in slots screen | `CoachTrainingSlotsScreen.tsx` | 10 min |
| 8 | Profile custom slot resolution | `Profile.tsx` | 5 min |
| 9 | Documentation update | 4 doc files | 5 min |

**Notifications (Task from design § 6)** are deferred to a follow-up task — the notification logic for override propagation requires more design around the `training_slot_overrides` → `swimmer_training_slots` overlap check and will be added once the core CRUD is validated.

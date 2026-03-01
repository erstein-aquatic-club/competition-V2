# Swimmer Competition Detail — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full swimmer competition detail page with 4 functional tabs: Courses (races), Routines (per-race prep), Timeline (day view), and Checklist (packing/preparation).

**Architecture:** 4 new DB tables + 1 API module + 4 tab components replacing the current placeholders in `CompetitionDetail.tsx`. Each tab is self-contained. The Courses tab is the foundation — Routines and Timeline depend on race data. Checklist is independent.

**Tech Stack:** Supabase PostgreSQL (migration), TypeScript API module, React + Radix Tabs + Shadcn Sheet, React Query mutations.

**Supabase Project ID:** `fscnobivsgornxdwqwlk`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00055_competition_races_routines_checklists.sql`

**Step 1: Apply migration via Supabase MCP**

```sql
-- ══════════════════════════════════════════════════════════════
-- Competition Races: swimmer's individual events per competition
-- ══════════════════════════════════════════════════════════════

CREATE TABLE competition_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,         -- e.g. "100NL", "200DOS" (from FFN_EVENTS)
  race_day DATE NOT NULL,           -- day of race within the competition
  start_time TIME,                  -- scheduled start time (nullable: TBD)
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE competition_races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competition_races_select" ON competition_races
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "competition_races_own_insert" ON competition_races
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));

CREATE POLICY "competition_races_own_update" ON competition_races
  FOR UPDATE TO authenticated
  USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'))
  WITH CHECK (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));

CREATE POLICY "competition_races_own_delete" ON competition_races
  FOR DELETE TO authenticated
  USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));

CREATE INDEX idx_competition_races_comp ON competition_races (competition_id, athlete_id);

-- ══════════════════════════════════════════════════════════════
-- Routine Templates: reusable named routine blueprints
-- ══════════════════════════════════════════════════════════════

CREATE TABLE routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                -- e.g. "Routine sprint", "Routine fond"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routine_templates_select" ON routine_templates
  FOR SELECT TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));

CREATE POLICY "routine_templates_own_insert" ON routine_templates
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = app_user_id());

CREATE POLICY "routine_templates_own_update" ON routine_templates
  FOR UPDATE TO authenticated
  USING (athlete_id = app_user_id())
  WITH CHECK (athlete_id = app_user_id());

CREATE POLICY "routine_templates_own_delete" ON routine_templates
  FOR DELETE TO authenticated
  USING (athlete_id = app_user_id());

-- ══════════════════════════════════════════════════════════════
-- Routine Steps: individual steps within a routine template
-- ══════════════════════════════════════════════════════════════

CREATE TABLE routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL,  -- negative = before race (e.g. -60)
  label TEXT NOT NULL,              -- e.g. "Échauffement dans l'eau"
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE routine_steps ENABLE ROW LEVEL SECURITY;

-- Inherit access from parent routine_template via subquery
CREATE POLICY "routine_steps_select" ON routine_steps
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND (rt.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin')))
  );

CREATE POLICY "routine_steps_own_insert" ON routine_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id())
  );

CREATE POLICY "routine_steps_own_update" ON routine_steps
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id()));

CREATE POLICY "routine_steps_own_delete" ON routine_steps
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id()));

CREATE INDEX idx_routine_steps_routine ON routine_steps (routine_id);

-- ══════════════════════════════════════════════════════════════
-- Race Routines: link a race to a routine template
-- ══════════════════════════════════════════════════════════════

CREATE TABLE race_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES competition_races(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  UNIQUE(race_id)
);

ALTER TABLE race_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "race_routines_select" ON race_routines
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM competition_races cr WHERE cr.id = race_id AND (cr.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin')))
  );

CREATE POLICY "race_routines_own_insert" ON race_routines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM competition_races cr WHERE cr.id = race_id AND cr.athlete_id = app_user_id())
  );

CREATE POLICY "race_routines_own_delete" ON race_routines
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM competition_races cr WHERE cr.id = race_id AND cr.athlete_id = app_user_id()));

-- ══════════════════════════════════════════════════════════════
-- Checklist Templates: reusable named checklist blueprints
-- ══════════════════════════════════════════════════════════════

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- e.g. "Compétition bassin 25m"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_templates_select" ON checklist_templates
  FOR SELECT TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));

CREATE POLICY "checklist_templates_own_insert" ON checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = app_user_id());

CREATE POLICY "checklist_templates_own_update" ON checklist_templates
  FOR UPDATE TO authenticated
  USING (athlete_id = app_user_id())
  WITH CHECK (athlete_id = app_user_id());

CREATE POLICY "checklist_templates_own_delete" ON checklist_templates
  FOR DELETE TO authenticated
  USING (athlete_id = app_user_id());

-- ══════════════════════════════════════════════════════════════
-- Checklist Items: items within a checklist template
-- ══════════════════════════════════════════════════════════════

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select" ON checklist_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND (ct.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin')))
  );

CREATE POLICY "checklist_items_own_insert" ON checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id())
  );

CREATE POLICY "checklist_items_own_update" ON checklist_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id()));

CREATE POLICY "checklist_items_own_delete" ON checklist_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id()));

CREATE INDEX idx_checklist_items_checklist ON checklist_items (checklist_id);

-- ══════════════════════════════════════════════════════════════
-- Competition Checklists: link a competition to a checklist + checks
-- ══════════════════════════════════════════════════════════════

CREATE TABLE competition_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checklist_template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  UNIQUE(competition_id, athlete_id)
);

ALTER TABLE competition_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competition_checklists_select" ON competition_checklists
  FOR SELECT TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));

CREATE POLICY "competition_checklists_own_insert" ON competition_checklists
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = app_user_id());

CREATE POLICY "competition_checklists_own_delete" ON competition_checklists
  FOR DELETE TO authenticated
  USING (athlete_id = app_user_id());

-- ══════════════════════════════════════════════════════════════
-- Competition Checklist Checks: per-competition item completions
-- ══════════════════════════════════════════════════════════════

CREATE TABLE competition_checklist_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_checklist_id UUID NOT NULL REFERENCES competition_checklists(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  UNIQUE(competition_checklist_id, checklist_item_id)
);

ALTER TABLE competition_checklist_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competition_checklist_checks_select" ON competition_checklist_checks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND (cc.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin')))
  );

CREATE POLICY "competition_checklist_checks_own_insert" ON competition_checklist_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND cc.athlete_id = app_user_id())
  );

CREATE POLICY "competition_checklist_checks_own_update" ON competition_checklist_checks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND cc.athlete_id = app_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND cc.athlete_id = app_user_id()));

CREATE INDEX idx_comp_checklist_checks_cc ON competition_checklist_checks (competition_checklist_id);
```

**Step 2: Save migration file locally**

Write the SQL to `supabase/migrations/00055_competition_races_routines_checklists.sql`.

**Step 3: Commit**

```bash
git add supabase/migrations/00055_competition_races_routines_checklists.sql
git commit -m "feat(db): add tables for competition races, routines, checklists"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/api/types.ts` (append at end)

**Step 1: Add types**

```ts
// ── Competition Races ─────────────────────────────────────────

export interface CompetitionRace {
  id: string;
  competition_id: string;
  athlete_id: number;
  event_code: string;
  race_day: string;
  start_time?: string | null;
  notes?: string | null;
  sort_order: number;
  created_at?: string | null;
}

export interface CompetitionRaceInput {
  competition_id: string;
  event_code: string;
  race_day: string;
  start_time?: string | null;
  notes?: string | null;
  sort_order?: number;
}

// ── Routine Templates ─────────────────────────────────────────

export interface RoutineTemplate {
  id: string;
  athlete_id: number;
  name: string;
  created_at?: string | null;
  steps?: RoutineStep[];
}

export interface RoutineStep {
  id: string;
  routine_id: string;
  offset_minutes: number;
  label: string;
  sort_order: number;
  created_at?: string | null;
}

export interface RoutineStepInput {
  offset_minutes: number;
  label: string;
  sort_order?: number;
}

export interface RaceRoutine {
  id: string;
  race_id: string;
  routine_id: string;
}

// ── Checklist Templates ───────────────────────────────────────

export interface ChecklistTemplate {
  id: string;
  athlete_id: number;
  name: string;
  created_at?: string | null;
  items?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  label: string;
  sort_order: number;
  created_at?: string | null;
}

export interface ChecklistItemInput {
  label: string;
  sort_order?: number;
}

export interface CompetitionChecklist {
  id: string;
  competition_id: string;
  athlete_id: number;
  checklist_template_id: string;
}

export interface CompetitionChecklistCheck {
  id: string;
  competition_checklist_id: string;
  checklist_item_id: string;
  checked: boolean;
  checked_at?: string | null;
}
```

**Step 2: Add to re-exports in `src/lib/api.ts`**

Add the new types to the `export type { ... }` block.

**Step 3: Commit**

```bash
git add src/lib/api/types.ts src/lib/api.ts
git commit -m "feat(types): add competition races, routines, checklist interfaces"
```

---

## Task 3: API Module — Competition Prep

**Files:**
- Create: `src/lib/api/competition-prep.ts`
- Modify: `src/lib/api/index.ts` (add exports)
- Modify: `src/lib/api.ts` (add to `api` object)

**Step 1: Create `src/lib/api/competition-prep.ts`**

This module contains all CRUD for races, routines, checklists. Pattern follows `competitions.ts` exactly:
- `canUseSupabase()` guard on reads → return `[]`
- `canUseSupabase()` guard on writes → throw
- `supabase.from(...)` queries
- `throw new Error(error.message)` on error

Functions needed:

**Races:**
- `getCompetitionRaces(competitionId: string): Promise<CompetitionRace[]>` — filtered by current athlete (via RLS)
- `createCompetitionRace(input: CompetitionRaceInput): Promise<CompetitionRace>` — inserts with `athlete_id = app_user_id()` (use RPC or set from auth)
- `updateCompetitionRace(id: string, input: Partial<CompetitionRaceInput>): Promise<CompetitionRace>`
- `deleteCompetitionRace(id: string): Promise<void>`

**Routine Templates:**
- `getRoutineTemplates(): Promise<RoutineTemplate[]>` — all templates for current athlete, with steps eager-loaded
- `createRoutineTemplate(name: string, steps: RoutineStepInput[]): Promise<RoutineTemplate>` — create template + steps in sequence
- `deleteRoutineTemplate(id: string): Promise<void>`

**Race ↔ Routine linking:**
- `getRaceRoutines(competitionId: string): Promise<RaceRoutine[]>` — join through competition_races to get all race_routines for a competition
- `setRaceRoutine(raceId: string, routineId: string): Promise<void>` — upsert (delete existing + insert)
- `removeRaceRoutine(raceId: string): Promise<void>`

**Checklist Templates:**
- `getChecklistTemplates(): Promise<ChecklistTemplate[]>` — all templates for current athlete, with items eager-loaded
- `createChecklistTemplate(name: string, items: ChecklistItemInput[]): Promise<ChecklistTemplate>`
- `deleteChecklistTemplate(id: string): Promise<void>`

**Competition Checklist (instance):**
- `getCompetitionChecklist(competitionId: string): Promise<{ checklist: CompetitionChecklist; checks: CompetitionChecklistCheck[] } | null>`
- `applyChecklistTemplate(competitionId: string, templateId: string): Promise<CompetitionChecklist>` — create competition_checklists row + initial check rows (all unchecked)
- `toggleChecklistCheck(checkId: string, checked: boolean): Promise<void>`
- `removeCompetitionChecklist(competitionChecklistId: string): Promise<void>`

**Step 2: Add exports in `src/lib/api/index.ts`**

```ts
export {
  getCompetitionRaces,
  createCompetitionRace,
  updateCompetitionRace,
  deleteCompetitionRace,
  getRoutineTemplates,
  createRoutineTemplate,
  deleteRoutineTemplate,
  getRaceRoutines,
  setRaceRoutine,
  removeRaceRoutine,
  getChecklistTemplates,
  createChecklistTemplate,
  deleteChecklistTemplate,
  getCompetitionChecklist,
  applyChecklistTemplate,
  toggleChecklistCheck,
  removeCompetitionChecklist,
} from './competition-prep';
```

**Step 3: Add to `api` object in `src/lib/api.ts`**

Import with `_` prefix aliases, add proxy methods to `api` object.

**Step 4: Commit**

```bash
git add src/lib/api/competition-prep.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat(api): add competition-prep module (races, routines, checklists)"
```

---

## Task 4: Courses Tab UI

**Files:**
- Create: `src/components/competition/RacesTab.tsx`
- Modify: `src/pages/CompetitionDetail.tsx` (replace placeholder)

**Step 1: Build `RacesTab` component**

Props: `{ competitionId: string; competitionDate: string; competitionEndDate?: string | null }`

Features:
- `useQuery` for `getCompetitionRaces(competitionId)` — query key `["competition-races", competitionId]`
- List of race cards: event label (from `eventLabel()` in `objectiveHelpers.ts`), date, time, notes
- Each card has edit/delete buttons
- "+" FAB or inline button to add a race
- Add/Edit form in a `<Sheet>`: event selector (FFN_EVENTS dropdown), day picker (constrained to competition date range), time input, notes textarea
- `useMutation` for create/update/delete with `invalidateQueries`
- Sort by `race_day ASC, start_time ASC, sort_order ASC`

**Step 2: Replace placeholder in `CompetitionDetail.tsx`**

```tsx
<TabsContent value="courses" className="mt-4">
  <RacesTab
    competitionId={competition.id}
    competitionDate={competition.date}
    competitionEndDate={competition.end_date}
  />
</TabsContent>
```

**Step 3: Verify build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git add src/components/competition/RacesTab.tsx src/pages/CompetitionDetail.tsx
git commit -m "feat: implement Courses tab in competition detail"
```

---

## Task 5: Routines Tab UI

**Files:**
- Create: `src/components/competition/RoutinesTab.tsx`
- Modify: `src/pages/CompetitionDetail.tsx` (replace placeholder)

**Step 1: Build `RoutinesTab` component**

Props: `{ competitionId: string }`

Features:
- Fetches races (`getCompetitionRaces`), race routines (`getRaceRoutines`), and routine templates (`getRoutineTemplates`)
- For each race: shows assigned routine (if any) with its steps, or "Aucune routine" with an "Assigner" button
- Assign routine: picker sheet listing all templates → `setRaceRoutine(raceId, templateId)`
- Create new template: sheet with name input + dynamic list of steps (offset_minutes + label). "Sauvegarder" calls `createRoutineTemplate(name, steps)`
- Remove routine from race: `removeRaceRoutine(raceId)`
- Delete template: `deleteRoutineTemplate(id)` with confirmation

**Step 2: Replace placeholder in `CompetitionDetail.tsx`**

**Step 3: Verify build + commit**

```bash
git commit -m "feat: implement Routines tab in competition detail"
```

---

## Task 6: Timeline Tab UI

**Files:**
- Create: `src/components/competition/TimelineTab.tsx`
- Modify: `src/pages/CompetitionDetail.tsx` (replace placeholder)

**Step 1: Build `TimelineTab` component**

Props: `{ competitionId: string; competitionDate: string; competitionEndDate?: string | null }`

Features:
- Read-only computed view (no new API calls, reuses race + routine data)
- Day selector pills (if multi-day competition)
- Merges all races + their routine steps into a single chronological list
- For each race: compute absolute times for routine steps (`start_time - offset_minutes`)
- Render as a vertical timeline:
  - Race items: amber accent, event label, start time
  - Routine step items: blue/gray accent, step label, computed absolute time
  - Items sorted by absolute time ASC
- If a race has no `start_time`, show "Heure à définir" without routine step times
- Empty state: "Ajoute des courses et des routines pour voir ta timeline"

**Step 2: Replace placeholder in `CompetitionDetail.tsx`**

**Step 3: Verify build + commit**

```bash
git commit -m "feat: implement Timeline tab in competition detail"
```

---

## Task 7: Checklist Tab UI

**Files:**
- Create: `src/components/competition/ChecklistTab.tsx`
- Modify: `src/pages/CompetitionDetail.tsx` (replace placeholder)

**Step 1: Build `ChecklistTab` component**

Props: `{ competitionId: string }`

Features:
- Fetches `getCompetitionChecklist(competitionId)` and `getChecklistTemplates()`
- **If no checklist applied**: show template picker (list of saved templates) + "Créer un template" option
- **If checklist applied**: show items with checkboxes + progress bar
  - Each item: checkbox, label. Toggling calls `toggleChecklistCheck(checkId, !checked)`
  - Progress bar: `checked / total` items, with percentage label
  - "Changer de checklist" button (removes current + applies new)
- **Create template sheet**: name input + dynamic list of items (add/remove)
  - "Sauvegarder" calls `createChecklistTemplate(name, items)`
- **Delete template**: with AlertDialog confirmation

**Step 2: Replace placeholder in `CompetitionDetail.tsx`**

**Step 3: Verify build + commit**

```bash
git commit -m "feat: implement Checklist tab in competition detail"
```

---

## Task 8: Final Integration & Cleanup

**Files:**
- Remove: `PlaceholderSection` from `CompetitionDetail.tsx` (if no longer used)
- Modify: `CLAUDE.md` — add new files to the key files table
- Modify: `docs/FEATURES_STATUS.md` — update competition feature status
- Modify: `docs/implementation-log.md` — add implementation entry

**Step 1: Remove unused PlaceholderSection**

**Step 2: Update documentation per project workflow**

**Step 3: Final verification**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git commit -m "docs: update project docs for competition detail feature"
```

---

## Dependency Graph

```
Task 1 (DB) → Task 2 (Types) → Task 3 (API) → Task 4 (Courses) → Task 5 (Routines) → Task 6 (Timeline)
                                              → Task 7 (Checklist)
Task 8 (Cleanup) depends on all others
```

Tasks 4-7 can be parallelized after Task 3, but Tasks 5 and 6 depend on Task 4's race data being available.

## Important Implementation Notes

- **athlete_id resolution**: The swimmer doesn't know their integer `users.id`. Use `app_user_id()` in RLS. In the API, get current user's ID via the existing pattern: query `users` table with `auth_id = auth.uid()`, or rely on RLS default.
- **FFN_EVENTS reuse**: Import `FFN_EVENTS` and `eventLabel()` from `src/lib/objectiveHelpers.ts` for the race event selector.
- **Sheet component**: Use `@/components/ui/sheet` (SheetContent side="right") for all add/edit forms.
- **Query keys**: `["competition-races", competitionId]`, `["race-routines", competitionId]`, `["routine-templates"]`, `["checklist-templates"]`, `["competition-checklist", competitionId]`
- **Toast**: Use `useToast` from `@/hooks/use-toast` for success/error feedback.
- **Date range for races**: Constrain `race_day` picker between `competition.date` and `competition.end_date ?? competition.date`.

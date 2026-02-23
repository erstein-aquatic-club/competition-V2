# Competitions & Objectives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new coach sections (Competitions and Objectives) with swimmer-facing displays on the calendar and Progression page.

**Architecture:** Two new Supabase tables (`competitions`, `objectives`) with RLS, two new API modules (`src/lib/api/competitions.ts`, `src/lib/api/objectives.ts`), two new coach screen components, and integration into the existing swimmer Dashboard calendar and Progress page.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), React Query 5, Radix/Shadcn components, Lucide icons.

---

### Task 1: Database Migration — `competitions` table

**Files:**
- Create: `supabase/migrations/20260223100000_create_competitions.sql`

**Step 1: Write and apply the migration**

Apply via Supabase MCP `apply_migration`:

```sql
-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "competitions_select_authenticated"
  ON competitions FOR SELECT
  TO authenticated
  USING (true);

-- Only coach/admin can insert
CREATE POLICY "competitions_insert_coach"
  ON competitions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );

-- Only coach/admin can update
CREATE POLICY "competitions_update_coach"
  ON competitions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );

-- Only coach/admin can delete
CREATE POLICY "competitions_delete_coach"
  ON competitions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );
```

**Step 2: Verify the table exists**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'competitions' ORDER BY ordinal_position;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260223100000_create_competitions.sql
git commit -m "feat: create competitions table with RLS"
```

---

### Task 2: Database Migration — `objectives` table

**Files:**
- Create: `supabase/migrations/20260223100001_create_objectives.sql`

**Step 1: Write and apply the migration**

Apply via Supabase MCP `apply_migration`:

```sql
-- Create objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id),
  competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
  event_code TEXT,
  pool_length INT,
  target_time_seconds NUMERIC,
  text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT objectives_has_content CHECK (target_time_seconds IS NOT NULL OR text IS NOT NULL)
);

-- Index for fast athlete lookups
CREATE INDEX idx_objectives_athlete_id ON objectives(athlete_id);

-- RLS
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

-- Athlete can read own objectives + coach/admin can read all
CREATE POLICY "objectives_select"
  ON objectives FOR SELECT
  TO authenticated
  USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );

-- Only coach/admin can insert
CREATE POLICY "objectives_insert_coach"
  ON objectives FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );

-- Only coach/admin can update
CREATE POLICY "objectives_update_coach"
  ON objectives FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );

-- Only coach/admin can delete
CREATE POLICY "objectives_delete_coach"
  ON objectives FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('coach', 'admin')
    )
  );
```

**Step 2: Verify the table exists**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'objectives' ORDER BY ordinal_position;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260223100001_create_objectives.sql
git commit -m "feat: create objectives table with RLS"
```

---

### Task 3: TypeScript Types

**Files:**
- Modify: `src/lib/api/types.ts` (append at end, after line 415)

**Step 1: Add types**

Append to `src/lib/api/types.ts`:

```typescript
export interface Competition {
  id: string;
  name: string;
  date: string;           // ISO date "YYYY-MM-DD"
  end_date?: string | null;
  location?: string | null;
  description?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface CompetitionInput {
  name: string;
  date: string;
  end_date?: string | null;
  location?: string | null;
  description?: string | null;
}

export interface Objective {
  id: string;
  athlete_id: string;
  competition_id?: string | null;
  event_code?: string | null;
  pool_length?: number | null;
  target_time_seconds?: number | null;
  text?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  // Joined fields
  competition_name?: string | null;
  competition_date?: string | null;
  athlete_name?: string | null;
}

export interface ObjectiveInput {
  athlete_id: string;
  competition_id?: string | null;
  event_code?: string | null;
  pool_length?: number | null;
  target_time_seconds?: number | null;
  text?: string | null;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat: add Competition and Objective types"
```

---

### Task 4: API Module — Competitions

**Files:**
- Create: `src/lib/api/competitions.ts`
- Modify: `src/lib/api/index.ts` (add re-exports)
- Modify: `src/lib/api.ts` (add facade methods)

**Step 1: Create `src/lib/api/competitions.ts`**

Follow the pattern from `src/lib/api/temporary-groups.ts`:

```typescript
/**
 * API Competitions - CRUD for coach competition management
 */

import { supabase, canUseSupabase } from "./client";
import type { Competition, CompetitionInput } from "./types";

export async function getCompetitions(): Promise<Competition[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Competition[];
}

export async function createCompetition(input: CompetitionInput): Promise<Competition> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("competitions")
    .insert({ ...input, created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Competition;
}

export async function updateCompetition(id: string, input: Partial<CompetitionInput>): Promise<Competition> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("competitions")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Competition;
}

export async function deleteCompetition(id: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { error } = await supabase
    .from("competitions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

**Step 2: Add re-exports to `src/lib/api/index.ts`**

After the temporary-groups re-exports (around line 184), add:

```typescript
export {
  getCompetitions,
  createCompetition,
  updateCompetition,
  deleteCompetition,
} from './competitions';
```

**Step 3: Add facade methods to `src/lib/api.ts`**

Import at top alongside other imports, then add to the `api` object:

```typescript
// In imports:
import {
  getCompetitions as _getCompetitions,
  createCompetition as _createCompetition,
  updateCompetition as _updateCompetition,
  deleteCompetition as _deleteCompetition,
} from './api/competitions';

// In api object:
async getCompetitions() { return _getCompetitions(); },
async createCompetition(input: Parameters<typeof _createCompetition>[0]) { return _createCompetition(input); },
async updateCompetition(id: string, input: Parameters<typeof _updateCompetition>[1]) { return _updateCompetition(id, input); },
async deleteCompetition(id: string) { return _deleteCompetition(id); },
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/api/competitions.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add competitions API module"
```

---

### Task 5: API Module — Objectives

**Files:**
- Create: `src/lib/api/objectives.ts`
- Modify: `src/lib/api/index.ts` (add re-exports)
- Modify: `src/lib/api.ts` (add facade methods)

**Step 1: Create `src/lib/api/objectives.ts`**

```typescript
/**
 * API Objectives - CRUD for coach objective management
 */

import { supabase, canUseSupabase } from "./client";
import type { Objective, ObjectiveInput } from "./types";

export async function getObjectives(athleteId?: string): Promise<Objective[]> {
  if (!canUseSupabase()) return [];
  let query = supabase
    .from("objectives")
    .select("*, competitions(name, date)")
    .order("created_at", { ascending: false });
  if (athleteId) {
    query = query.eq("athlete_id", athleteId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    athlete_id: row.athlete_id,
    competition_id: row.competition_id,
    event_code: row.event_code,
    pool_length: row.pool_length,
    target_time_seconds: row.target_time_seconds,
    text: row.text,
    created_by: row.created_by,
    created_at: row.created_at,
    competition_name: row.competitions?.name ?? null,
    competition_date: row.competitions?.date ?? null,
  })) as Objective[];
}

export async function getAthleteObjectives(): Promise<Objective[]> {
  if (!canUseSupabase()) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return getObjectives(user.id);
}

export async function createObjective(input: ObjectiveInput): Promise<Objective> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("objectives")
    .insert({ ...input, created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Objective;
}

export async function updateObjective(id: string, input: Partial<ObjectiveInput>): Promise<Objective> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("objectives")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Objective;
}

export async function deleteObjective(id: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { error } = await supabase
    .from("objectives")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

**Step 2: Add re-exports to `src/lib/api/index.ts`**

After the competitions re-exports, add:

```typescript
export {
  getObjectives,
  getAthleteObjectives,
  createObjective,
  updateObjective,
  deleteObjective,
} from './objectives';
```

**Step 3: Add facade methods to `src/lib/api.ts`**

```typescript
// In imports:
import {
  getObjectives as _getObjectives,
  getAthleteObjectives as _getAthleteObjectives,
  createObjective as _createObjective,
  updateObjective as _updateObjective,
  deleteObjective as _deleteObjective,
} from './api/objectives';

// In api object:
async getObjectives(athleteId?: string) { return _getObjectives(athleteId); },
async getAthleteObjectives() { return _getAthleteObjectives(); },
async createObjective(input: Parameters<typeof _createObjective>[0]) { return _createObjective(input); },
async updateObjective(id: string, input: Parameters<typeof _updateObjective>[1]) { return _updateObjective(id, input); },
async deleteObjective(id: string) { return _deleteObjective(id); },
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/api/objectives.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add objectives API module"
```

---

### Task 6: Coach Competitions Screen

**Files:**
- Create: `src/pages/coach/CoachCompetitionsScreen.tsx`

**Step 1: Create the component**

Build following the pattern of `CoachGroupsScreen.tsx`:
- Props: `onBack: () => void`
- React Query: `useQuery({ queryKey: ["competitions"], queryFn: () => api.getCompetitions() })`
- Mutations: create, update, delete with `invalidateQueries(["competitions"])`
- UI:
  - `CoachSectionHeader` with title "Compétitions", back button
  - List of competition cards, sorted by date (upcoming first)
  - Each card: name, date formatted "dd/MM/yyyy", "J-X" badge if upcoming, location, "Passée" badge if past
  - "+" button to open creation Sheet
  - Sheet (from Shadcn) for create/edit form:
    - Input: name (required)
    - Date picker: date (required) — use native `<input type="date">`
    - Toggle: "Multi-jours" → reveals end_date input
    - Input: location
    - Textarea: description
    - Save / Delete (with AlertDialog confirmation) buttons
- Empty state: "Aucune compétition" message with a CTA to add one

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/pages/coach/CoachCompetitionsScreen.tsx
git commit -m "feat: add CoachCompetitionsScreen component"
```

---

### Task 7: Coach Objectives Screen

**Files:**
- Create: `src/pages/coach/CoachObjectivesScreen.tsx`

**Step 1: Create the component**

Build following the same pattern as Task 6:
- Props: `onBack: () => void; athletes: Array<{ id: number | null; display_name: string; group_label?: string | null }>; athletesLoading: boolean`
- State: `selectedAthleteId: string | null`
- React Query: `useQuery({ queryKey: ["objectives", selectedAthleteId], queryFn: () => api.getObjectives(selectedAthleteId!), enabled: !!selectedAthleteId })`
- Also query competitions for the link dropdown: `useQuery({ queryKey: ["competitions"], queryFn: () => api.getCompetitions() })`
- Mutations: create, update, delete with `invalidateQueries(["objectives"])`
- UI:
  - `CoachSectionHeader` with title "Objectifs", back button
  - Athlete selector (Select from Shadcn) at top — list all athletes, show group badge
  - List of objectives for selected athlete:
    - Chrono objectives: event_code label + time formatted (mm:ss.cc) + pool badge (25m/50m)
    - Text objectives: the text content
    - Competition badge if linked
  - "+" button to add objective (disabled until athlete selected)
  - Sheet for create/edit form:
    - Athlete (pre-filled, read-only if coming from selector)
    - Type toggle (Chrono / Texte / Les deux) using ToggleGroup
    - If chrono: event_code Select (use FFN event codes like "50NL", "100NL", "200NL", "400NL", "800NL", "1500NL", "50DOS", "100DOS", "200DOS", "50BR", "100BR", "200BR", "50PAP", "100PAP", "200PAP", "200QN", "4004N"), pool_length Select (25/50), target_time Input (mm:ss.cc format)
    - If texte: Textarea for free text
    - Competition link: optional Select from competitions list
    - Save / Delete buttons
- Empty states for no athlete selected and no objectives

Helper: time formatting function to convert seconds ↔ mm:ss.cc display:
```typescript
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const centisecs = Math.round((secs - wholeSecs) * 100);
  return `${mins}:${String(wholeSecs).padStart(2, "0")}.${String(centisecs).padStart(2, "0")}`;
}

function parseTime(display: string): number | null {
  const match = display.match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/pages/coach/CoachObjectivesScreen.tsx
git commit -m "feat: add CoachObjectivesScreen component"
```

---

### Task 8: Wire Coach Sections into Coach.tsx

**Files:**
- Modify: `src/pages/Coach.tsx`

**Step 1: Update CoachSection type and imports**

In `src/pages/Coach.tsx`:

1. Update the type (line 25):
```typescript
type CoachSection = "home" | "swim" | "strength" | "swimmers" | "messaging" | "calendar" | "groups" | "competitions" | "objectives";
```

2. Add imports for the new screens (after CoachGroupsScreen import):
```typescript
import CoachCompetitionsScreen from "./coach/CoachCompetitionsScreen";
import CoachObjectivesScreen from "./coach/CoachObjectivesScreen";
```

3. Update `shouldLoadAthletes` condition (line 298-303) to include "objectives":
```typescript
const shouldLoadAthletes =
  activeSection === "home" ||
  activeSection === "messaging" ||
  activeSection === "swimmers" ||
  activeSection === "calendar" ||
  activeSection === "groups" ||
  activeSection === "objectives";
```

4. Add the section renderers after the groups section (after line 613):

```tsx
{activeSection === "competitions" ? (
  <CoachCompetitionsScreen
    onBack={() => setActiveSection("home")}
  />
) : null}

{activeSection === "objectives" ? (
  <CoachObjectivesScreen
    onBack={() => setActiveSection("home")}
    athletes={athletes}
    athletesLoading={athletesLoading}
  />
) : null}
```

5. Add navigation cards to CoachHome — in the 2x2 grid area, add two more cards for Compétitions (Trophy icon, orange) and Objectifs (Target icon). Import `Target` from lucide-react.

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

**Step 3: Test manually**

Run: `npm run dev` and navigate to `/#/coach`, verify the two new navigation cards appear and open the correct sections.

**Step 4: Commit**

```bash
git add src/pages/Coach.tsx
git commit -m "feat: wire competitions and objectives sections into coach"
```

---

### Task 9: Swimmer Dashboard — Competition Events in Calendar

**Files:**
- Modify: `src/hooks/useDashboardState.ts`
- Modify: `src/components/dashboard/DayCell.tsx`
- Possibly modify: `src/pages/Dashboard.tsx`

**Step 1: Fetch competitions in Dashboard**

In `src/pages/Dashboard.tsx`, add a query for competitions:

```typescript
const { data: competitions = [] } = useQuery({
  queryKey: ["competitions"],
  queryFn: () => api.getCompetitions(),
});
```

Pass `competitions` to `useDashboardState`.

**Step 2: Add competition markers to useDashboardState**

Extend the state to include competition data per day. Add a `competitionsForDay` Map or include competition info in the day data structure so `DayCell` can render a trophy icon + "J-X" for days with competitions.

**Step 3: Render competition markers in DayCell**

In `DayCell.tsx`, when a day has a competition:
- Show a small Trophy icon (orange/gold color)
- If the competition is in the future, show "J-X" badge

**Step 4: Add a "next competition" banner at the top of the Dashboard**

Above the calendar, if there's an upcoming competition, display:
- Trophy icon + competition name + "J-X" in a highlighted card

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`

**Step 6: Test manually**

Run `npm run dev`, create a competition as coach, then switch to swimmer view and verify it appears on the calendar.

**Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx src/hooks/useDashboardState.ts src/components/dashboard/DayCell.tsx
git commit -m "feat: show competition markers on swimmer dashboard calendar"
```

---

### Task 10: Swimmer Progression Page — Objectives Section

**Files:**
- Modify: `src/pages/Progress.tsx`

**Step 1: Add objectives query**

In `Progress.tsx`, add a query for athlete objectives:

```typescript
const { data: objectives = [] } = useQuery({
  queryKey: ["my-objectives"],
  queryFn: () => api.getAthleteObjectives(),
});
```

**Step 2: Add "Mes objectifs" section**

Add a new section (Card) near the top of the Progress page, before the existing charts:
- Title: "Mes objectifs" with Target icon
- List of objectives:
  - Chrono: event label + pool badge + target time (formatted mm:ss.cc)
  - Text: objective text
  - If linked to competition: competition name + "J-X" badge if upcoming
- Empty state: "Aucun objectif défini" message

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`

**Step 4: Test manually**

Run `npm run dev`, create objectives as coach for a swimmer, then view as that swimmer on the Progress page.

**Step 5: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "feat: show coach-defined objectives on swimmer Progress page"
```

---

### Task 11: Documentation Updates

**Files:**
- Modify: `CLAUDE.md` — add competitions.ts and objectives.ts to key files table, add chantier 27+28 to roadmap table
- Modify: `docs/ROADMAP.md` — add chantier entries
- Modify: `docs/FEATURES_STATUS.md` — add competition and objective features
- Modify: `docs/implementation-log.md` — add implementation entry

**Step 1: Update all four doc files**

Follow the documentation workflow described in CLAUDE.md:
- Add entries for the two new API modules in the key files table
- Add chantier entries (§59 Compétitions coach, §60 Objectifs coach) to ROADMAP
- Mark features as ✅ in FEATURES_STATUS
- Write implementation log entry with context, changes, files modified, decisions

**Step 2: Commit**

```bash
git add CLAUDE.md docs/ROADMAP.md docs/FEATURES_STATUS.md docs/implementation-log.md
git commit -m "docs: add competitions & objectives implementation log"
```

---

### Task 12: Final Verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing story errors OK).

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass (pre-existing TimesheetHelpers failure OK).

**Step 3: Build**

Run: `npm run build`
Expected: Successful production build.

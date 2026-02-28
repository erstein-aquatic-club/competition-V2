# Planification & Entretiens Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Planification (training cycles/weeks) and Entretiens (multi-phase interviews) tabs in the coach swimmer detail page, plus the athlete-side interview view.

**Architecture:** 3 new Supabase tables with RLS. 2 new API modules (`planning.ts`, `interviews.ts`) following the existing CRUD pattern (see `objectives.ts`). 6 new React components wired into the existing `CoachSwimmerDetail.tsx` tab structure. Athlete interview view added to Profile.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), React Query 5, Shadcn UI (Tabs, Sheet, Badge, Accordion), Tailwind CSS 4, Wouter hash routing

---

### Task 1: SQL Migration — training_cycles + training_weeks tables

**Files:**
- Create: `supabase/migrations/00034_training_cycles.sql`

**Step 1: Write the migration SQL**

Apply via Supabase MCP tool `apply_migration` with project ID `fscnobivsgornxdwqwlk`:

```sql
-- =============================================================================
-- Migration 00034: Training cycles (macro-cycles) + weeks (micro-cycles)
-- =============================================================================

-- 1. Training cycles (macro-cycles between competitions)
CREATE TABLE training_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  athlete_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  end_competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT training_cycles_has_target CHECK (group_id IS NOT NULL OR athlete_id IS NOT NULL)
);

CREATE INDEX idx_training_cycles_group ON training_cycles(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_training_cycles_athlete ON training_cycles(athlete_id) WHERE athlete_id IS NOT NULL;

-- 2. Training weeks (micro-cycles within a macro-cycle)
CREATE TABLE training_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES training_cycles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_type TEXT,
  notes TEXT,
  UNIQUE(cycle_id, week_start)
);

CREATE INDEX idx_training_weeks_cycle ON training_weeks(cycle_id);

-- 3. RLS policies
ALTER TABLE training_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_weeks ENABLE ROW LEVEL SECURITY;

-- training_cycles: everyone can read, coach/admin can write
CREATE POLICY training_cycles_select ON training_cycles FOR SELECT USING (true);
CREATE POLICY training_cycles_insert ON training_cycles FOR INSERT
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_cycles_update ON training_cycles FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_cycles_delete ON training_cycles FOR DELETE
  USING (app_user_role() IN ('admin', 'coach'));

-- training_weeks: everyone can read, coach/admin can write
CREATE POLICY training_weeks_select ON training_weeks FOR SELECT USING (true);
CREATE POLICY training_weeks_insert ON training_weeks FOR INSERT
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_weeks_update ON training_weeks FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_weeks_delete ON training_weeks FOR DELETE
  USING (app_user_role() IN ('admin', 'coach'));
```

**Step 2: Apply the migration**

Run: `apply_migration` via Supabase MCP with name `training_cycles` and the SQL above.

**Step 3: Save migration file locally**

Save the same SQL to `supabase/migrations/00034_training_cycles.sql` for version control.

**Step 4: Verify tables exist**

Run: `execute_sql` via Supabase MCP:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('training_cycles', 'training_weeks');
```
Expected: 2 rows.

**Step 5: Commit**

```bash
git add supabase/migrations/00034_training_cycles.sql
git commit -m "feat: add training_cycles and training_weeks tables (§74)"
```

---

### Task 2: SQL Migration — interviews table

**Files:**
- Create: `supabase/migrations/00035_interviews.sql`

**Step 1: Write the migration SQL**

```sql
-- =============================================================================
-- Migration 00035: Interviews (multi-phase entretiens individuels)
-- =============================================================================

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft_athlete'
    CHECK (status IN ('draft_athlete', 'draft_coach', 'sent', 'signed')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Athlete sections (phase 1)
  athlete_successes TEXT,
  athlete_difficulties TEXT,
  athlete_goals TEXT,
  athlete_commitments TEXT,
  -- Coach sections (phase 2)
  coach_review TEXT,
  coach_objectives TEXT,
  coach_actions TEXT,
  -- Context
  current_cycle_id UUID REFERENCES training_cycles(id) ON DELETE SET NULL,
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interviews_athlete ON interviews(athlete_id);
CREATE INDEX idx_interviews_status ON interviews(status);

-- RLS: phase-based access control
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Coach/admin can always read all interviews
CREATE POLICY interviews_coach_select ON interviews FOR SELECT
  USING (app_user_role() IN ('admin', 'coach'));

-- Athlete can read own interviews ONLY when status is draft_athlete, sent, or signed
-- (NOT draft_coach — interview is hidden during coach preparation)
CREATE POLICY interviews_athlete_select ON interviews FOR SELECT
  USING (
    app_user_role() = 'athlete'
    AND athlete_id = (SELECT id FROM users WHERE auth_uid = auth.uid() LIMIT 1)
    AND status IN ('draft_athlete', 'sent', 'signed')
  );

-- Coach/admin can insert (initiate interviews)
CREATE POLICY interviews_coach_insert ON interviews FOR INSERT
  WITH CHECK (app_user_role() IN ('admin', 'coach'));

-- Coach can update coach sections + status transitions (draft_coach -> sent)
CREATE POLICY interviews_coach_update ON interviews FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach'));

-- Athlete can update own interviews ONLY in draft_athlete status (their sections)
-- and can update status from sent -> signed (signature)
CREATE POLICY interviews_athlete_update ON interviews FOR UPDATE
  USING (
    app_user_role() = 'athlete'
    AND athlete_id = (SELECT id FROM users WHERE auth_uid = auth.uid() LIMIT 1)
    AND status IN ('draft_athlete', 'sent')
  );

-- Only coach/admin can delete
CREATE POLICY interviews_coach_delete ON interviews FOR DELETE
  USING (app_user_role() IN ('admin', 'coach'));
```

**Step 2: Apply the migration**

Run: `apply_migration` via Supabase MCP with name `interviews`.

**Step 3: Save migration file locally**

Save to `supabase/migrations/00035_interviews.sql`.

**Step 4: Verify table exists**

Run: `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'interviews' ORDER BY ordinal_position;
```
Expected: 17 columns.

**Step 5: Commit**

```bash
git add supabase/migrations/00035_interviews.sql
git commit -m "feat: add interviews table with phase-based RLS (§74)"
```

---

### Task 3: API module — planning.ts (CRUD cycles + weeks)

**Files:**
- Create: `src/lib/api/planning.ts`
- Modify: `src/lib/api/types.ts` — add interfaces
- Modify: `src/lib/api/index.ts` — re-export
- Modify: `src/lib/api.ts` — add delegation stubs

**Step 1: Add TypeScript interfaces to `src/lib/api/types.ts`**

Append after the `PlannedAbsence` interface (around line 482):

```typescript
export interface TrainingCycle {
  id: string;
  group_id?: number | null;
  athlete_id?: number | null;
  start_competition_id: string;
  end_competition_id: string;
  name: string;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  // Joined fields
  start_competition_name?: string | null;
  start_competition_date?: string | null;
  end_competition_name?: string | null;
  end_competition_date?: string | null;
}

export interface TrainingCycleInput {
  group_id?: number | null;
  athlete_id?: number | null;
  start_competition_id: string;
  end_competition_id: string;
  name: string;
  notes?: string | null;
}

export interface TrainingWeek {
  id: string;
  cycle_id: string;
  week_start: string;
  week_type?: string | null;
  notes?: string | null;
}

export interface TrainingWeekInput {
  cycle_id: string;
  week_start: string;
  week_type?: string | null;
  notes?: string | null;
}
```

**Step 2: Create `src/lib/api/planning.ts`**

```typescript
/**
 * API Planning - CRUD for training cycles (macro) and weeks (micro)
 */

import { supabase, canUseSupabase } from "./client";
import type { TrainingCycle, TrainingCycleInput, TrainingWeek, TrainingWeekInput } from "./types";

// ── Cycles ──

export async function getTrainingCycles(opts?: {
  athleteId?: number;
  groupId?: number;
}): Promise<TrainingCycle[]> {
  if (!canUseSupabase()) return [];
  let query = supabase
    .from("training_cycles")
    .select("*, start_comp:competitions!start_competition_id(name, date), end_comp:competitions!end_competition_id(name, date)")
    .order("created_at", { ascending: false });
  if (opts?.athleteId) query = query.eq("athlete_id", opts.athleteId);
  if (opts?.groupId) query = query.eq("group_id", opts.groupId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    group_id: row.group_id,
    athlete_id: row.athlete_id,
    start_competition_id: row.start_competition_id,
    end_competition_id: row.end_competition_id,
    name: row.name,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    start_competition_name: row.start_comp?.name ?? null,
    start_competition_date: row.start_comp?.date ?? null,
    end_competition_name: row.end_comp?.name ?? null,
    end_competition_date: row.end_comp?.date ?? null,
  }));
}

export async function createTrainingCycle(input: TrainingCycleInput): Promise<TrainingCycle> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("training_cycles")
    .insert({ ...input, created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TrainingCycle;
}

export async function updateTrainingCycle(id: string, input: Partial<TrainingCycleInput>): Promise<TrainingCycle> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("training_cycles")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TrainingCycle;
}

export async function deleteTrainingCycle(id: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { error } = await supabase
    .from("training_cycles")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Weeks ──

export async function getTrainingWeeks(cycleId: string): Promise<TrainingWeek[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("training_weeks")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("week_start", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingWeek[];
}

export async function upsertTrainingWeek(input: TrainingWeekInput): Promise<TrainingWeek> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("training_weeks")
    .upsert(input, { onConflict: "cycle_id,week_start" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TrainingWeek;
}

export async function bulkUpsertTrainingWeeks(weeks: TrainingWeekInput[]): Promise<TrainingWeek[]> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  if (weeks.length === 0) return [];
  const { data, error } = await supabase
    .from("training_weeks")
    .upsert(weeks, { onConflict: "cycle_id,week_start" })
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainingWeek[];
}

export async function deleteTrainingWeek(id: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { error } = await supabase
    .from("training_weeks")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

**Step 3: Add re-exports to `src/lib/api/index.ts`**

Append after the absences export block:

```typescript
export {
  getTrainingCycles,
  createTrainingCycle,
  updateTrainingCycle,
  deleteTrainingCycle,
  getTrainingWeeks,
  upsertTrainingWeek,
  bulkUpsertTrainingWeeks,
  deleteTrainingWeek,
} from './planning';
```

**Step 4: Add delegation stubs to `src/lib/api.ts`**

Add import block after the absences import:

```typescript
import {
  getTrainingCycles as _getTrainingCycles,
  createTrainingCycle as _createTrainingCycle,
  updateTrainingCycle as _updateTrainingCycle,
  deleteTrainingCycle as _deleteTrainingCycle,
  getTrainingWeeks as _getTrainingWeeks,
  upsertTrainingWeek as _upsertTrainingWeek,
  bulkUpsertTrainingWeeks as _bulkUpsertTrainingWeeks,
  deleteTrainingWeek as _deleteTrainingWeek,
} from './api/planning';
```

Add type re-exports at the top:

```typescript
TrainingCycle,
TrainingCycleInput,
TrainingWeek,
TrainingWeekInput,
```

Add delegation stubs in the `api` object after the absences section:

```typescript
  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Training Planning
  // ══════════════════════════════════════════════════════════════════
  async getTrainingCycles(opts?: Parameters<typeof _getTrainingCycles>[0]) { return _getTrainingCycles(opts); },
  async createTrainingCycle(input: Parameters<typeof _createTrainingCycle>[0]) { return _createTrainingCycle(input); },
  async updateTrainingCycle(id: string, input: Parameters<typeof _updateTrainingCycle>[1]) { return _updateTrainingCycle(id, input); },
  async deleteTrainingCycle(id: string) { return _deleteTrainingCycle(id); },
  async getTrainingWeeks(cycleId: string) { return _getTrainingWeeks(cycleId); },
  async upsertTrainingWeek(input: Parameters<typeof _upsertTrainingWeek>[0]) { return _upsertTrainingWeek(input); },
  async bulkUpsertTrainingWeeks(weeks: Parameters<typeof _bulkUpsertTrainingWeeks>[0]) { return _bulkUpsertTrainingWeeks(weeks); },
  async deleteTrainingWeek(id: string) { return _deleteTrainingWeek(id); },
```

**Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/lib/api/planning.ts src/lib/api/types.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add planning API module (cycles + weeks CRUD) (§74)"
```

---

### Task 4: API module — interviews.ts (CRUD + transitions)

**Files:**
- Create: `src/lib/api/interviews.ts`
- Modify: `src/lib/api/types.ts` — add interfaces
- Modify: `src/lib/api/index.ts` — re-export
- Modify: `src/lib/api.ts` — add delegation stubs

**Step 1: Add TypeScript interfaces to `src/lib/api/types.ts`**

Append after the TrainingWeekInput interface:

```typescript
export type InterviewStatus = 'draft_athlete' | 'draft_coach' | 'sent' | 'signed';

export interface Interview {
  id: string;
  athlete_id: number;
  status: InterviewStatus;
  date: string;
  athlete_successes?: string | null;
  athlete_difficulties?: string | null;
  athlete_goals?: string | null;
  athlete_commitments?: string | null;
  coach_review?: string | null;
  coach_objectives?: string | null;
  coach_actions?: string | null;
  current_cycle_id?: string | null;
  submitted_at?: string | null;
  sent_at?: string | null;
  signed_at?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface InterviewCreateInput {
  athlete_id: number;
  date?: string;
  current_cycle_id?: string | null;
}

export interface InterviewAthleteInput {
  athlete_successes?: string | null;
  athlete_difficulties?: string | null;
  athlete_goals?: string | null;
  athlete_commitments?: string | null;
}

export interface InterviewCoachInput {
  coach_review?: string | null;
  coach_objectives?: string | null;
  coach_actions?: string | null;
}
```

**Step 2: Create `src/lib/api/interviews.ts`**

```typescript
/**
 * API Interviews - Multi-phase interview workflow
 *
 * Flow: coach creates (draft_athlete) → athlete fills & submits (draft_coach)
 *       → coach fills & sends (sent) → athlete signs (signed)
 */

import { supabase, canUseSupabase } from "./client";
import type {
  Interview,
  InterviewCreateInput,
  InterviewAthleteInput,
  InterviewCoachInput,
} from "./types";

export async function getInterviews(athleteId: number): Promise<Interview[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Interview[];
}

export async function getMyInterviews(): Promise<Interview[]> {
  if (!canUseSupabase()) return [];
  // RLS handles filtering: athlete sees only draft_athlete, sent, signed
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // Get the public user id from auth uid
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  if (!userData) return [];
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("athlete_id", userData.id)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Interview[];
}

export async function createInterview(input: InterviewCreateInput): Promise<Interview> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("interviews")
    .insert({
      athlete_id: input.athlete_id,
      date: input.date ?? new Date().toISOString().slice(0, 10),
      current_cycle_id: input.current_cycle_id ?? null,
      status: "draft_athlete",
      created_by: user?.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Interview;
}

/** Athlete updates their sections (phase 1) */
export async function updateInterviewAthleteSections(
  id: string,
  input: InterviewAthleteInput,
): Promise<Interview> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("interviews")
    .update(input)
    .eq("id", id)
    .eq("status", "draft_athlete")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Interview;
}

/** Athlete submits their preparation → moves to draft_coach */
export async function submitInterviewToCoach(id: string): Promise<Interview> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("interviews")
    .update({ status: "draft_coach", submitted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft_athlete")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Interview;
}

/** Coach updates their sections (phase 2) */
export async function updateInterviewCoachSections(
  id: string,
  input: InterviewCoachInput,
): Promise<Interview> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("interviews")
    .update(input)
    .eq("id", id)
    .eq("status", "draft_coach")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Interview;
}

/** Coach sends the interview to athlete for review → moves to sent */
export async function sendInterviewToAthlete(id: string): Promise<Interview> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("interviews")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft_coach")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Interview;
}

/** Athlete signs the interview → moves to signed */
export async function signInterview(id: string): Promise<Interview> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data, error } = await supabase
    .from("interviews")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sent")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Interview;
}

/** Coach deletes an interview */
export async function deleteInterview(id: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

**Step 3: Add re-exports to `src/lib/api/index.ts`**

Append after the planning export block:

```typescript
export {
  getInterviews,
  getMyInterviews,
  createInterview,
  updateInterviewAthleteSections,
  submitInterviewToCoach,
  updateInterviewCoachSections,
  sendInterviewToAthlete,
  signInterview,
  deleteInterview,
} from './interviews';
```

**Step 4: Add delegation stubs to `src/lib/api.ts`**

Add import block:

```typescript
import {
  getInterviews as _getInterviews,
  getMyInterviews as _getMyInterviews,
  createInterview as _createInterview,
  updateInterviewAthleteSections as _updateInterviewAthleteSections,
  submitInterviewToCoach as _submitInterviewToCoach,
  updateInterviewCoachSections as _updateInterviewCoachSections,
  sendInterviewToAthlete as _sendInterviewToAthlete,
  signInterview as _signInterview,
  deleteInterview as _deleteInterview,
} from './api/interviews';
```

Add type re-exports:

```typescript
InterviewStatus,
Interview,
InterviewCreateInput,
InterviewAthleteInput,
InterviewCoachInput,
```

Add delegation stubs:

```typescript
  // ══════════════════════════════════════════════════════════════════
  // DELEGATION STUBS — Interviews
  // ══════════════════════════════════════════════════════════════════
  async getInterviews(athleteId: number) { return _getInterviews(athleteId); },
  async getMyInterviews() { return _getMyInterviews(); },
  async createInterview(input: Parameters<typeof _createInterview>[0]) { return _createInterview(input); },
  async updateInterviewAthleteSections(id: string, input: Parameters<typeof _updateInterviewAthleteSections>[1]) { return _updateInterviewAthleteSections(id, input); },
  async submitInterviewToCoach(id: string) { return _submitInterviewToCoach(id); },
  async updateInterviewCoachSections(id: string, input: Parameters<typeof _updateInterviewCoachSections>[1]) { return _updateInterviewCoachSections(id, input); },
  async sendInterviewToAthlete(id: string) { return _sendInterviewToAthlete(id); },
  async signInterview(id: string) { return _signInterview(id); },
  async deleteInterview(id: string) { return _deleteInterview(id); },
```

**Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/lib/api/interviews.ts src/lib/api/types.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add interviews API module (multi-phase CRUD) (§74)"
```

---

### Task 5: UI — SwimmerPlanningTab (onglet Planification)

**Files:**
- Create: `src/pages/coach/SwimmerPlanningTab.tsx`
- Modify: `src/pages/coach/CoachSwimmerDetail.tsx` — replace placeholder

**Context:** This component is rendered inside the "planification" tab of `CoachSwimmerDetail.tsx`. It receives `athleteId` (public.users.id integer) as prop. The athlete belongs to a group via `group_members`. The component must:
1. Fetch cycles for this athlete (individual) OR their group (inherited)
2. Display a timeline of weeks within the selected cycle
3. Allow coach to create/edit cycles and type weeks

**Step 1: Create `src/pages/coach/SwimmerPlanningTab.tsx`**

The component should:

- **Props:** `athleteId: number`
- **Queries:**
  - `api.getTrainingCycles({ athleteId })` for individual cycles
  - `api.getAthletes()` to find the athlete's group_id, then `api.getTrainingCycles({ groupId })` for group cycles
  - `api.getTrainingWeeks(selectedCycleId)` for weeks
  - `api.getCompetitions()` for the cycle creation form
- **State:**
  - `selectedCycleId` — currently viewed cycle
  - `isGroupPlan` — whether showing group or individual plan
  - `editingWeekId` — week being edited inline
  - `showCreateSheet` — cycle creation sheet open
- **Layout:**
  - If no cycles: empty state with "Nouveau cycle" button
  - Header: cycle selector dropdown + badge "Planif. groupe" if inherited + "Personnaliser" button
  - Timeline: vertical list of weeks between start and end competition dates
    - Top: start competition badge (name + date)
    - Each week row: `Sem. N (DD/MM - DD/MM)` + colored badge for week_type + notes preview
    - Current week highlighted with ring/border
    - Bottom: end competition badge (name + date)
  - Click week row → inline edit: text input for type (with datalist for autocompletion of existing types) + textarea for notes
  - "Nouveau cycle" button → Sheet with: name input, start competition select, end competition select
- **Week generation:** When creating a cycle, compute all Mondays between `start_competition.date` and `end_competition.date`, call `bulkUpsertTrainingWeeks` to create the week rows.
- **Color for week_type:** Use a deterministic hash function: `hsl(hashCode(type) % 360, 70%, 85%)` for background, darker for text. Same type → same color everywhere.
- **"Personnaliser" button:** When showing a group plan, copy all cycles + weeks from group to individual athlete (new rows with `athlete_id` set, `group_id` null).

**Step 2: Replace placeholder in `CoachSwimmerDetail.tsx`**

Import `SwimmerPlanningTab` and replace the planification `TabsContent` placeholder div with:
```tsx
<SwimmerPlanningTab athleteId={athleteId} />
```

**Step 3: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/pages/coach/SwimmerPlanningTab.tsx src/pages/coach/CoachSwimmerDetail.tsx
git commit -m "feat: add SwimmerPlanningTab with cycle timeline (§74)"
```

---

### Task 6: UI — SwimmerInterviewsTab (onglet Entretiens côté coach)

**Files:**
- Create: `src/pages/coach/SwimmerInterviewsTab.tsx`
- Modify: `src/pages/coach/CoachSwimmerDetail.tsx` — replace placeholder

**Context:** This component is rendered inside the "entretiens" tab of `CoachSwimmerDetail.tsx`. It receives `athleteId` (public.users.id integer) as prop. It shows the coach view of interviews: list + detail/edit.

**Step 1: Create `src/pages/coach/SwimmerInterviewsTab.tsx`**

The component should:

- **Props:** `athleteId: number, athleteName: string`
- **Queries:**
  - `api.getInterviews(athleteId)` — all interviews for this athlete
  - `api.getObjectives(authUid)` — objectives for contextual panel (needs `get_auth_uid_for_user` RPC like SwimmerObjectivesTab)
  - `api.getTrainingCycles({ athleteId })` — for contextual panel (current cycle)
  - `api.getMyCompetitionIds(athleteId)` + `api.getCompetitions()` — for contextual panel (upcoming competitions)
- **Mutations:**
  - `createInterview` — create new interview in draft_athlete
  - `updateInterviewCoachSections` — update coach sections in draft_coach
  - `sendInterviewToAthlete` — transition draft_coach → sent
  - `deleteInterview` — delete an interview
- **Layout:**
  - **List view:** Chronological desc. Each row: date + status badge (colored: jaune=draft_athlete "En attente nageur", bleu=draft_coach "Préparation coach", vert=sent "Envoyé", gris=signed "Signé") + short preview of content
  - **"Nouvel entretien" button** at top → calls `createInterview({ athlete_id: athleteId })`
  - **Click row → Sheet** with interview detail:
    - If `draft_athlete`: read-only message "En attente de la préparation du nageur. Contenu non visible."
    - If `draft_coach`: athlete sections (4 textareas, read-only with label) + coach sections (3 textareas, editable) + contextual accordion (objectifs, planification, compétitions) + "Envoyer au nageur" button
    - If `sent` or `signed`: all 7 sections in read-only + status/dates
- **Status badges:**
  - `draft_athlete` → yellow "En attente nageur"
  - `draft_coach` → blue "Préparation coach"
  - `sent` → green "Envoyé"
  - `signed` → gray "Signé"
- **Contextual accordion** (visible in `draft_coach` only):
  - **Objectifs:** list of athlete objectives (event + target time or text)
  - **Planification:** current cycle name + current week type (if any cycle exists)
  - **Compétitions:** next assigned competitions (name + date)

**Step 2: Replace placeholder in `CoachSwimmerDetail.tsx`**

Import `SwimmerInterviewsTab` and replace the entretiens `TabsContent` placeholder div with:
```tsx
<SwimmerInterviewsTab athleteId={athleteId} athleteName={displayName} />
```

**Step 3: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/pages/coach/SwimmerInterviewsTab.tsx src/pages/coach/CoachSwimmerDetail.tsx
git commit -m "feat: add SwimmerInterviewsTab with multi-phase workflow (§74)"
```

---

### Task 7: UI — Athlete interviews section (côté nageur)

**Files:**
- Create: `src/components/profile/AthleteInterviewsSection.tsx`
- Modify: `src/pages/Profile.tsx` — add interviews section

**Context:** Athletes need to see their interviews in their profile page. They can:
- See interviews in `draft_athlete` status → editable form (4 sections) + "Envoyer au coach" button
- See interviews in `sent` status → read-only (all 7 sections) + "Signer" button
- See interviews in `signed` status → read-only (all 7 sections), archived
- NOT see interviews in `draft_coach` status (hidden)

**Step 1: Create `src/components/profile/AthleteInterviewsSection.tsx`**

The component should:

- **Props:** none (uses auth context to get current user)
- **Queries:**
  - `api.getMyInterviews()` — filtered by RLS (excludes draft_coach)
- **Mutations:**
  - `updateInterviewAthleteSections` — save athlete sections
  - `submitInterviewToCoach` — transition draft_athlete → draft_coach
  - `signInterview` — transition sent → signed
- **Layout:**
  - Section header: "Mes entretiens" with count badge
  - If no interviews: empty state "Aucun entretien en cours"
  - List of interviews, each as a card:
    - Date + status badge
    - If `draft_athlete`: expandable form with 4 textareas (Réussites, Difficultés, Objectifs, Engagements) + "Envoyer au coach" button (with confirm)
    - If `sent`: expandable read-only view of all 7 sections + "Signer" button (with confirm)
    - If `signed`: expandable read-only view of all 7 sections + "Signé le DD/MM/YYYY" label

**Step 2: Add to Profile.tsx**

Find the appropriate location in Profile.tsx (after the objectives section or as a new section) and add:

```tsx
import AthleteInterviewsSection from "@/components/profile/AthleteInterviewsSection";

// In the JSX, add after the existing sections:
<AthleteInterviewsSection />
```

**Step 3: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/components/profile/AthleteInterviewsSection.tsx src/pages/Profile.tsx
git commit -m "feat: add athlete interviews section in Profile (§74)"
```

---

### Task 8: Build verification + documentation

**Files:**
- Modify: `docs/implementation-log.md` — add §74 entry
- Modify: `docs/ROADMAP.md` — add chantier §74
- Modify: `docs/FEATURES_STATUS.md` — update feature status
- Modify: `CLAUDE.md` — add new key files

**Step 1: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors

**Step 2: Add implementation log entry**

Add entry for §74 in `docs/implementation-log.md` covering:
- 3 new Supabase tables (training_cycles, training_weeks, interviews)
- 2 new API modules (planning.ts, interviews.ts)
- 3 new UI components (SwimmerPlanningTab, SwimmerInterviewsTab, AthleteInterviewsSection)
- Files modified (CoachSwimmerDetail.tsx, Profile.tsx, types.ts, index.ts, api.ts)

**Step 3: Update ROADMAP.md**

Add chantier 37 in the vue d'ensemble table:
```
| 37 | Planification & Entretiens (fiche nageur V2) | Haute | Haute | Fait (§74) |
```

**Step 4: Update FEATURES_STATUS.md**

Update relevant entries for planification and entretiens features.

**Step 5: Update CLAUDE.md**

Add new key files:
- `src/lib/api/planning.ts`
- `src/lib/api/interviews.ts`
- `src/pages/coach/SwimmerPlanningTab.tsx`
- `src/pages/coach/SwimmerInterviewsTab.tsx`
- `src/components/profile/AthleteInterviewsSection.tsx`

**Step 6: Commit**

```bash
git add docs/implementation-log.md docs/ROADMAP.md docs/FEATURES_STATUS.md CLAUDE.md
git commit -m "docs: add planification & entretiens to implementation log and roadmap (§74)"
```

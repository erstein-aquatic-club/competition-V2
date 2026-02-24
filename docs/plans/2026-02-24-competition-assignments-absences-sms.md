# Competition Assignments, Planned Absences, Training Counter & SMS — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow coaches to assign competitions to groups/swimmers (multiselect), let swimmers mark planned days off with a reason, show remaining training sessions before next competition, and enable free group SMS via native `sms:` URI.

**Architecture:** 3 DB migrations (competition_assignments table, planned_absences table, phone column). Coach competition form enhanced with athlete multiselect. Swimmer dashboard gains absence marking + training counter. SMS via `sms:` link opens native messaging app. All RLS uses existing `app_user_role()` pattern.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Radix/Shadcn, React Query 5, Supabase (PostgreSQL + RLS)

---

### Task 1: DB Migration — `competition_assignments` table

**Files:**
- Apply via Supabase MCP: migration `create_competition_assignments`

**Step 1: Apply migration**

```sql
-- Create competition_assignments join table
CREATE TABLE competition_assignments (
  id SERIAL PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (competition_id, athlete_id)
);

CREATE INDEX idx_comp_assign_competition ON competition_assignments (competition_id);
CREATE INDEX idx_comp_assign_athlete ON competition_assignments (athlete_id);

-- RLS
ALTER TABLE competition_assignments ENABLE ROW LEVEL SECURITY;

-- Coach/admin: full access
CREATE POLICY comp_assign_coach_all ON competition_assignments
  FOR ALL USING (app_user_role() IN ('coach', 'admin'));

-- Athletes: can see their own assignments
CREATE POLICY comp_assign_athlete_select ON competition_assignments
  FOR SELECT USING (
    athlete_id = (
      SELECT id FROM users
      WHERE auth_uid = auth.uid()
      LIMIT 1
    )
  );
```

Use `mcp__claude_ai_Supabase__apply_migration` with project_id `fscnobivsgornxdwqwlk`.

**Step 2: Verify table exists**

Run: `mcp__claude_ai_Supabase__execute_sql` with `SELECT count(*) FROM competition_assignments;`
Expected: Returns 0 rows, no error.

---

### Task 2: DB Migration — `planned_absences` table

**Files:**
- Apply via Supabase MCP: migration `create_planned_absences`

**Step 1: Apply migration**

```sql
-- Create planned_absences table
CREATE TABLE planned_absences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_planned_absences_user_date ON planned_absences (user_id, date);

-- RLS
ALTER TABLE planned_absences ENABLE ROW LEVEL SECURITY;

-- Athletes: manage their own absences
CREATE POLICY planned_absences_own ON planned_absences
  FOR ALL USING (
    user_id = (
      SELECT id FROM users
      WHERE auth_uid = auth.uid()
      LIMIT 1
    )
  );

-- Coach/admin: read all
CREATE POLICY planned_absences_coach_read ON planned_absences
  FOR SELECT USING (app_user_role() IN ('coach', 'admin'));
```

Use `mcp__claude_ai_Supabase__apply_migration` with project_id `fscnobivsgornxdwqwlk`.

**Step 2: Verify table exists**

Run: `mcp__claude_ai_Supabase__execute_sql` with `SELECT count(*) FROM planned_absences;`
Expected: Returns 0 rows, no error.

---

### Task 3: DB Migration — add `phone` column to `user_profiles`

**Files:**
- Apply via Supabase MCP: migration `add_phone_to_user_profiles`

**Step 1: Apply migration**

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
```

Use `mcp__claude_ai_Supabase__apply_migration` with project_id `fscnobivsgornxdwqwlk`.

**Step 2: Verify column exists**

Run: `mcp__claude_ai_Supabase__execute_sql` with:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone';
```
Expected: Returns 1 row.

---

### Task 4: Types + API — `competition_assignments` CRUD

**Files:**
- Modify: `src/lib/api/types.ts` — Add `CompetitionAssignment` interface
- Modify: `src/lib/api/competitions.ts` — Add assignment functions
- Modify: `src/lib/api/index.ts` — Add re-exports
- Modify: `src/lib/api.ts` — Add facade methods

**Step 1: Add types**

In `src/lib/api/types.ts`, add after `CompetitionInput`:

```typescript
export interface CompetitionAssignment {
  id: number;
  competition_id: string;
  athlete_id: number;
  assigned_at?: string | null;
}
```

**Step 2: Add API functions in competitions.ts**

Add to `src/lib/api/competitions.ts`:

```typescript
export async function getCompetitionAssignments(competitionId: string): Promise<CompetitionAssignment[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("competition_assignments")
    .select("*")
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CompetitionAssignment[];
}

export async function setCompetitionAssignments(
  competitionId: string,
  athleteIds: number[],
): Promise<void> {
  if (!canUseSupabase()) return;
  // Delete all existing assignments for this competition
  const { error: delError } = await supabase
    .from("competition_assignments")
    .delete()
    .eq("competition_id", competitionId);
  if (delError) throw new Error(delError.message);
  // Insert new assignments
  if (athleteIds.length > 0) {
    const rows = athleteIds.map((athlete_id) => ({
      competition_id: competitionId,
      athlete_id,
    }));
    const { error: insError } = await supabase
      .from("competition_assignments")
      .insert(rows);
    if (insError) throw new Error(insError.message);
  }
}

export async function getMyCompetitionIds(): Promise<string[]> {
  if (!canUseSupabase()) return [];
  // Get current user's integer ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  if (!userData) return [];
  const { data, error } = await supabase
    .from("competition_assignments")
    .select("competition_id")
    .eq("athlete_id", userData.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.competition_id);
}
```

Import `CompetitionAssignment` at the top of `competitions.ts`.

**Step 3: Add re-exports in index.ts**

In `src/lib/api/index.ts`, update the competitions export block:

```typescript
export {
  getCompetitions,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitionAssignments,
  setCompetitionAssignments,
  getMyCompetitionIds,
} from './competitions';
```

**Step 4: Add facade methods in api.ts**

In `src/lib/api.ts`, add:

```typescript
getCompetitionAssignments: competitions.getCompetitionAssignments,
setCompetitionAssignments: competitions.setCompetitionAssignments,
getMyCompetitionIds: competitions.getMyCompetitionIds,
```

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 5: Types + API — `planned_absences` CRUD

**Files:**
- Modify: `src/lib/api/types.ts` — Add `PlannedAbsence` interface
- Create: `src/lib/api/absences.ts` — CRUD module
- Modify: `src/lib/api/index.ts` — Add re-exports
- Modify: `src/lib/api.ts` — Add facade methods

**Step 1: Add types**

In `src/lib/api/types.ts`, add:

```typescript
export interface PlannedAbsence {
  id: number;
  user_id: number;
  date: string;
  reason?: string | null;
  created_at?: string | null;
}
```

**Step 2: Create absences.ts module**

```typescript
// src/lib/api/absences.ts
import { supabase, canUseSupabase } from "./client";
import type { PlannedAbsence } from "./types";

export async function getPlannedAbsences(options?: {
  userId?: number;
  from?: string;
  to?: string;
}): Promise<PlannedAbsence[]> {
  if (!canUseSupabase()) return [];
  let query = supabase.from("planned_absences").select("*");
  if (options?.userId) query = query.eq("user_id", options.userId);
  if (options?.from) query = query.gte("date", options.from);
  if (options?.to) query = query.lte("date", options.to);
  const { data, error } = await query.order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlannedAbsence[];
}

export async function getMyPlannedAbsences(): Promise<PlannedAbsence[]> {
  if (!canUseSupabase()) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  if (!userData) return [];
  const { data, error } = await supabase
    .from("planned_absences")
    .select("*")
    .eq("user_id", userData.id)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlannedAbsence[];
}

export async function setPlannedAbsence(date: string, reason?: string | null): Promise<PlannedAbsence> {
  if (!canUseSupabase()) throw new Error("Supabase not available");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  if (!userData) throw new Error("User not found");
  const { data, error } = await supabase
    .from("planned_absences")
    .upsert(
      { user_id: userData.id, date, reason: reason ?? null },
      { onConflict: "user_id,date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PlannedAbsence;
}

export async function removePlannedAbsence(date: string): Promise<void> {
  if (!canUseSupabase()) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  if (!userData) return;
  const { error } = await supabase
    .from("planned_absences")
    .delete()
    .eq("user_id", userData.id)
    .eq("date", date);
  if (error) throw new Error(error.message);
}
```

**Step 3: Add re-exports in index.ts**

```typescript
export {
  getPlannedAbsences,
  getMyPlannedAbsences,
  setPlannedAbsence,
  removePlannedAbsence,
} from './absences';
```

**Step 4: Add facade methods in api.ts**

```typescript
getPlannedAbsences: absences.getPlannedAbsences,
getMyPlannedAbsences: absences.getMyPlannedAbsences,
setPlannedAbsence: absences.setPlannedAbsence,
removePlannedAbsence: absences.removePlannedAbsence,
```

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 6: Phone field — types, API, signup, profile

**Files:**
- Modify: `src/lib/api/types.ts` — Add `phone` to `UserProfile`
- Modify: `src/lib/api/users.ts` — Map `phone` in getProfile, allow in updateProfile
- Modify: `src/pages/Login.tsx` — Add phone field to signup form + schema
- Modify: `src/pages/Profile.tsx` — Add phone field to profile edit form + schema

**Step 1: Add phone to UserProfile type**

In `src/lib/api/types.ts`, add `phone?: string | null;` to the `UserProfile` interface (after `ffn_iuf`).

**Step 2: Update getProfile in users.ts**

In `src/lib/api/users.ts`, in the `getProfile` function return mapping, add:
```typescript
phone: data.phone ?? null,
```

**Step 3: Add phone to signup schema in Login.tsx**

In `src/pages/Login.tsx`:
- Add to `signupSchema`: `phone: z.string().optional(),`
- Add to form defaults: `phone: "",`
- Add phone input field in the signup form after the group selector (before password):

```tsx
{/* Phone */}
<div className="space-y-2">
  <Label htmlFor="signup-phone">Téléphone (optionnel)</Label>
  <Input
    id="signup-phone"
    type="tel"
    placeholder="06 12 34 56 78"
    {...signupForm.register("phone")}
  />
</div>
```

- In the `handleSignup` function, add phone to the signUp metadata:
```typescript
phone: data.phone || undefined,
```

Note: The `handle_new_auth_user` trigger already creates user_profiles. If it doesn't set phone from metadata, we'll need a separate step. Check the trigger and add phone mapping if needed. If the trigger doesn't support it, save phone via `updateProfile` after signup.

**Step 4: Add phone to profile edit form in Profile.tsx**

In `src/pages/Profile.tsx`:
- Add to `profileEditSchema`: `phone: z.string().optional(),`
- Add to form defaults: `phone: profile?.phone ?? "",`
- Add phone input in the edit sheet (after birthdate, before save button):

```tsx
{/* Phone */}
<div className="space-y-2">
  <Label htmlFor="edit-phone">Téléphone</Label>
  <Input
    id="edit-phone"
    type="tel"
    placeholder="06 12 34 56 78"
    {...editForm.register("phone")}
  />
</div>
```

- In the updateProfile mutation payload, include: `phone: data.phone || null,`

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 7: Coach Competition Form — athlete assignment multiselect

**Files:**
- Modify: `src/pages/coach/CoachCompetitionsScreen.tsx`

This is the core UI change. The CompetitionFormSheet gets a new section below the existing fields: a group dropdown + multiselect checkboxes for athletes.

**Step 1: Add imports and state**

Add to imports:
```typescript
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, MessageSquare } from "lucide-react";
```

In `CompetitionFormSheet`, add state:
```typescript
const [assignedAthleteIds, setAssignedAthleteIds] = useState<Set<number>>(new Set());
```

Add queries (inside the component):
```typescript
const { data: athletes = [] } = useQuery({
  queryKey: ["athletes"],
  queryFn: () => api.getAthletes(),
});

const { data: groups = [] } = useQuery({
  queryKey: ["groups"],
  queryFn: () => api.getGroups(),
});

// Load existing assignments when editing
const { data: existingAssignments } = useQuery({
  queryKey: ["competition-assignments", competition?.id],
  queryFn: () => api.getCompetitionAssignments(competition!.id),
  enabled: !!competition?.id,
});
```

In the `useEffect` that syncs form fields, add:
```typescript
if (competition && existingAssignments) {
  setAssignedAthleteIds(new Set(existingAssignments.map((a) => a.athlete_id)));
} else if (!competition) {
  setAssignedAthleteIds(new Set());
}
```

**Step 2: Add athlete selection UI**

After the Description field and before the Actions div, add:

```tsx
{/* Athlete assignment */}
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <Users className="h-4 w-4 text-muted-foreground" />
    <Label>Nageurs assignés</Label>
  </div>

  {/* Group quick-select */}
  <Select
    value=""
    onValueChange={(groupId) => {
      const groupMembers = athletes.filter((a) => a.group_id === Number(groupId));
      setAssignedAthleteIds((prev) => {
        const next = new Set(prev);
        groupMembers.forEach((m) => { if (m.id != null) next.add(m.id); });
        return next;
      });
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Ajouter un groupe..." />
    </SelectTrigger>
    <SelectContent>
      {groups.filter((g) => !g.is_temporary).map((g) => (
        <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Individual checkboxes */}
  <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
    {athletes.map((athlete) => {
      if (athlete.id == null) return null;
      const checked = assignedAthleteIds.has(athlete.id);
      return (
        <label key={athlete.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={checked}
            onCheckedChange={(c) => {
              setAssignedAthleteIds((prev) => {
                const next = new Set(prev);
                if (c) next.add(athlete.id!);
                else next.delete(athlete.id!);
                return next;
              });
            }}
          />
          <span className="text-sm">{athlete.display_name}</span>
          {athlete.group_label && (
            <span className="text-xs text-muted-foreground ml-auto">{athlete.group_label}</span>
          )}
        </label>
      );
    })}
  </div>

  <p className="text-xs text-muted-foreground">
    {assignedAthleteIds.size} nageur{assignedAthleteIds.size > 1 ? "s" : ""} assigné{assignedAthleteIds.size > 1 ? "s" : ""}
  </p>
</div>
```

**Step 3: Save assignments after create/update**

In both `createMutation.onSuccess` and `updateMutation.onSuccess`, add assignment saving:

```typescript
onSuccess: async (result) => {
  // Save competition assignments
  const compId = isEdit ? competition!.id : result.id;
  if (assignedAthleteIds.size > 0) {
    await api.setCompetitionAssignments(compId, Array.from(assignedAthleteIds));
  }
  toast({ title: isEdit ? "Competition mise a jour" : "Competition creee" });
  void queryClient.invalidateQueries({ queryKey: ["competitions"] });
  void queryClient.invalidateQueries({ queryKey: ["competition-assignments"] });
  onOpenChange(false);
},
```

**Step 4: Show assigned count on CompetitionCard**

In `CompetitionCard`, add a query for assignment count:
```typescript
const { data: assignments = [] } = useQuery({
  queryKey: ["competition-assignments", competition.id],
  queryFn: () => api.getCompetitionAssignments(competition.id),
});
```

Add to the card JSX (after location):
```tsx
{assignments.length > 0 && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <Users className="h-3 w-3 shrink-0" />
    <span>{assignments.length} nageur{assignments.length > 1 ? "s" : ""}</span>
  </div>
)}
```

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 8: Swimmer Dashboard — filter competitions by assignment + planned absences

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Fetch assigned competition IDs**

Add query:
```typescript
const { data: myCompetitionIds = [] } = useQuery({
  queryKey: ["my-competition-ids"],
  queryFn: () => api.getMyCompetitionIds(),
});
```

**Step 2: Filter competitions**

Change the existing `competitionDates` and `nextCompetition` to only include competitions where:
- The swimmer is assigned (competition ID is in `myCompetitionIds`), OR
- There are NO assignments for that competition (backward compatibility — unassigned competitions are visible to all)

Add a filtered competitions memo:
```typescript
const visibleCompetitions = useMemo(() => {
  if (myCompetitionIds.length === 0) return competitions; // No assignments exist yet, show all
  return competitions.filter((c) => myCompetitionIds.includes(c.id));
}, [competitions, myCompetitionIds]);
```

Replace `competitions` with `visibleCompetitions` in the `competitionDates` and `nextCompetition` memos.

**Step 3: Fetch planned absences**

Add query:
```typescript
const { data: myAbsences = [] } = useQuery({
  queryKey: ["my-planned-absences"],
  queryFn: () => api.getMyPlannedAbsences(),
});

const absenceDates = useMemo(() => {
  return new Set(myAbsences.map((a) => a.date));
}, [myAbsences]);
```

Pass `absenceDates` to `CalendarGrid` as a new prop.

**Step 4: Add absence marking in FeedbackDrawer**

In the day drawer (when it opens for a selected date), add a button/option to mark the day as "off":
- If the date is in the future and not already marked: show "Marquer indisponible" button
- If already marked: show "Annuler l'indisponibilité" button + show the reason

This requires adding the absence mutation:
```typescript
const absenceMutation = useMutation({
  mutationFn: ({ date, reason }: { date: string; reason?: string }) =>
    api.setPlannedAbsence(date, reason),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["my-planned-absences"] });
    toast({ title: "Jour marqué indisponible" });
  },
});

const removeAbsenceMutation = useMutation({
  mutationFn: (date: string) => api.removePlannedAbsence(date),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["my-planned-absences"] });
    toast({ title: "Disponibilité restaurée" });
  },
});
```

Add to the drawer UI (in the day header area, before the sessions list):
```tsx
{/* Planned absence section */}
{isFutureDate && (
  absenceDates.has(selectedISO) ? (
    <div className="rounded-xl border border-muted bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Marqué indisponible</span>
        <Button variant="ghost" size="sm" onClick={() => removeAbsenceMutation.mutate(selectedISO)}>
          Annuler
        </Button>
      </div>
      {absenceReason && <p className="text-xs text-muted-foreground">{absenceReason}</p>}
    </div>
  ) : (
    <AbsenceButton date={selectedISO} onMark={(reason) => absenceMutation.mutate({ date: selectedISO, reason })} />
  )
)}
```

The `AbsenceButton` is a small inline component with an input for the reason:
```tsx
function AbsenceButton({ date, onMark }: { date: string; onMark: (reason?: string) => void }) {
  const [showInput, setShowInput] = useState(false);
  const [reason, setReason] = useState("");
  if (!showInput) {
    return (
      <Button variant="outline" size="sm" className="w-full text-muted-foreground" onClick={() => setShowInput(true)}>
        Marquer indisponible
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Input placeholder="Motif (optionnel)" value={reason} onChange={(e) => setReason(e.target.value)} className="text-sm" />
      <Button size="sm" onClick={() => onMark(reason || undefined)}>OK</Button>
    </div>
  );
}
```

**Step 5: Add absence visual marker to DayCell**

In `CalendarGrid.tsx`, pass `absenceDates` to `DayCell`.

In `DayCell.tsx`, add `hasAbsence?: boolean` prop. When true, show a small slash icon or gray overlay to indicate planned absence.

**Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 9: Training days counter

**Files:**
- Modify: `src/pages/Dashboard.tsx` — Add counter in competition banner
- Modify: `src/pages/Progress.tsx` — Add counter in objectives section

**Step 1: Compute training days count in Dashboard**

In Dashboard.tsx, add a memo:
```typescript
const trainingDaysRemaining = useMemo(() => {
  if (!nextCompetition || !assignments) return null;
  const todayISO = toISODate(new Date());
  const compDate = nextCompetition.date.slice(0, 10);
  // Get unique dates from assignments that fall between today (exclusive) and competition date (exclusive)
  const assignmentDates = new Set<string>();
  for (const a of (assignments ?? [])) {
    const d = (a.assigned_date || "").slice(0, 10);
    if (d > todayISO && d < compDate) {
      assignmentDates.add(d);
    }
  }
  return assignmentDates.size;
}, [nextCompetition, assignments]);
```

Note: we use `visibleCompetitions` for `nextCompetition`. The counter counts dates with at least one assignment between today and the competition, excluding both endpoints.

**Step 2: Display in competition banner**

In the competition banner JSX, add below the location line:
```tsx
{trainingDaysRemaining != null && (
  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
    {trainingDaysRemaining} séance{trainingDaysRemaining > 1 ? "s" : ""} planifiée{trainingDaysRemaining > 1 ? "s" : ""}
  </div>
)}
```

**Step 3: Display in Progress page**

In `src/pages/Progress.tsx`, in the objectives section, fetch competitions and assignments:
```typescript
const { data: competitions = [] } = useQuery({
  queryKey: ["competitions"],
  queryFn: () => api.getCompetitions(),
});

const { data: myCompetitionIds = [] } = useQuery({
  queryKey: ["my-competition-ids"],
  queryFn: () => api.getMyCompetitionIds(),
});
```

Compute the next competition and training days (same logic as Dashboard).

Display below the objectives list:
```tsx
{nextCompetition && trainingDaysRemaining != null && (
  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20 p-3 mt-4">
    <div className="flex items-center gap-2">
      <Trophy className="h-4 w-4 text-amber-500" />
      <span className="text-sm font-semibold">{nextCompetition.name}</span>
      <Badge variant="outline" className="border-amber-300 text-amber-600 text-[10px] ml-auto">
        J-{daysUntilNextComp}
      </Badge>
    </div>
    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
      {trainingDaysRemaining} séance{trainingDaysRemaining > 1 ? "s" : ""} planifiée{trainingDaysRemaining > 1 ? "s" : ""}
    </p>
  </div>
)}
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 10: SMS messaging via `sms:` URI

**Files:**
- Modify: `src/pages/coach/CoachCompetitionsScreen.tsx` — Add SMS button on competition cards

**Step 1: Add SMS button to CompetitionCard**

After the athlete count display on `CompetitionCard`, add a "SMS" button:

```tsx
{assignments.length > 0 && (
  <Button
    variant="ghost"
    size="sm"
    className="text-xs h-7 px-2"
    onClick={(e) => {
      e.stopPropagation();
      handleSendSms(competition, assignments);
    }}
  >
    <MessageSquare className="h-3 w-3 mr-1" />
    SMS
  </Button>
)}
```

**Step 2: Implement handleSendSms**

In `CoachCompetitionsScreen`, add:

```typescript
const { data: allAthletes = [] } = useQuery({
  queryKey: ["athletes"],
  queryFn: () => api.getAthletes(),
});

// Also need phone numbers from user_profiles
const { data: athleteProfiles } = useQuery({
  queryKey: ["athlete-profiles-phone"],
  queryFn: async () => {
    // Fetch all athlete profiles with phone
    const { data } = await supabase
      .from("user_profiles")
      .select("user_id, phone")
      .not("phone", "is", null);
    return (data ?? []) as Array<{ user_id: number; phone: string }>;
  },
});

const handleSendSms = (comp: Competition, compAssignments: CompetitionAssignment[]) => {
  const phoneMap = new Map((athleteProfiles ?? []).map((p) => [p.user_id, p.phone]));
  const phones = compAssignments
    .map((a) => phoneMap.get(a.athlete_id))
    .filter((p): p is string => !!p && p.trim().length > 0);

  if (phones.length === 0) {
    toast({
      title: "Aucun numéro",
      description: "Aucun nageur assigné n'a renseigné de numéro de téléphone.",
      variant: "destructive",
    });
    return;
  }

  const body = encodeURIComponent(`[${comp.name}] `);
  const smsUri = `sms:${phones.join(",")}?body=${body}`;
  window.location.href = smsUri;
};
```

Note: The `sms:` URI scheme opens the native messaging app. On desktop, it may not work — we can show a fallback message.

**Step 3: Desktop fallback**

Detect mobile vs desktop:
```typescript
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
```

If not mobile, show a dialog with the phone numbers listed so the coach can copy them.

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 11: Coach calendar — view planned absences

**Files:**
- Modify: `src/pages/coach/CoachCalendar.tsx` or `src/hooks/useCoachCalendarState.ts`

**Step 1: Fetch planned absences for selected group/athlete**

In the coach calendar, when viewing a specific athlete or group, fetch their planned absences:

```typescript
const { data: plannedAbsences = [] } = useQuery({
  queryKey: ["planned-absences", selectedUserId, fromDate, toDate],
  queryFn: () => api.getPlannedAbsences({ userId: selectedUserId, from: fromDate, to: toDate }),
  enabled: !!selectedUserId,
});
```

**Step 2: Display absence markers**

In the coach calendar day cells, show a visual indicator (e.g., a small slash or "OFF" badge) for days where the athlete has a planned absence. On hover/click, show the reason.

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors.

---

### Task 12: Documentation + final verification

**Files:**
- Modify: `docs/implementation-log.md` — Add §62 entry
- Modify: `docs/ROADMAP.md` — Add chantier #30
- Modify: `docs/FEATURES_STATUS.md` — Update status
- Modify: `CLAUDE.md` — Update files table + chantier

**Step 1: Implementation log**

Add section `§62 — Assignation compétitions, jours off, compteur séances, SMS` with:
- Context: Extension §59-60 pour gestion fine des compétitions
- Changes: 3 migrations, API modules, coach assignment multiselect, swimmer absence marking, training counter, SMS via sms: URI, phone field
- Files modified
- Decisions taken

**Step 2: Update ROADMAP, FEATURES_STATUS, CLAUDE.md**

Standard documentation updates per the workflow.

**Step 3: Final verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All pass, no regressions.

**Step 4: Commit all documentation**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add §62 competition assignments, absences, training counter, SMS"
```

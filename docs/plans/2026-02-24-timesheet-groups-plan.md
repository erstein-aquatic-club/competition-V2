# Timesheet Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow coaches to check multiple groups they managed per timesheet shift, with permanent groups auto-populated and custom labels persistable by any coach.

**Architecture:** Two new DB tables (`timesheet_group_labels` for custom labels, `timesheet_shift_groups` for M:N join). The shift form gets a multi-checkbox section. Group names are stored as text (not FK) to handle two sources cleanly.

**Tech Stack:** Supabase (PostgreSQL migration), React, TypeScript, Tailwind, Radix Checkbox

---

### Task 1: Database Migration

**Files:**
- Create: Supabase migration via `apply_migration`

**Step 1: Apply migration**

Apply this SQL migration to the Supabase project `fscnobivsgornxdwqwlk`:

```sql
-- Custom group labels for timesheet (coach-managed)
CREATE TABLE timesheet_group_labels (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- M:N join: which groups a coach managed during a shift
CREATE TABLE timesheet_shift_groups (
  id serial PRIMARY KEY,
  shift_id integer NOT NULL REFERENCES timesheet_shifts(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  UNIQUE(shift_id, group_name)
);

CREATE INDEX idx_timesheet_shift_groups_shift ON timesheet_shift_groups(shift_id);

-- RLS policies
ALTER TABLE timesheet_group_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_shift_groups ENABLE ROW LEVEL SECURITY;

-- timesheet_group_labels: coaches and admins can read/write
CREATE POLICY "Coaches can read group labels"
  ON timesheet_group_labels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can insert group labels"
  ON timesheet_group_labels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can delete group labels"
  ON timesheet_group_labels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND u.role IN ('coach', 'admin')
    )
  );

-- timesheet_shift_groups: coaches and admins can read/write
CREATE POLICY "Coaches can read shift groups"
  ON timesheet_shift_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can insert shift groups"
  ON timesheet_shift_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can delete shift groups"
  ON timesheet_shift_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND u.role IN ('coach', 'admin')
    )
  );
```

Migration name: `add_timesheet_groups`

**Step 2: Verify tables exist**

Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'timesheet_%' ORDER BY table_name;`
Expected: 4 tables — `timesheet_group_labels`, `timesheet_locations`, `timesheet_shift_groups`, `timesheet_shifts`

**Step 3: Commit**

No local file changes in this task — migration is remote only.

---

### Task 2: Drizzle Schema + TypeScript Types

**Files:**
- Modify: `src/lib/schema.ts` (after line 608, before the ZOD SCHEMAS section)
- Modify: `src/lib/api/types.ts` (add `TimesheetGroupLabel`, extend `TimesheetShift`)

**Step 1: Add Drizzle table definitions to `src/lib/schema.ts`**

Insert after the `timesheetShifts` table definition (after line 609), before the "ZOD SCHEMAS" comment:

```typescript
export const timesheetGroupLabels = pgTable("timesheet_group_labels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const timesheetShiftGroups = pgTable(
  "timesheet_shift_groups",
  {
    id: serial("id").primaryKey(),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => timesheetShifts.id, { onDelete: "cascade" }),
    groupName: text("group_name").notNull(),
  },
  (table) => [
    uniqueIndex("idx_timesheet_shift_groups_unique").on(table.shiftId, table.groupName),
    index("idx_timesheet_shift_groups_shift").on(table.shiftId),
  ]
);
```

Also add inferred types at the end of the types section:

```typescript
export type TimesheetGroupLabel = typeof timesheetGroupLabels.$inferSelect;
export type TimesheetShiftGroup = typeof timesheetShiftGroups.$inferSelect;
```

**Step 2: Add API types to `src/lib/api/types.ts`**

After the `TimesheetLocation` interface (line 273), add:

```typescript
export interface TimesheetGroupLabel {
  id: number;
  name: string;
  created_at?: string | null;
}
```

Extend the existing `TimesheetShift` interface — add an optional field after `updated_at`:

```typescript
  group_names?: string[] | null;
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing errors in stories files are expected).

**Step 4: Commit**

```bash
git add src/lib/schema.ts src/lib/api/types.ts
git commit -m "feat: add Drizzle schema and types for timesheet groups"
```

---

### Task 3: API Layer — CRUD for Group Labels + Shift Groups

**Files:**
- Modify: `src/lib/api/timesheet.ts`
- Modify: `src/lib/api/index.ts`
- Modify: `src/lib/api.ts`

**Step 1: Add functions to `src/lib/api/timesheet.ts`**

Add these imports at the top (extend existing import):

```typescript
import type { TimesheetShift, TimesheetLocation, TimesheetGroupLabel } from './types';
```

Add these functions at the end of the file:

```typescript
// ─── Timesheet Group Labels ─────────────────────────────────────────────────

export async function listTimesheetGroupLabels(): Promise<TimesheetGroupLabel[]> {
  if (canUseSupabase()) {
    const { data, error } = await supabase
      .from("timesheet_group_labels")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  await delay(120);
  return (localStorageGet("timesheet_group_labels") || []) as TimesheetGroupLabel[];
}

export async function createTimesheetGroupLabel(payload: { name: string }) {
  if (canUseSupabase()) {
    const { error } = await supabase
      .from("timesheet_group_labels")
      .insert({ name: payload.name.trim() });
    if (error) throw new Error(error.message);
    return { status: "created" };
  }
  await delay(120);
  const trimmed = payload.name.trim();
  if (!trimmed) throw new Error("Missing label name");
  const stored = (localStorageGet("timesheet_group_labels") || []) as TimesheetGroupLabel[];
  const exists = stored.some((l) => l.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) return { status: "exists" };
  const created = { id: Date.now(), name: trimmed, created_at: new Date().toISOString() };
  localStorageSave("timesheet_group_labels", [...stored, created]);
  return { status: "created" };
}

export async function deleteTimesheetGroupLabel(payload: { id: number }) {
  if (canUseSupabase()) {
    const { error } = await supabase
      .from("timesheet_group_labels")
      .delete()
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
    return { status: "deleted" };
  }
  await delay(120);
  const stored = (localStorageGet("timesheet_group_labels") || []) as TimesheetGroupLabel[];
  localStorageSave("timesheet_group_labels", stored.filter((l) => l.id !== payload.id));
  return { status: "deleted" };
}

// ─── Timesheet Shift Groups (M:N) ──────────────────────────────────────────

export async function getShiftGroupNames(shiftId: number): Promise<string[]> {
  if (canUseSupabase()) {
    const { data, error } = await supabase
      .from("timesheet_shift_groups")
      .select("group_name")
      .eq("shift_id", shiftId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { group_name: string }) => r.group_name);
  }
  return [];
}

export async function setShiftGroupNames(shiftId: number, groupNames: string[]) {
  if (canUseSupabase()) {
    // Delete existing, then insert new
    const { error: delError } = await supabase
      .from("timesheet_shift_groups")
      .delete()
      .eq("shift_id", shiftId);
    if (delError) throw new Error(delError.message);

    if (groupNames.length > 0) {
      const rows = groupNames.map((name) => ({ shift_id: shiftId, group_name: name }));
      const { error: insError } = await supabase
        .from("timesheet_shift_groups")
        .insert(rows);
      if (insError) throw new Error(insError.message);
    }
    return { status: "updated" };
  }
  return { status: "noop" };
}
```

**Step 2: Modify `listTimesheetShifts` to include group_names**

In the existing `listTimesheetShifts` function, after the main query fetches shifts from Supabase (inside the `if (canUseSupabase())` block), enrich each shift with its group names. Replace the return inside the Supabase block:

Current code (approx lines 21-31):
```typescript
  if (canUseSupabase()) {
    let query = supabase
      .from("timesheet_shifts")
      .select("*")
      .order("shift_date", { ascending: false });
    if (options?.coachId) query = query.eq("coach_id", options.coachId);
    if (options?.from) query = query.gte("shift_date", options.from);
    if (options?.to) query = query.lte("shift_date", options.to);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }
```

Replace with:
```typescript
  if (canUseSupabase()) {
    let query = supabase
      .from("timesheet_shifts")
      .select("*")
      .order("shift_date", { ascending: false });
    if (options?.coachId) query = query.eq("coach_id", options.coachId);
    if (options?.from) query = query.gte("shift_date", options.from);
    if (options?.to) query = query.lte("shift_date", options.to);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const shifts = data ?? [];
    if (shifts.length === 0) return shifts;

    // Batch-fetch all group names for these shifts
    const shiftIds = shifts.map((s: TimesheetShift) => s.id);
    const { data: groupRows } = await supabase
      .from("timesheet_shift_groups")
      .select("shift_id, group_name")
      .in("shift_id", shiftIds);
    const groupMap = new Map<number, string[]>();
    for (const row of groupRows ?? []) {
      const list = groupMap.get(row.shift_id) ?? [];
      list.push(row.group_name);
      groupMap.set(row.shift_id, list);
    }
    return shifts.map((s: TimesheetShift) => ({
      ...s,
      group_names: groupMap.get(s.id) ?? [],
    }));
  }
```

**Step 3: Modify `createTimesheetShift` and `updateTimesheetShift` to handle group_names**

In `createTimesheetShift`, after the successful insert into Supabase, also save group names. Change the Supabase block to return the new shift id and then call `setShiftGroupNames`:

Replace the existing Supabase block in `createTimesheetShift` (approx lines 148-158):
```typescript
  if (canUseSupabase()) {
    const { data, error } = await supabase.from("timesheet_shifts").insert({
      coach_id: payload.coach_id,
      shift_date: payload.shift_date,
      start_time: payload.start_time,
      end_time: payload.end_time ?? null,
      location: payload.location ?? null,
      is_travel: payload.is_travel,
    }).select("id").single();
    if (error) throw new Error(error.message);
    if (payload.group_names?.length) {
      await setShiftGroupNames(data.id, payload.group_names);
    }
    return { status: "created" };
  }
```

In `updateTimesheetShift`, after the successful update, also save group names:

Replace the existing Supabase block in `updateTimesheetShift` (approx lines 171-175):
```typescript
  if (canUseSupabase()) {
    const { id, group_names, ...rest } = payload;
    const { error } = await supabase.from("timesheet_shifts").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    if (group_names !== undefined) {
      await setShiftGroupNames(id, group_names ?? []);
    }
    return { status: "updated" };
  }
```

Also update the `createTimesheetShift` parameter type to accept `group_names`:

Change:
```typescript
export async function createTimesheetShift(
  payload: Omit<TimesheetShift, "id" | "created_at" | "updated_at" | "coach_name">,
)
```

This already works because `TimesheetShift` now has `group_names?: string[] | null`.

**Step 4: Add exports to `src/lib/api/index.ts`**

In the timesheet export block (around line 113-121), add:

```typescript
export {
  listTimesheetShifts,
  listTimesheetLocations,
  createTimesheetLocation,
  deleteTimesheetLocation,
  listTimesheetCoaches,
  createTimesheetShift,
  updateTimesheetShift,
  deleteTimesheetShift,
  listTimesheetGroupLabels,
  createTimesheetGroupLabel,
  deleteTimesheetGroupLabel,
  getShiftGroupNames,
  setShiftGroupNames,
} from './timesheet';
```

Also add `TimesheetGroupLabel` to the type re-exports in `src/lib/api.ts`:

In the type re-export block (around line 24), add `TimesheetGroupLabel`.

**Step 5: Add delegation stubs to `src/lib/api.ts`**

Add imports:
```typescript
import {
  listTimesheetGroupLabels as _listTimesheetGroupLabels,
  createTimesheetGroupLabel as _createTimesheetGroupLabel,
  deleteTimesheetGroupLabel as _deleteTimesheetGroupLabel,
} from "./api/timesheet";
```

Add stubs in the Timesheet delegation section:
```typescript
  async listTimesheetGroupLabels() { return _listTimesheetGroupLabels(); },
  async createTimesheetGroupLabel(payload: Parameters<typeof _createTimesheetGroupLabel>[0]) { return _createTimesheetGroupLabel(payload); },
  async deleteTimesheetGroupLabel(payload: Parameters<typeof _deleteTimesheetGroupLabel>[0]) { return _deleteTimesheetGroupLabel(payload); },
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add src/lib/api/timesheet.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add API layer for timesheet group labels and shift groups"
```

---

### Task 4: Fetch Permanent Groups in Timesheet Context

**Files:**
- Modify: `src/lib/api/timesheet.ts`

**Step 1: Add function to list permanent groups for timesheet checkboxes**

Add at the end of `src/lib/api/timesheet.ts`:

```typescript
export async function listPermanentGroupsForTimesheet(): Promise<{ id: number; name: string }[]> {
  if (canUseSupabase()) {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name")
      .eq("is_temporary", false)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return [];
}
```

**Step 2: Export and wire up**

Add `listPermanentGroupsForTimesheet` to `src/lib/api/index.ts` in the timesheet block.

Add import + delegation stub in `src/lib/api.ts`:

Import:
```typescript
import { listPermanentGroupsForTimesheet as _listPermanentGroupsForTimesheet } from "./api/timesheet";
```

Stub:
```typescript
  async listPermanentGroupsForTimesheet() { return _listPermanentGroupsForTimesheet(); },
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/api/timesheet.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add permanent groups fetch for timesheet checkboxes"
```

---

### Task 5: TimesheetShiftForm — Add Group Checkboxes

**Files:**
- Modify: `src/components/timesheet/TimesheetShiftForm.tsx`

**Step 1: Update props interface**

Add these new props to `TimesheetShiftFormProps`:

```typescript
  permanentGroups: { id: number; name: string }[];
  customGroupLabels: { id: number; name: string }[];
  selectedGroupNames: string[];
  onGroupToggle: (name: string) => void;
  onCreateGroupLabel: (name: string) => void;
  onDeleteGroupLabel: (id: number) => void;
```

**Step 2: Add checkbox section in the form**

After the "Lieu" Select section and before the "Temps de trajet" Checkbox, add:

```tsx
          {/* Groupes encadrés */}
          <div className="space-y-2">
            <Label>Groupes encadrés</Label>
            <div className="flex flex-wrap gap-2">
              {permanentGroups.map((g) => (
                <label
                  key={`perm-${g.id}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold cursor-pointer select-none"
                >
                  <Checkbox
                    checked={selectedGroupNames.includes(g.name)}
                    onCheckedChange={() => onGroupToggle(g.name)}
                  />
                  <span>{g.name}</span>
                </label>
              ))}
              {customGroupLabels.map((g) => (
                <label
                  key={`custom-${g.id}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold cursor-pointer select-none"
                >
                  <Checkbox
                    checked={selectedGroupNames.includes(g.name)}
                    onCheckedChange={() => onGroupToggle(g.name)}
                  />
                  <span>{g.name}</span>
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.preventDefault(); onDeleteGroupLabel(g.id); }}
                    aria-label={`Supprimer ${g.name}`}
                  >
                    ✕
                  </button>
                </label>
              ))}
            </div>
            {/* Add custom group label */}
            <div className="flex items-center gap-2">
              <Input
                value={newGroupLabelName}
                onChange={(e) => setNewGroupLabelName(e.target.value)}
                placeholder="Ajouter un groupe..."
                className="h-8 flex-1 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddGroupLabel(); }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleAddGroupLabel}
                disabled={!newGroupLabelName.trim()}
              >
                +
              </Button>
            </div>
          </div>
```

Add local state and handler inside the component function:

```typescript
  const [newGroupLabelName, setNewGroupLabelName] = React.useState("");

  const handleAddGroupLabel = () => {
    const trimmed = newGroupLabelName.trim();
    if (!trimmed) return;
    onCreateGroupLabel(trimmed);
    setNewGroupLabelName("");
  };
```

Also add `Input` to imports if not present (it's already imported).

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/timesheet/TimesheetShiftForm.tsx
git commit -m "feat: add group checkboxes to timesheet shift form"
```

---

### Task 6: TimesheetShiftList — Display Group Badges

**Files:**
- Modify: `src/components/timesheet/TimesheetShiftList.tsx`

**Step 1: Add group badges in shift display**

The `TimesheetShift` type imported from `timesheetHelpers.ts` needs to be extended. Add `group_names` to the local type in `timesheetHelpers.ts`:

In `src/pages/timesheetHelpers.ts`, add to the `TimesheetShift` type:

```typescript
  group_names?: string[] | null;
```

Then in `TimesheetShiftList.tsx`, after the location line (`shift.location || "Lieu non précisé"`), add:

```tsx
                      {shift.group_names && shift.group_names.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {shift.group_names.map((name) => (
                            <span
                              key={name}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : null}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/timesheet/TimesheetShiftList.tsx src/pages/timesheetHelpers.ts
git commit -m "feat: display group badges on timesheet shift list"
```

---

### Task 7: Administratif Page — Wire Everything Together

**Files:**
- Modify: `src/pages/Administratif.tsx`

**Step 1: Add queries for groups data**

Add imports for new API functions (they're already accessible via `api`).

Add import for `TimesheetGroupLabel` type:
```typescript
import { api, summarizeApiError, type TimesheetLocation, type TimesheetGroupLabel } from "@/lib/api";
```

Add state for selected groups:
```typescript
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);
```

Add queries:
```typescript
  const { data: permanentGroups = [] } = useQuery({
    queryKey: ["timesheet-permanent-groups"],
    queryFn: () => api.listPermanentGroupsForTimesheet(),
    enabled: isCoach,
  });

  const { data: customGroupLabels = [] } = useQuery<TimesheetGroupLabel[]>({
    queryKey: ["timesheet-group-labels"],
    queryFn: () => api.listTimesheetGroupLabels(),
    enabled: isCoach,
  });
```

Add mutations:
```typescript
  const createGroupLabel = useMutation({
    mutationFn: (payload: { name: string }) => api.createTimesheetGroupLabel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-group-labels"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur", description: summarizeApiError(error, "Impossible d'ajouter le groupe.").message });
    },
  });

  const deleteGroupLabel = useMutation({
    mutationFn: (payload: { id: number }) => api.deleteTimesheetGroupLabel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-group-labels"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Erreur", description: summarizeApiError(error, "Impossible de supprimer le groupe.").message });
    },
  });
```

**Step 2: Update form submission to include group_names**

In `handleSubmit`, add `group_names: selectedGroupNames` to both the `createShift.mutate()` and `updateShift.mutate()` payloads.

**Step 3: Update `openEditShift` to load existing groups**

```typescript
  const openEditShift = (shift: TimesheetShift) => {
    setEditingShiftId(shift.id);
    setDate(buildShiftDateKey(shift));
    setStartTime(buildTimeLabel(shift.start_time));
    setEndTime(shift.end_time ? buildTimeLabel(shift.end_time) : "");
    setLocation(shift.location ?? "");
    setIsTravel(shift.is_travel);
    setSelectedGroupNames(shift.group_names ?? []);
    setIsSheetOpen(true);
  };
```

**Step 4: Update `resetForm` to clear selected groups**

Add `setSelectedGroupNames([]);` to the `resetForm` callback.

**Step 5: Pass new props to TimesheetShiftForm**

Add these props to the `<TimesheetShiftForm>` JSX:

```tsx
          permanentGroups={permanentGroups}
          customGroupLabels={customGroupLabels}
          selectedGroupNames={selectedGroupNames}
          onGroupToggle={(name) => {
            setSelectedGroupNames((prev) =>
              prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
            );
          }}
          onCreateGroupLabel={(name) => createGroupLabel.mutate({ name })}
          onDeleteGroupLabel={(id) => deleteGroupLabel.mutate({ id })}
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 7: Run dev server and test manually**

Run: `npm run dev`
Test:
1. Open the Administratif page as a coach
2. Open the shift form — verify permanent groups (Elite, Performance, Excellence) appear as checkboxes
3. Check some groups, submit shift — verify badges appear in the list
4. Edit a shift — verify previously selected groups are pre-checked
5. Add a custom group label — verify it appears
6. Delete a custom group label — verify it disappears

**Step 8: Commit**

```bash
git add src/pages/Administratif.tsx
git commit -m "feat: wire timesheet groups into Administratif page"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CLAUDE.md`

**Step 1: Add implementation log entry**

Add entry for §66 (or next number) documenting the timesheet groups feature.

**Step 2: Update FEATURES_STATUS.md**

Mark "Groupes encadrés par shift" as ✅ in the Timesheet section.

**Step 3: Update ROADMAP.md**

Add chantier #34 (or next number) for this feature, marked as Fait.

**Step 4: Update CLAUDE.md**

No new key files added — just note the new tables in the schema section if needed.

**Step 5: Commit**

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md docs/ROADMAP.md CLAUDE.md
git commit -m "docs: add timesheet groups to tracking files (§66)"
```

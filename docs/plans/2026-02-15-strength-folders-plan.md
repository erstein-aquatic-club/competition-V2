# Strength Folders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow coaches to organize strength sessions and exercises into folders (1 level deep).

**Architecture:** New `strength_folders` table with `type` discriminant (`session`|`exercise`). Nullable `folder_id` FK on `strength_sessions` and `dim_exercices`. UI renders collapsible folder sections in the existing list view. Items without a folder appear at the top.

**Tech Stack:** Supabase PostgreSQL (migration), TypeScript, React, Tailwind CSS, React Query

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/00021_strength_folders.sql`

**Step 1: Write the migration**

```sql
-- Create strength_folders table
CREATE TABLE IF NOT EXISTS strength_folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('session', 'exercise')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add folder_id to strength_sessions
ALTER TABLE strength_sessions
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES strength_folders(id) ON DELETE SET NULL;

-- Add folder_id to dim_exercices
ALTER TABLE dim_exercices
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES strength_folders(id) ON DELETE SET NULL;

-- RLS: allow authenticated users to read/write folders
ALTER TABLE strength_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read folders"
  ON strength_folders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert folders"
  ON strength_folders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update folders"
  ON strength_folders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete folders"
  ON strength_folders FOR DELETE
  TO authenticated
  USING (true);
```

**Step 2: Apply migration**

Use the Supabase MCP tool `apply_migration` with project ID from `list_projects`, name `strength_folders`, and the SQL above.

**Step 3: Verify**

Run `list_tables` to confirm `strength_folders` exists and `folder_id` columns are on `strength_sessions` and `dim_exercices`.

**Step 4: Commit**

```bash
git add supabase/migrations/00021_strength_folders.sql
git commit -m "feat: add strength_folders table and folder_id columns"
```

---

### Task 2: TypeScript types and API functions

**Files:**
- Modify: `src/lib/api/types.ts` (add `StrengthFolder` interface, add `folder_id` to `Exercise` and `StrengthSessionTemplate`)
- Modify: `src/lib/api/strength.ts` (add folder CRUD + moveToFolder, update getExercises/getStrengthSessions to include folder_id)
- Modify: `src/lib/api/client.ts` (add folder_id to mapDbExerciseToApi/mapApiExerciseToDb)
- Modify: `src/lib/api/index.ts` (re-export new functions)
- Modify: `src/lib/api.ts` (add new methods to api facade)

**Step 1: Add `StrengthFolder` type**

In `src/lib/api/types.ts`, after line 80 (after `StrengthSessionItem`), add:

```typescript
export interface StrengthFolder {
  id: number;
  name: string;
  type: 'session' | 'exercise';
  sort_order: number;
}
```

**Step 2: Add `folder_id` to existing types**

In `src/lib/api/types.ts`:
- In `Exercise` interface (line 55), before the closing `}`, add: `folder_id?: number | null;`
- In `StrengthSessionTemplate` interface (line 67), before the closing `}`, add: `folder_id?: number | null;`

**Step 3: Update `mapDbExerciseToApi` in `client.ts`**

In `src/lib/api/client.ts`, in the `mapDbExerciseToApi` function (around line 178-202), add after `recup_exercices_force`:

```typescript
folder_id: safeOptionalInt(row.folder_id),
```

**Step 4: Update `mapApiExerciseToDb` in `client.ts`**

In `src/lib/api/client.ts`, in the `mapApiExerciseToDb` function (around line 204+), add:

```typescript
folder_id: exercise.folder_id ?? null,
```

**Step 5: Update `getStrengthSessions` in `strength.ts`**

In `src/lib/api/strength.ts`, in the `getStrengthSessions` function (line 136-166), in the return mapping object (line 150-162), add after `cycle,`:

```typescript
folder_id: safeOptionalInt(session.folder_id),
```

**Step 6: Add folder CRUD functions in `strength.ts`**

At the end of `src/lib/api/strength.ts`, before the last export or at the bottom, add:

```typescript
// --- Strength Folders ---

export async function getStrengthFolders(type: 'session' | 'exercise'): Promise<StrengthFolder[]> {
  if (canUseSupabase()) {
    const { data, error } = await supabase
      .from("strength_folders")
      .select("*")
      .eq("type", type)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: safeInt(row.id),
      name: String(row.name || ""),
      type: row.type as 'session' | 'exercise',
      sort_order: safeInt(row.sort_order),
    }));
  }
  return [];
}

export async function createStrengthFolder(name: string, type: 'session' | 'exercise'): Promise<StrengthFolder> {
  if (!canUseSupabase()) throw new Error("Supabase requis");
  const { data, error } = await supabase
    .from("strength_folders")
    .insert({ name, type })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { id: safeInt(data.id), name: String(data.name), type: data.type, sort_order: safeInt(data.sort_order) };
}

export async function renameStrengthFolder(id: number, name: string): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase requis");
  const { error } = await supabase.from("strength_folders").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteStrengthFolder(id: number): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase requis");
  const { error } = await supabase.from("strength_folders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function moveToFolder(
  itemId: number,
  folderId: number | null,
  table: 'strength_sessions' | 'dim_exercices',
): Promise<void> {
  if (!canUseSupabase()) throw new Error("Supabase requis");
  const { error } = await supabase.from(table).update({ folder_id: folderId }).eq("id", itemId);
  if (error) throw new Error(error.message);
}
```

Also add `StrengthFolder` to the imports from `./types` at the top of `strength.ts`.

**Step 7: Update `createStrengthSession` to include `folder_id`**

In `src/lib/api/strength.ts`, in the `createStrengthSession` function (line 168-209), in the `.insert()` call (line 175-178), add `folder_id`:

```typescript
.insert({
  name: session?.title ?? session?.name ?? "",
  description: session?.description ?? "",
  folder_id: session?.folder_id ?? null,
})
```

**Step 8: Update `updateStrengthSession` to include `folder_id`**

In `src/lib/api/strength.ts`, find the `updateStrengthSession` function. In the `.update()` call, add `folder_id: session?.folder_id ?? null`.

**Step 9: Re-export from `index.ts`**

In `src/lib/api/index.ts`, add to the strength re-exports (line 166-186):

```typescript
getStrengthFolders,
createStrengthFolder,
renameStrengthFolder,
deleteStrengthFolder,
moveToFolder,
```

**Step 10: Add to `api` facade**

In `src/lib/api.ts`, import the new functions and add methods:

```typescript
async getStrengthFolders(type: 'session' | 'exercise') { return _getStrengthFolders(type); },
async createStrengthFolder(name: string, type: 'session' | 'exercise') { return _createStrengthFolder(name, type); },
async renameStrengthFolder(id: number, name: string) { return _renameStrengthFolder(id, name); },
async deleteStrengthFolder(id: number) { return _deleteStrengthFolder(id); },
async moveToFolder(itemId: number, folderId: number | null, table: 'strength_sessions' | 'dim_exercices') { return _moveToFolder(itemId, folderId, table); },
```

**Step 11: Build check**

```bash
npx tsc --noEmit 2>&1 | grep -E "strength|api/types|api/client" | head -20
```

Expected: No errors in modified files.

**Step 12: Commit**

```bash
git add src/lib/api/types.ts src/lib/api/strength.ts src/lib/api/client.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add strength folders API (CRUD + moveToFolder)"
```

---

### Task 3: Folder UI component

**Files:**
- Create: `src/components/coach/strength/FolderSection.tsx`

**Step 1: Create the FolderSection component**

This is a reusable collapsible folder section. It renders a folder header with expand/collapse, rename/delete actions via a popover menu, and its children when expanded.

```tsx
import React, { useState } from "react";
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FolderSectionProps {
  name: string;
  count: number;
  children: React.ReactNode;
  onRename: (newName: string) => void;
  onDelete: () => void;
  defaultOpen?: boolean;
}

export function FolderSection({
  name,
  count,
  children,
  onRename,
  onDelete,
  defaultOpen = false,
}: FolderSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setEditName(name);
    }
    setEditing(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/50">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => setOpen(!open)}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
          {editing ? (
            <Input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setEditName(name); setEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-sm rounded-lg"
            />
          ) : (
            <>
              <span className="text-sm font-semibold truncate">{name}</span>
              <span className="text-xs text-muted-foreground">({count})</span>
            </>
          )}
        </button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-36 p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              onClick={() => { setMenuOpen(false); setEditing(true); }}
            >
              <Pencil className="h-3.5 w-3.5" /> Renommer
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => { setMenuOpen(false); onDelete(); }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          </PopoverContent>
        </Popover>
      </div>
      {open && <div className="ml-4">{children}</div>}
    </div>
  );
}
```

**Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | grep FolderSection
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/coach/strength/FolderSection.tsx
git commit -m "feat: add FolderSection collapsible component"
```

---

### Task 4: Integrate folders into StrengthCatalog — Sessions section

**Files:**
- Modify: `src/pages/coach/StrengthCatalog.tsx`

This is the largest task. We need to:
1. Fetch session folders via React Query
2. Group sessions by folder_id (null = unfiled, shown first)
3. Render unfiled sessions with `SessionListView`, then `FolderSection` per folder
4. Add "Nouveau dossier" button
5. Add folder_id to session create/edit flow
6. Add "Déplacer vers..." action on sessions

**Step 1: Add folder queries and mutations**

At the top of `StrengthCatalog` function, after existing queries (around line 339-342), add:

```typescript
const { data: sessionFolders, refetch: refetchSessionFolders } = useQuery({
  queryKey: ["strength_folders", "session"],
  queryFn: () => api.getStrengthFolders("session"),
});

const createFolder = useMutation({
  mutationFn: ({ name, type }: { name: string; type: 'session' | 'exercise' }) =>
    api.createStrengthFolder(name, type),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["strength_folders"] });
    toast({ title: "Dossier créé" });
  },
});

const renameFolder = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) =>
    api.renameStrengthFolder(id, name),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["strength_folders"] });
    toast({ title: "Dossier renommé" });
  },
});

const deleteFolderMut = useMutation({
  mutationFn: (id: number) => api.deleteStrengthFolder(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["strength_folders"] });
    queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
    queryClient.invalidateQueries({ queryKey: ["exercises"] });
    toast({ title: "Dossier supprimé" });
  },
});

const moveItem = useMutation({
  mutationFn: ({ itemId, folderId, table }: { itemId: number; folderId: number | null; table: 'strength_sessions' | 'dim_exercices' }) =>
    api.moveToFolder(itemId, folderId, table),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
    queryClient.invalidateQueries({ queryKey: ["exercises"] });
    toast({ title: "Déplacé" });
  },
});
```

**Step 2: Add exercise folders query**

```typescript
const { data: exerciseFolders } = useQuery({
  queryKey: ["strength_folders", "exercise"],
  queryFn: () => api.getStrengthFolders("exercise"),
});
```

**Step 3: Compute grouped sessions**

After `filteredSessions` (line 344-349), add:

```typescript
const unfiledSessions = filteredSessions.filter((s) => !s.folder_id);
const sessionsByFolder = useMemo(() => {
  const map = new Map<number, typeof filteredSessions>();
  for (const s of filteredSessions) {
    if (s.folder_id) {
      const arr = map.get(s.folder_id) ?? [];
      arr.push(s);
      map.set(s.folder_id, arr);
    }
  }
  return map;
}, [filteredSessions]);
```

**Step 4: Add `folder_id` to `newSession` state**

Update the `newSession` state (line 312-322) to include `folder_id`:

```typescript
const [newSession, setNewSession] = useState<{
  title: string;
  description: string;
  cycle: StrengthCycleType;
  items: StrengthSessionItem[];
  folder_id?: number | null;
}>({
  title: "",
  description: "",
  cycle: "endurance",
  items: [],
  folder_id: null,
});
```

Update `resetSessionForm` and `startEditSession` similarly to include `folder_id`.

**Step 5: Update the sessions list rendering**

Replace the current `SessionListView` (lines 929-959) with grouped rendering:

```tsx
{/* Unfiled sessions */}
{unfiledSessions.length > 0 && (
  <SessionListView
    sessions={unfiledSessions}
    isLoading={isLoadingSessions}
    error={sessionsError}
    renderTitle={(session) => session.title ?? "Sans titre"}
    renderMetrics={(session) => { /* same as current */ }}
    onPreview={(session) => startEditSession(session)}
    onEdit={(session) => startEditSession(session)}
    onDelete={(session) => setPendingDeleteSession(session)}
    canDelete={() => true}
    isDeleting={deleteSession.isPending}
  />
)}

{/* Folder sections */}
{sessionFolders?.map((folder) => {
  const folderSessions = sessionsByFolder.get(folder.id) ?? [];
  return (
    <FolderSection
      key={folder.id}
      name={folder.name}
      count={folderSessions.length}
      onRename={(newName) => renameFolder.mutate({ id: folder.id, name: newName })}
      onDelete={() => deleteFolderMut.mutate(folder.id)}
    >
      {folderSessions.length > 0 ? (
        <SessionListView
          sessions={folderSessions}
          renderTitle={(session) => session.title ?? "Sans titre"}
          renderMetrics={(session) => { /* same metrics rendering */ }}
          onPreview={(session) => startEditSession(session)}
          onEdit={(session) => startEditSession(session)}
          onDelete={(session) => setPendingDeleteSession(session)}
          canDelete={() => true}
          isDeleting={deleteSession.isPending}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Dossier vide
        </div>
      )}
    </FolderSection>
  );
})}
```

**Step 6: Add "Nouveau dossier" button**

In the header area (line 898-914), next to the "Nouvelle" button, add:

```tsx
<button
  type="button"
  onClick={() => {
    const name = prompt("Nom du dossier");
    if (name?.trim()) createFolder.mutate({ name: name.trim(), type: "session" });
  }}
  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
>
  <FolderPlus className="h-4 w-4" /> Dossier
</button>
```

Import `FolderPlus` from `lucide-react`.

**Step 7: Add folder selector in session builder**

In `StrengthSessionBuilder.tsx`, add an optional `folders` prop and a `folder_id` selector in the metadata additionalFields. Or more simply, add it directly in `StrengthCatalog.tsx` where the `StrengthSessionBuilder` is rendered — pass an `onFolderChange` prop or include a folder select in the `additionalFields`.

The simplest approach: In the `StrengthSessionBuilder` `additionalFields`, add a folder selector before the Cycle selector:

In `StrengthCatalog.tsx`, where `StrengthSessionBuilder` is rendered (line 832-855), update `onSessionChange` to also pass `folder_id`. The builder's `SessionMetadataForm` `additionalFields` should include a folder picker. This can be done by adding a prop `sessionFolders` and `onFolderChange` to `StrengthSessionBuilder`, or by adding `folder_id` to the session state which is already passed as `session` prop.

Since `session` already flows through `onSessionChange`, add a folder `Select` in the `additionalFields` in `StrengthSessionBuilder.tsx`:

```tsx
<div>
  <div className="text-xs font-semibold text-muted-foreground">Dossier</div>
  <div className="mt-1">
    <Select
      value={session.folder_id?.toString() ?? "none"}
      onValueChange={(v) => onSessionChange({ ...session, folder_id: v === "none" ? null : parseInt(v) })}
    >
      <SelectTrigger className="rounded-2xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Aucun</SelectItem>
        {folders?.map((f) => (
          <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>
```

Add `folders?: StrengthFolder[]` prop to `StrengthSessionBuilderProps`.

**Step 8: Add "Déplacer vers..." action on session cards**

Add an `onMove` optional prop to `SessionListView`, rendering a move icon button. When clicked, show a simple dialog/popover listing available folders + "Aucun dossier".

Alternatively, use a `Popover` with folder choices inline on the card. This can be added as a render prop or as a built-in feature of `SessionListView`.

The simplest approach: add an `onMove?: (session: T) => void` prop to `SessionListView` and render a folder icon button in the action bar.

In `StrengthCatalog`, when `onMove` is called, show a small dialog listing folders to pick from, then call `moveItem.mutate(...)`.

**Step 9: Build check + commit**

```bash
npm run build 2>&1 | tail -5
git add src/pages/coach/StrengthCatalog.tsx src/components/coach/strength/StrengthSessionBuilder.tsx src/components/coach/shared/SessionListView.tsx
git commit -m "feat: integrate folders into sessions list view"
```

---

### Task 5: Integrate folders into StrengthCatalog — Exercises section

**Files:**
- Modify: `src/pages/coach/StrengthCatalog.tsx` (exercise list section, lines 962-1020)

**Step 1: Compute grouped exercises**

```typescript
const unfiledExercises = useMemo(() =>
  (exercises ?? []).filter((ex) => !ex.folder_id),
  [exercises]
);

const exercisesByFolder = useMemo(() => {
  const map = new Map<number, Exercise[]>();
  for (const ex of (exercises ?? [])) {
    if (ex.folder_id) {
      const arr = map.get(ex.folder_id) ?? [];
      arr.push(ex);
      map.set(ex.folder_id, arr);
    }
  }
  return map;
}, [exercises]);
```

**Step 2: Update exercise list rendering**

Replace the flat exercise list (lines 974-1019) with grouped rendering:

```tsx
{/* Unfiled exercises */}
{unfiledExercises.map((exercise) => (
  <ExerciseRow key={exercise.id} exercise={exercise} ... />
))}

{/* Exercise folders */}
{exerciseFolders?.map((folder) => {
  const folderExercises = exercisesByFolder.get(folder.id) ?? [];
  return (
    <FolderSection
      key={folder.id}
      name={folder.name}
      count={folderExercises.length}
      onRename={(newName) => renameFolder.mutate({ id: folder.id, name: newName })}
      onDelete={() => deleteFolderMut.mutate(folder.id)}
    >
      {folderExercises.length > 0 ? (
        folderExercises.map((exercise) => (
          <ExerciseRow key={exercise.id} exercise={exercise} ... />
        ))
      ) : (
        <div className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Dossier vide
        </div>
      )}
    </FolderSection>
  );
})}
```

Extract the per-exercise row into a local component or inline helper for DRY.

**Step 3: Add "Nouveau dossier" button for exercises**

In the exercise section header (line 963-971), add a "Dossier" button:

```tsx
<button
  type="button"
  onClick={() => {
    const name = prompt("Nom du dossier");
    if (name?.trim()) createFolder.mutate({ name: name.trim(), type: "exercise" });
  }}
  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
>
  <FolderPlus className="h-4 w-4" /> Dossier
</button>
```

**Step 4: Add folder selector in exercise create/edit dialog**

In the exercise creation dialog and edit dialog, add a `folder_id` Select (same pattern as session folder selector).

Update `newExercise` and `editingExercise` state to include `folder_id`.

**Step 5: Add move action on exercise rows**

Add a small folder icon button on each exercise row. When clicked, show a popover with folder choices.

**Step 6: Build check + commit**

```bash
npm run build 2>&1 | tail -5
git add src/pages/coach/StrengthCatalog.tsx
git commit -m "feat: integrate folders into exercises section"
```

---

### Task 6: Move-to-folder dialog component

**Files:**
- Create: `src/components/coach/strength/MoveToFolderPopover.tsx`

**Step 1: Create the component**

A reusable popover that lists available folders + "Aucun dossier" option. Used for both sessions and exercises.

```tsx
import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FolderInput } from "lucide-react";
import type { StrengthFolder } from "@/lib/api";

interface MoveToFolderPopoverProps {
  folders: StrengthFolder[];
  currentFolderId?: number | null;
  onMove: (folderId: number | null) => void;
  children?: React.ReactNode;
}

export function MoveToFolderPopover({
  folders,
  currentFolderId,
  onMove,
  children,
}: MoveToFolderPopoverProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Déplacer"
            title="Déplacer vers un dossier"
          >
            <FolderInput className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <button
          type="button"
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${!currentFolderId ? "font-semibold" : ""}`}
          onClick={() => { onMove(null); setOpen(false); }}
        >
          Aucun dossier
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${currentFolderId === folder.id ? "font-semibold" : ""}`}
            onClick={() => { onMove(folder.id); setOpen(false); }}
          >
            {folder.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Wire into session cards and exercise rows**

In `StrengthCatalog.tsx`, import `MoveToFolderPopover` and add it to session cards (via `SessionListView` — either extend with a render prop for extra actions, or add inline in the `renderMetrics` area).

For `SessionListView`, add an optional `renderExtraActions?: (session: T) => React.ReactNode` prop and render it in the action button row.

For exercise rows, add the popover inline.

**Step 3: Build + commit**

```bash
npm run build 2>&1 | tail -5
git add src/components/coach/strength/MoveToFolderPopover.tsx src/pages/coach/StrengthCatalog.tsx src/components/coach/shared/SessionListView.tsx
git commit -m "feat: add MoveToFolderPopover for sessions and exercises"
```

---

### Task 7: Final verification and documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`

**Step 1: Full build verification**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

**Step 2: Manual testing checklist**

- [ ] Create a session folder → appears in list
- [ ] Create an exercise folder → appears in list
- [ ] Rename a folder → name updates
- [ ] Delete a folder → items return to unfiled
- [ ] Create session with folder → appears in correct folder
- [ ] Move session to different folder → moves correctly
- [ ] Move session to "no folder" → appears unfiled
- [ ] Same for exercises
- [ ] Search filters across all folders
- [ ] Collapsing/expanding folders works

**Step 3: Update documentation**

Add entry to `docs/implementation-log.md` and update `docs/FEATURES_STATUS.md`.

**Step 4: Commit**

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md
git commit -m "docs: log strength folders implementation"
```

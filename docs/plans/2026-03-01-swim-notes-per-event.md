# Notes techniques par épreuve — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrichir les notes techniques nageur avec épreuve FFN, bassin et équipement pour permettre le suivi de progression par épreuve.

**Architecture:** Ajout de 3 colonnes à `swim_exercise_logs` (event_code, pool_length, equipment). Session_id rendu nullable pour les notes standalone. Page /swim-notes enrichie avec vue groupée par épreuve et formulaire de création standalone.

**Tech Stack:** Supabase (migration SQL), TypeScript types, React (formulaires, groupement), objectiveHelpers.ts (FFN_EVENTS, eventLabel)

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/00057_swim_logs_event_equipment.sql`

**Step 1: Écrire la migration**

```sql
-- Add event, pool and equipment columns to swim_exercise_logs
ALTER TABLE swim_exercise_logs
  ADD COLUMN IF NOT EXISTS event_code TEXT,
  ADD COLUMN IF NOT EXISTS pool_length INTEGER,
  ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT '{aucun}';

-- Make session_id nullable (standalone notes without a session)
ALTER TABLE swim_exercise_logs ALTER COLUMN session_id DROP NOT NULL;

-- Index for querying by user + event
CREATE INDEX IF NOT EXISTS idx_swim_exercise_logs_user_event
  ON swim_exercise_logs(user_id, event_code)
  WHERE event_code IS NOT NULL;
```

**Step 2: Appliquer la migration via Supabase MCP**

**Step 3: Commit**

```
feat: add event_code, pool_length, equipment to swim_exercise_logs
```

---

### Task 2: Types TypeScript

**Files:**
- Modify: `src/lib/api/types.ts` (lignes 365-386)

**Step 1: Enrichir SwimExerciseLog**

Ajouter 3 champs à l'interface `SwimExerciseLog` :

```typescript
export interface SwimExerciseLog {
  id: string;
  session_id: number | null;  // nullable (standalone)
  user_id: string;
  exercise_label: string;
  source_item_id: number | null;
  split_times: SplitTimeEntry[];
  tempo: number | null;
  stroke_count: StrokeCountEntry[];
  notes: string | null;
  event_code: string | null;      // NEW
  pool_length: number | null;     // NEW
  equipment: string[];            // NEW
  created_at: string;
  updated_at: string;
}
```

**Step 2: Enrichir SwimExerciseLogInput**

```typescript
export interface SwimExerciseLogInput {
  exercise_label: string;
  source_item_id?: number | null;
  split_times?: SplitTimeEntry[];
  tempo?: number | null;
  stroke_count?: StrokeCountEntry[];
  notes?: string | null;
  event_code?: string | null;      // NEW
  pool_length?: number | null;     // NEW
  equipment?: string[];            // NEW
}
```

**Step 3: Ajouter le type Equipment**

Après `StrokeCountEntry`, ajouter :

```typescript
export const EQUIPMENT_OPTIONS = [
  { value: "aucun", label: "Sans équipement" },
  { value: "palmes", label: "Palmes" },
  { value: "plaquettes", label: "Plaquettes" },
  { value: "pull-buoy", label: "Pull-buoy" },
  { value: "tuba", label: "Tuba frontal" },
  { value: "elastique", label: "Élastique" },
  { value: "combinaison", label: "Combinaison" },
] as const;
```

**Step 4: Vérifier** `npx tsc --noEmit`

**Step 5: Commit**

```
feat: add event_code, pool_length, equipment to swim log types
```

---

### Task 3: API swim-logs.ts

**Files:**
- Modify: `src/lib/api/swim-logs.ts`
- Modify: `src/lib/api/index.ts`

**Step 1: Mettre à jour `mapFromDb`**

```typescript
function mapFromDb(row: Record<string, unknown>): SwimExerciseLog {
  return {
    id: String(row.id),
    session_id: row.session_id != null ? Number(row.session_id) : null,
    user_id: String(row.user_id),
    exercise_label: String(row.exercise_label ?? ''),
    source_item_id: row.source_item_id != null ? Number(row.source_item_id) : null,
    split_times: Array.isArray(row.split_times) ? row.split_times as SwimExerciseLog['split_times'] : [],
    tempo: row.tempo != null ? Number(row.tempo) : null,
    stroke_count: Array.isArray(row.stroke_count) ? row.stroke_count as SwimExerciseLog['stroke_count'] : [],
    notes: row.notes != null ? String(row.notes) : null,
    event_code: row.event_code != null ? String(row.event_code) : null,
    pool_length: row.pool_length != null ? Number(row.pool_length) : null,
    equipment: Array.isArray(row.equipment) ? (row.equipment as string[]) : ['aucun'],
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}
```

**Step 2: Mettre à jour `saveSwimExerciseLogs` rows mapping**

Ajouter les 3 champs dans le mapping rows :

```typescript
const rows = logs.map((log) => ({
  session_id: sessionId,
  user_id: userId,
  exercise_label: log.exercise_label,
  source_item_id: log.source_item_id ?? null,
  split_times: log.split_times ?? [],
  tempo: log.tempo ?? null,
  stroke_count: log.stroke_count ?? [],
  notes: log.notes ?? null,
  event_code: log.event_code ?? null,
  pool_length: log.pool_length ?? null,
  equipment: log.equipment ?? ['aucun'],
}));
```

**Step 3: Mettre à jour `updateSwimExerciseLog` patch handling**

Ajouter après les lignes existantes :

```typescript
if (patch.event_code !== undefined) row.event_code = patch.event_code;
if (patch.pool_length !== undefined) row.pool_length = patch.pool_length;
if (patch.equipment !== undefined) row.equipment = patch.equipment;
```

**Step 4: Ajouter `createStandaloneSwimLog`**

Nouvelle fonction pour les notes sans session :

```typescript
export async function createStandaloneSwimLog(
  userId: string,
  log: SwimExerciseLogInput,
): Promise<string> {
  if (!canUseSupabase()) return '';

  const { data, error } = await supabase
    .from('swim_exercise_logs')
    .insert({
      user_id: userId,
      session_id: null,
      exercise_label: log.exercise_label,
      source_item_id: null,
      split_times: log.split_times ?? [],
      tempo: log.tempo ?? null,
      stroke_count: log.stroke_count ?? [],
      notes: log.notes ?? null,
      event_code: log.event_code ?? null,
      pool_length: log.pool_length ?? null,
      equipment: log.equipment ?? ['aucun'],
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data?.id ?? '';
}
```

**Step 5: Exporter dans index.ts**

Ajouter `createStandaloneSwimLog` à l'export swim-logs.

**Step 6: Vérifier** `npx tsc --noEmit`

**Step 7: Commit**

```
feat: update swim-logs API for event/equipment fields + standalone creation
```

---

### Task 4: UI — Page /swim-notes enrichie

**Files:**
- Modify: `src/pages/SwimNotes.tsx`
- Modify: `src/components/dashboard/SwimExerciseLogsHistory.tsx`

**Step 1: Refactorer SwimExerciseLogsHistory pour le groupement par épreuve**

Quand `standalone` est true, grouper les logs par `event_code + pool_length` au lieu de par date. Les logs sans event_code vont dans un groupe "Non classées".

Utiliser `eventLabel()` de `objectiveHelpers.ts` pour les labels de section.

**Step 2: Ajouter le bouton "+" dans SwimNotes.tsx**

Bouton action dans le `PageHeader` qui ouvre un Sheet/Dialog de création.

**Step 3: Créer le formulaire de saisie standalone**

Formulaire avec :
- Select épreuve (FFN_EVENTS via objectiveHelpers)
- Toggle bassin 25m/50m
- Chips multi-select équipement (EQUIPMENT_OPTIONS)
- Champs existants : splits, tempo, coups, notes

**Step 4: Enrichir LogEntry pour afficher event/bassin/equipment**

Dans la vue lecture, afficher des badges colorés pour l'épreuve, le bassin et les équipements.

**Step 5: Vérifier** `npx tsc --noEmit`

**Step 6: Commit**

```
feat: swim notes page grouped by event with standalone creation form
```

---

### Task 5: UI — ExerciseLogInline enrichi (saisie en séance)

**Files:**
- Modify: `src/components/swim/ExerciseLogInline.tsx`

**Step 1: Ajouter les sélecteurs épreuve/bassin/équipement**

En haut du formulaire inline, ajouter :
- Select épreuve (optionnel, pré-rempli si détectable depuis l'exercice)
- Toggle bassin 25/50
- Chips équipement

**Step 2: Propager dans onChange**

Les 3 nouveaux champs doivent être inclus dans le `SwimExerciseLogInput` émis par onChange.

**Step 3: Vérifier** `npx tsc --noEmit`

**Step 4: Commit**

```
feat: add event/pool/equipment selectors to inline exercise log form
```

---

### Task 6: Documentation

**Files:**
- Modify: `CLAUDE.md` — mettre à jour la taille de swim-logs.ts et SwimNotes.tsx
- Modify: `docs/implementation-log.md` — entrée §88

**Step 1: Écrire l'entrée implementation-log**

**Step 2: Mettre à jour CLAUDE.md si fichiers clés changent**

**Step 3: Commit et push**

```
docs: add §88 swim notes per event implementation log
```

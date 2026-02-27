# Neurotype Quiz Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 30-question neurotype quiz to the swimmer Profile page that calculates and persists training neurotype results.

**Architecture:** Client-side quiz with scoring logic, results stored as JSONB in `user_profiles.neurotype_result` via the existing `updateProfile` API. Quiz flow uses the same `activeSection` pattern as `SwimmerObjectivesView`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase (migration), Framer Motion, Lucide icons

---

### Task 1: Database Migration — Add neurotype_result column

**Files:**
- Create: `supabase/migrations/00033_neurotype_result.sql`

**Step 1: Apply migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with project_id `fscnobivsgornxdwqwlk`:

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS neurotype_result jsonb DEFAULT NULL;

COMMENT ON COLUMN user_profiles.neurotype_result IS
'Stores neurotype quiz result: { dominant, scores, takenAt }';
```

**Step 2: Also create the local migration file**

Create `supabase/migrations/00033_neurotype_result.sql` with the same SQL content for version control.

**Step 3: Commit**

```bash
git add supabase/migrations/00033_neurotype_result.sql
git commit -m "feat: add neurotype_result column to user_profiles"
```

---

### Task 2: Types & API Layer — Wire neurotype_result through the API

**Files:**
- Modify: `src/lib/api/types.ts` (add NeurotypResult type and extend UserProfile)
- Modify: `src/lib/api/users.ts` (include neurotype_result in getProfile and updateProfile)
- Modify: `src/lib/api.ts` (re-export new type)

**Step 1: Add NeurotypResult type to `src/lib/api/types.ts`**

After the `PlannedAbsence` interface (end of file), add:

```typescript
export interface NeurotypScores {
  "1A": number;
  "1B": number;
  "2A": number;
  "2B": number;
  "3": number;
}

export type NeurotypCode = "1A" | "1B" | "2A" | "2B" | "3";

export interface NeurotypResult {
  dominant: NeurotypCode;
  scores: NeurotypScores;
  takenAt: string;
}
```

Also add `neurotype_result?: NeurotypResult | null;` to the `UserProfile` interface.

**Step 2: Update `getProfile` in `src/lib/api/users.ts`**

In the return object of `getProfile` (around line 35-47), add after the `phone` line:

```typescript
neurotype_result: data.neurotype_result ?? null,
```

**Step 3: Update `updateProfile` in `src/lib/api/users.ts`**

Add `neurotype_result?: NeurotypResult | null;` to the `profile` parameter type (around line 52-61).

The existing upsert at line 86-93 already spreads `payload.profile`, so it will automatically include `neurotype_result` when provided.

**Step 4: Re-export in `src/lib/api.ts`**

Add `NeurotypResult`, `NeurotypScores`, `NeurotypCode` to the type re-exports at the top of the file.

**Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing stories errors are OK).

**Step 6: Commit**

```bash
git add src/lib/api/types.ts src/lib/api/users.ts src/lib/api.ts
git commit -m "feat: add NeurotypResult type and wire through API layer"
```

---

### Task 3: Quiz Data File — All 30 questions + 5 profiles

**Files:**
- Create: `src/lib/neurotype-quiz-data.ts`

**Step 1: Create the quiz data file**

Create `src/lib/neurotype-quiz-data.ts` containing:

1. **`NEUROTYPE_QUESTIONS`** — Array of 30 question objects, each with:
   ```typescript
   interface QuizQuestion {
     id: number;           // 1-30
     text: string;         // The question text
     options: Array<{
       label: string;      // The answer text
       scores: NeurotypCode[]; // Which neurotypes get a point
     }>;
   }
   ```

2. **`NEUROTYPE_PROFILES`** — Record keyed by NeurotypCode with profile data:
   ```typescript
   interface NeurotypProfile {
     code: NeurotypCode;
     name: string;           // e.g. "Intensité"
     fullName: string;       // e.g. "Le Neurotype INTENSITÉ"
     neurotransmitter: string;
     motto: string;          // devise
     traits: string[];       // bullet points
     gymTraining: string[];  // Entraînement en Salle bullets
     poolTraining: string[]; // Entraînement en Piscine bullets
   }
   ```

3. **`NEUROTYPE_COLORS`** — Colors per neurotype for UI:
   ```typescript
   const NEUROTYPE_COLORS: Record<NeurotypCode, string> = {
     "1A": "#ef4444", // red-500
     "1B": "#f97316", // orange-500
     "2A": "#eab308", // yellow-500
     "2B": "#22c55e", // green-500
     "3":  "#3b82f6", // blue-500
   };
   ```

Copy all 30 questions and their scoring exactly from `docs/quiz-swimstrength-neurotype.md`. Copy all 5 profile descriptions (traits, gym, pool) from the same file.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/lib/neurotype-quiz-data.ts
git commit -m "feat: add neurotype quiz data (30 questions + 5 profiles)"
```

---

### Task 4: Scoring Logic

**Files:**
- Create: `src/lib/neurotype-scoring.ts`

**Step 1: Create the scoring module**

Create `src/lib/neurotype-scoring.ts`:

```typescript
import type { NeurotypCode, NeurotypScores, NeurotypResult } from "./api/types";
import { NEUROTYPE_QUESTIONS } from "./neurotype-quiz-data";

/**
 * Calculate neurotype scores from user answers.
 * @param answers - Map of questionId -> selected option index (0-based)
 */
export function calculateNeurotypScores(
  answers: Record<number, number>
): NeurotypResult {
  const codes: NeurotypCode[] = ["1A", "1B", "2A", "2B", "3"];
  const points: Record<NeurotypCode, number> = { "1A": 0, "1B": 0, "2A": 0, "2B": 0, "3": 0 };
  const maxPoints: Record<NeurotypCode, number> = { "1A": 0, "1B": 0, "2A": 0, "2B": 0, "3": 0 };

  for (const q of NEUROTYPE_QUESTIONS) {
    // Count max possible points for this question (union of all option scores)
    const allCodes = new Set<NeurotypCode>();
    for (const opt of q.options) {
      for (const code of opt.scores) allCodes.add(code);
    }
    for (const code of allCodes) maxPoints[code]++;

    // Add points for selected answer
    const selectedIdx = answers[q.id];
    if (selectedIdx !== undefined && q.options[selectedIdx]) {
      for (const code of q.options[selectedIdx].scores) {
        points[code]++;
      }
    }
  }

  // Calculate percentages
  const scores = {} as NeurotypScores;
  for (const code of codes) {
    scores[code] = maxPoints[code] > 0
      ? Math.round((points[code] / maxPoints[code]) * 100)
      : 0;
  }

  // Find dominant
  const dominant = codes.reduce((best, code) =>
    scores[code] > scores[best] ? code : best
  );

  return {
    dominant,
    scores,
    takenAt: new Date().toISOString(),
  };
}

/** Get the level label for a percentage */
export function getNeurotypLevel(pct: number): "match" | "potential" | "unsuited" {
  if (pct >= 71) return "match";
  if (pct >= 49) return "potential";
  return "unsuited";
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/lib/neurotype-scoring.ts
git commit -m "feat: add neurotype scoring logic"
```

---

### Task 5: Quiz UI Component

**Files:**
- Create: `src/components/neurotype/NeurotypQuiz.tsx`

**Step 1: Create the quiz component**

Create `src/components/neurotype/NeurotypQuiz.tsx`. This component handles:

1. **Intro screen** — Title "Découvre ton Type d'Entraînement" + subtitle from doc + "Commencer" button
2. **Question carousel** — One question at a time:
   - Progress bar at top (`currentQ / 30`)
   - Question text
   - 2-3 radio-button-styled options (card layout, tappable)
   - Auto-advance to next question on selection (with small delay ~300ms for visual feedback)
   - Back button to go to previous question
3. **On completion** — Calls `calculateNeurotypScores(answers)` and passes result to parent via `onComplete(result: NeurotypResult)` prop

**Props:**
```typescript
interface NeurotypQuizProps {
  onComplete: (result: NeurotypResult) => void;
  onCancel: () => void;
}
```

**Key UI details:**
- Use Framer Motion `AnimatePresence` for slide transitions between questions
- Progress bar: `div` with `bg-primary` and width based on percentage
- Options: `button` with `rounded-xl border bg-card p-4` — when selected, briefly highlight with `ring-2 ring-primary bg-primary/5`
- Back arrow button (Lucide `ArrowLeft`) in top-left, "Quitter" text link for cancel
- Mobile-first responsive design

**Step 2: Run type check and dev server**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/components/neurotype/NeurotypQuiz.tsx
git commit -m "feat: add NeurotypQuiz component (30-question flow)"
```

---

### Task 6: Result UI Component

**Files:**
- Create: `src/components/neurotype/NeurotypResult.tsx`

**Step 1: Create the result component**

Create `src/components/neurotype/NeurotypResult.tsx`. Displays:

1. **Header** — Neurotype code badge + full name + motto + neurotransmitter
2. **Score bars** — 5 horizontal bars, one per neurotype:
   - Bar fill colored per neurotype color from `NEUROTYPE_COLORS`
   - Percentage label
   - Level badge: "Correspondance" (green), "Potentiel" (yellow), "Inadapté" (muted)
3. **Main section: "Entraînement en Salle"** — Always expanded, list of bullets from `gymTraining`
4. **Accordion sections:**
   - "Traits de personnalité" — collapsed by default, bullets from `traits`
   - "Entraînement en Piscine" — collapsed by default, bullets from `poolTraining`
5. **Action buttons:**
   - "Enregistrer" (primary) — calls `onSave(result)` prop
   - "Refaire le quiz" — calls `onRetry()` prop

**Props:**
```typescript
interface NeurotypResultProps {
  result: NeurotypResult;
  onSave: (result: NeurotypResult) => void;
  onRetry: () => void;
  onBack: () => void;
  isSaving?: boolean;
}
```

**Key UI details:**
- Use the existing `Collapsible` from Radix (or simple state toggle with Framer Motion `AnimatePresence`)
- Score bars use Tailwind `h-3 rounded-full` with width transition
- Mobile-first, max-w-lg centered

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/components/neurotype/NeurotypResult.tsx
git commit -m "feat: add NeurotypResult component (scores + profile display)"
```

---

### Task 7: Integrate Into Profile Page

**Files:**
- Modify: `src/pages/Profile.tsx`

**Step 1: Add neurotype section state and imports**

In `Profile.tsx`:

1. Import the new components:
   ```typescript
   import NeurotypQuiz from "@/components/neurotype/NeurotypQuiz";
   import NeurotypResultView from "@/components/neurotype/NeurotypResult";
   import { Brain } from "lucide-react";
   ```

2. Extend `activeSection` state type:
   ```typescript
   const [activeSection, setActiveSection] = useState<"home" | "objectives" | "neurotype-quiz" | "neurotype-result">("home");
   ```

3. Import `NeurotypResult` type:
   ```typescript
   import type { NeurotypResult } from "@/lib/api/types";
   ```

4. Add a local state for pending quiz result:
   ```typescript
   const [pendingNeurotypResult, setPendingNeurotypResult] = useState<NeurotypResult | null>(null);
   ```

**Step 2: Add save mutation**

Add a mutation for saving the neurotype result:

```typescript
const saveNeurotyp = useMutation({
  mutationFn: (result: NeurotypResult) =>
    api.updateProfile({
      userId,
      profile: { neurotype_result: result },
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    setPendingNeurotypResult(null);
    setActiveSection("home");
    toast({ title: "Neurotype enregistré" });
  },
  onError: (error: unknown) => {
    toast({
      title: "Erreur",
      description: String((error as Error)?.message || error),
      variant: "destructive",
    });
  },
});
```

**Step 3: Add section routing**

Before the `if (activeSection === "objectives")` block, add:

```typescript
if (activeSection === "neurotype-quiz") {
  return (
    <NeurotypQuiz
      onComplete={(result) => {
        setPendingNeurotypResult(result);
        setActiveSection("neurotype-result");
      }}
      onCancel={() => setActiveSection("home")}
    />
  );
}

if (activeSection === "neurotype-result" && pendingNeurotypResult) {
  return (
    <NeurotypResultView
      result={pendingNeurotypResult}
      onSave={(result) => saveNeurotyp.mutate(result)}
      onRetry={() => {
        setPendingNeurotypResult(null);
        setActiveSection("neurotype-quiz");
      }}
      onBack={() => setActiveSection("home")}
      isSaving={saveNeurotyp.isPending}
    />
  );
}
```

**Step 4: Add neurotype card to navigation grid**

In the navigation grid (the `<div className="grid grid-cols-2 gap-3">` section), add a new card for swimmers only. Add it after the "Objectifs" button:

```tsx
{showRecords && (
  <button type="button"
    onClick={() => {
      if (profile?.neurotype_result) {
        setPendingNeurotypResult(profile.neurotype_result);
        setActiveSection("neurotype-result");
      } else {
        setActiveSection("neurotype-quiz");
      }
    }}
    className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Brain className="h-5 w-5 text-primary mb-2" />
    {profile?.neurotype_result ? (
      <>
        <p className="text-sm font-bold">{profile.neurotype_result.dominant} — {getNeurotypName(profile.neurotype_result.dominant)}</p>
        <p className="text-xs text-muted-foreground">Mon neurotype</p>
      </>
    ) : (
      <>
        <p className="text-sm font-bold">Neurotype</p>
        <p className="text-xs text-muted-foreground">Découvrir mon profil</p>
      </>
    )}
  </button>
)}
```

Also add a small helper at the top of the file or import from quiz data:
```typescript
import { NEUROTYPE_PROFILES } from "@/lib/neurotype-quiz-data";
const getNeurotypName = (code: string) => NEUROTYPE_PROFILES[code as NeurotypCode]?.name ?? code;
```

**Step 5: Run type check and manual test**

Run: `npx tsc --noEmit`
Expected: No new errors.

Run: `npm run dev`
Test manually: navigate to Profile, see the Neurotype card, click it, go through the quiz, see results, save.

**Step 6: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: integrate neurotype quiz into Profile page"
```

---

### Task 8: Final Polish — Build Check & Documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds.

**Step 2: Run tests**

Run: `npm test`
Expected: No new test failures (pre-existing failures are OK).

**Step 3: Update documentation files**

Per the documentation workflow in CLAUDE.md:

1. **`docs/implementation-log.md`** — Add entry for this feature (§ number, context, files modified, decisions)
2. **`docs/ROADMAP.md`** — Add chantier "Quiz neurotype nageur" as Fait
3. **`docs/FEATURES_STATUS.md`** — Add "Quiz neurotype" feature as ✅
4. **`CLAUDE.md`** — Add new files to the "Fichiers clés" table:
   - `src/lib/neurotype-quiz-data.ts`
   - `src/lib/neurotype-scoring.ts`
   - `src/components/neurotype/NeurotypQuiz.tsx`
   - `src/components/neurotype/NeurotypResult.tsx`

**Step 4: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add neurotype quiz to implementation log and roadmap"
```

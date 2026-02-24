# Objectifs visuels + nettoyage Progression — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supprimer les objectifs de la page Progression (déplacés dans le plan d'objectifs) et rendre les cartes d'objectifs chronométriques plus visuelles avec jauge de progression basée sur les records perso.

**Architecture:** On ajoute un mapping event_code → event_name dans objectiveHelpers.ts pour matcher les records swim_records. Les cartes objectifs dans SwimmerObjectivesView.tsx sont redesignées avec temps cible en grand, barre de progression, bordure colorée par nage, countdown compétition. La query swim_records est ajoutée au composant.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, React Query 5, Shadcn Badge

---

### Task 1: Remove objectives from Progress.tsx

**Files:**
- Modify: `src/pages/Progress.tsx`

**Step 1: Remove imports and helpers**

In `src/pages/Progress.tsx`:

Remove the import (line 36):
```typescript
import type { Objective } from "@/lib/api/types";
```

Remove `Target` from the lucide-react import (line 34) — keep the other icons.

Remove the local helper functions (lines 151-173):
```typescript
// ─── Objective Helpers ──────────────────────────────────────────────────────

function eventLabel(code: string): string { ... }

function formatTargetTime(seconds: number): string { ... }

function daysUntil(dateStr: string): number { ... }
```

**Step 2: Remove the objectives query**

Remove (lines 193-196):
```typescript
  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ["my-objectives"],
    queryFn: () => api.getAthleteObjectives(),
  });
```

**Step 3: Remove the objectives JSX section**

Remove the entire "Mes objectifs" block (lines 482-532):
```tsx
      {/* ── Mes objectifs ─────────────────────────────────────────────── */}
      {objectives.length > 0 && (
        <motion.div variants={slideUp} initial="hidden" animate="visible">
          ...
        </motion.div>
      )}
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/pages/Progress.tsx
git commit -m "refactor: remove objectives from Progress page (moved to Profile > Objectifs)"
```

---

### Task 2: Add event_code → event_name mapping to objectiveHelpers

**Files:**
- Modify: `src/lib/objectiveHelpers.ts`

**Step 1: Add the mapping and helper**

Append to `src/lib/objectiveHelpers.ts`:

```typescript
/**
 * Mapping from objective event_code to possible swim_records event_name values.
 * swim_records.event_name comes from FFN import and varies in format.
 */
const EVENT_CODE_TO_NAMES: Record<string, string[]> = {
  "50NL": ["50 NL", "50 Nage Libre"],
  "100NL": ["100 NL", "100 Nage Libre"],
  "200NL": ["200 NL", "200 Nage Libre"],
  "400NL": ["400 NL", "400 Nage Libre"],
  "800NL": ["800 NL", "800 Nage Libre"],
  "1500NL": ["1500 NL", "1500 Nage Libre"],
  "50DOS": ["50 Dos"],
  "100DOS": ["100 Dos"],
  "200DOS": ["200 Dos"],
  "50BR": ["50 Brasse"],
  "100BR": ["100 Brasse"],
  "200BR": ["200 Brasse"],
  "50PAP": ["50 Papillon", "50 Pap"],
  "100PAP": ["100 Papillon", "100 Pap"],
  "200PAP": ["200 Papillon", "200 Pap"],
  "200QN": ["200 4 Nages", "200 4N"],
  "400QN": ["400 4 Nages", "400 4N"],
};

/** Stroke color class (border-left) keyed by stroke suffix. */
export const STROKE_COLORS: Record<string, string> = {
  NL: "border-l-blue-500",
  DOS: "border-l-emerald-500",
  BR: "border-l-red-500",
  PAP: "border-l-violet-500",
  QN: "border-l-amber-500",
};

/** Extract stroke suffix from event_code (e.g. "100DOS" → "DOS"). */
export function strokeFromCode(code: string): string | null {
  const match = code.match(/^(\d+)(NL|DOS|BR|PAP|QN)$/);
  return match ? match[2] : null;
}

/**
 * Find the best (lowest) time_seconds from swim_records matching an objective.
 * Returns null if no matching record exists.
 */
export function findBestTime(
  records: Array<{ event_name: string; pool_length?: number | null; time_seconds?: number | null }>,
  eventCode: string,
  poolLength?: number | null,
): number | null {
  const names = EVENT_CODE_TO_NAMES[eventCode];
  if (!names) return null;
  const lowerNames = names.map((n) => n.toLowerCase());
  let best: number | null = null;
  for (const r of records) {
    if (r.time_seconds == null) continue;
    if (!lowerNames.includes(r.event_name.toLowerCase())) continue;
    if (poolLength != null && r.pool_length != null && r.pool_length !== poolLength) continue;
    if (best === null || r.time_seconds < best) best = r.time_seconds;
  }
  return best;
}

/** Days until a date string (YYYY-MM-DD). Negative if past. */
export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/lib/objectiveHelpers.ts
git commit -m "feat: add event_code→record mapping, stroke colors, findBestTime helper"
```

---

### Task 3: Redesign objective cards with gauge in SwimmerObjectivesView

**Files:**
- Modify: `src/components/profile/SwimmerObjectivesView.tsx`

This is the main visual redesign. Replace the two card components with a single `ObjectiveCard` that shows:
- Colored left border by stroke
- Time target in large font-mono
- Progress bar (current record → target) when a matching swim record exists
- Competition countdown badge
- Coach badge + edit/delete for personal objectives

**Step 1: Add swim records query and imports**

At the top of SwimmerObjectivesView.tsx, add to imports:

```typescript
import {
  FFN_EVENTS,
  eventLabel,
  formatTime,
  parseTime,
  STROKE_COLORS,
  strokeFromCode,
  findBestTime,
  daysUntil,
} from "@/lib/objectiveHelpers";
import { useAuth } from "@/lib/auth";
```

Inside the component, after the existing queries, add:

```typescript
const { user, userId } = useAuth();

const { data: swimRecordsData } = useQuery({
  queryKey: ["swim-records", userId],
  queryFn: () => api.getSwimRecords({ athleteId: userId }),
  enabled: !!userId,
});
const swimRecords = swimRecordsData?.records ?? [];
```

**Step 2: Replace ObjectiveCardReadOnly and ObjectiveCardEditable**

Replace both card components with a single unified `ObjectiveCard`:

```tsx
function ObjectiveCard({
  objective,
  isPersonal,
  bestTime,
  onEdit,
  onDelete,
}: {
  objective: Objective;
  isPersonal: boolean;
  bestTime: number | null;
  onEdit?: (obj: Objective) => void;
  onDelete?: (obj: Objective) => void;
}) {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;
  const stroke = hasChrono ? strokeFromCode(objective.event_code!) : null;
  const borderColor = stroke ? STROKE_COLORS[stroke] ?? "" : "";
  const hasTarget = objective.target_time_seconds != null;
  const hasCompetition = !!objective.competition_name;
  const daysLeft = objective.competition_date ? daysUntil(objective.competition_date) : null;

  // Progress calculation
  let progressPct: number | null = null;
  if (hasTarget && bestTime != null && objective.target_time_seconds != null) {
    // Lower time = better. Progress = how close current is to target.
    // 100% = reached target, 0% = no improvement from a baseline (we use 2x target as baseline)
    const target = objective.target_time_seconds;
    if (bestTime <= target) {
      progressPct = 100;
    } else {
      // Use a reasonable baseline: 120% of target (i.e. 20% slower)
      // If current is worse than baseline, clamp to ~5% to always show some bar
      const baseline = target * 1.2;
      if (bestTime >= baseline) {
        progressPct = 5;
      } else {
        progressPct = Math.round(((baseline - bestTime) / (baseline - target)) * 100);
      }
    }
  }

  return (
    <div
      className={[
        "rounded-xl border bg-card p-4 space-y-3",
        hasChrono ? `border-l-4 ${borderColor}` : "",
      ].join(" ")}
    >
      {/* Top row: event info + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isPersonal && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Coach
          </Badge>
        )}
        {hasChrono && (
          <>
            <span className="text-sm font-semibold">
              {eventLabel(objective.event_code!)}
            </span>
            {objective.pool_length && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {objective.pool_length}m
              </Badge>
            )}
          </>
        )}
        {isPersonal && onEdit && onDelete && (
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => onEdit(objective)}
              className="text-xs text-primary hover:underline"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => onDelete(objective)}
              className="text-muted-foreground hover:text-destructive p-0.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chrono: large target time + progress bar */}
      {hasChrono && hasTarget && (
        <div className="space-y-2">
          {/* Times row */}
          <div className="flex items-end justify-between">
            {bestTime != null ? (
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{formatTime(bestTime)}</span>
                <span className="ml-1">actuel</span>
              </div>
            ) : (
              <div />
            )}
            <div className="text-right">
              <div className="text-2xl font-mono font-bold tracking-tight text-primary">
                {formatTime(objective.target_time_seconds!)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                objectif
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {progressPct != null && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-500",
                    progressPct >= 100 ? "bg-emerald-500" : "bg-primary",
                  ].join(" ")}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground text-right">
                {progressPct >= 100 ? "Objectif atteint !" : `${progressPct}%`}
              </div>
            </div>
          )}

          {/* No record fallback */}
          {bestTime == null && (
            <p className="text-[10px] text-muted-foreground italic">
              Pas encore de temps enregistré pour cette épreuve
            </p>
          )}
        </div>
      )}

      {/* Text objective */}
      {hasText && (
        <p className="text-sm text-muted-foreground">{objective.text}</p>
      )}

      {/* Competition countdown */}
      {hasCompetition && (
        <Badge
          variant="outline"
          className="border-orange-300 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0"
        >
          {objective.competition_name}
          {daysLeft != null && daysLeft > 0 && (
            <span className="ml-1 font-bold">J-{daysLeft}</span>
          )}
        </Badge>
      )}
    </div>
  );
}
```

**Step 3: Update the main render to use ObjectiveCard**

Replace the coach objectives section:
```tsx
{coachObjectives.map((obj) => (
  <ObjectiveCard
    key={obj.id}
    objective={obj}
    isPersonal={false}
    bestTime={obj.event_code ? findBestTime(swimRecords, obj.event_code, obj.pool_length) : null}
  />
))}
```

Replace the personal objectives section:
```tsx
{personalObjectives.map((obj) => (
  <ObjectiveCard
    key={obj.id}
    objective={obj}
    isPersonal={true}
    bestTime={obj.event_code ? findBestTime(swimRecords, obj.event_code, obj.pool_length) : null}
    onEdit={openEdit}
    onDelete={setDeleteTarget}
  />
))}
```

**Step 4: Remove the old ObjectiveCardReadOnly and ObjectiveCardEditable functions**

Delete both functions at the bottom of the file (they are replaced by the unified ObjectiveCard).

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 6: Commit**

```bash
git add src/components/profile/SwimmerObjectivesView.tsx
git commit -m "feat: visual objective cards with progress bar, stroke colors, competition countdown"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `docs/implementation-log.md`

**Step 1: Add entry to implementation log**

Add `§62 — Objectifs visuels + nettoyage Progression` with:
- Contexte: objectifs déplacés de Progression vers Profil > Objectifs, cartes chrono visuelles
- Changements: suppression objectifs de Progress.tsx, ajout mapping event_code→event_name, redesign cartes avec jauge/couleurs/countdown
- Fichiers: `src/pages/Progress.tsx`, `src/lib/objectiveHelpers.ts`, `src/components/profile/SwimmerObjectivesView.tsx`

**Step 2: Commit**

```bash
git add docs/implementation-log.md
git commit -m "docs: add §62 visual objectives + progress cleanup"
```

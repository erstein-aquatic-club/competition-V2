# Swim Session Builder Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the coach swim session builder with condensed interactive view (accordion inline), recovery time (departure/rest), compact exercise form, and exercise duplication.

**Architecture:** Evolve existing SwimSessionBuilder by merging compact/detailed modes into a single accordion-style view. Add `restType` field to the SwimExercise interface and persist it in `raw_payload`. The data model and API layer remain unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Shadcn UI components, Node test runner

**Design doc:** `docs/plans/2026-02-15-swim-builder-redesign-design.md`

---

### Task 1: Add `restType` to SwimExercise and update serialization

**Files:**
- Modify: `src/pages/coach/SwimCatalog.tsx` (interfaces + buildItemsFromBlocks + buildBlocksFromItems)
- Modify: `src/components/coach/swim/SwimSessionBuilder.tsx` (interfaces + buildItemsFromBlocks)
- Modify: `src/components/coach/swim/SwimExerciseForm.tsx` (interface)
- Modify: `src/lib/types.ts` (SwimPayloadFields)

**Step 1: Add `restType` to `SwimExercise` interface in `SwimCatalog.tsx`**

In `src/pages/coach/SwimCatalog.tsx`, update the `SwimExercise` interface (line ~27):

```ts
interface SwimExercise {
  repetitions: number | null;
  distance: number | null;
  rest: number | null;
  restType: "departure" | "rest";  // NEW
  stroke: string;
  strokeType: string;
  intensity: string;
  modalities: string;
  equipment: string[];
}
```

**Step 2: Same change in `SwimSessionBuilder.tsx`**

In `src/components/coach/swim/SwimSessionBuilder.tsx`, update the same `SwimExercise` interface (line ~23):

```ts
interface SwimExercise {
  repetitions: number | null;
  distance: number | null;
  rest: number | null;
  restType: "departure" | "rest";  // NEW
  stroke: string;
  strokeType: string;
  intensity: string;
  modalities: string;
  equipment: string[];
}
```

**Step 3: Same change in `SwimExerciseForm.tsx`**

In `src/components/coach/swim/SwimExerciseForm.tsx`, update the `SwimExercise` interface (line ~11):

```ts
interface SwimExercise {
  repetitions: number | null;
  distance: number | null;
  rest: number | null;
  restType: "departure" | "rest";  // NEW
  stroke: string;
  strokeType: string;
  intensity: string;
  modalities: string;
  equipment: string[];
}
```

**Step 4: Add `exercise_rest_type` to `SwimPayloadFields` in `src/lib/types.ts`**

Add after `exercise_rest` (line ~28):

```ts
exercise_rest_type?: "departure" | "rest" | null;
```

**Step 5: Update `buildItemsFromBlocks` in `SwimCatalog.tsx` to serialize `restType`**

In the `rawPayload` object inside `buildItemsFromBlocks` (line ~101), add:

```ts
exercise_rest_type: exercise.restType ?? "rest",
```

**Step 6: Update `buildBlocksFromItems` in `SwimCatalog.tsx` to deserialize `restType`**

In the exercise object built inside `buildBlocksFromItems` (line ~163), add:

```ts
restType: (payload.exercise_rest_type as "departure" | "rest") ?? "rest",
```

**Step 7: Update `buildItemsFromBlocks` in `SwimSessionBuilder.tsx` to serialize `restType`**

Same as step 5, in the `rawPayload` object (line ~132), add:

```ts
exercise_rest_type: exercise.restType ?? "rest",
```

**Step 8: Update default exercise values everywhere**

In `SwimSessionBuilder.tsx` function `addBlock` (line ~200) and `addExercise` (line ~238), add `restType: "rest"` to the default exercise:

```ts
{
  repetitions: 4,
  distance: 50,
  rest: null,
  restType: "rest",  // NEW
  stroke: "crawl",
  strokeType: "nc",
  intensity: "V2",
  modalities: "",
  equipment: [],
}
```

**Step 9: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 10: Run existing tests**

Run: `npm test`
Expected: All tests pass (restType defaults to "rest" for backward compat)

**Step 11: Commit**

```bash
git add src/pages/coach/SwimCatalog.tsx src/components/coach/swim/SwimSessionBuilder.tsx src/components/coach/swim/SwimExerciseForm.tsx src/lib/types.ts
git commit -m "feat(swim): add restType field to SwimExercise for departure/rest recovery"
```

---

### Task 2: Add recovery time UI to SwimExerciseForm

**Files:**
- Modify: `src/components/coach/swim/SwimExerciseForm.tsx`

**Step 1: Add helper to format recovery time**

Add at the top of the file (after imports):

```ts
const formatRecoveryTime = (seconds: number | null) => {
  if (!seconds) return "";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0 && sec > 0) return `${min}'${sec.toString().padStart(2, "0")}`;
  if (min > 0) return `${min}'00`;
  return `${sec}s`;
};

const parseRecoveryMinSec = (seconds: number | null) => {
  if (!seconds) return { min: 0, sec: 0 };
  return { min: Math.floor(seconds / 60), sec: seconds % 60 };
};
```

**Step 2: Add Départ/Repos SegmentedControl + stepper to the form**

Replace the current form layout. After the intensity section (col-span-2), add a new recovery section:

```tsx
<div className="col-span-2">
  <div className="text-[11px] font-semibold text-muted-foreground">Récupération</div>
  <div className="mt-2 flex items-center gap-2">
    <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onChange("restType", "departure")}
        className={cn(
          "rounded-full px-3 py-1.5 transition-colors",
          exercise.restType === "departure"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Départ
      </button>
      <button
        type="button"
        onClick={() => onChange("restType", "rest")}
        className={cn(
          "rounded-full px-3 py-1.5 transition-colors",
          exercise.restType === "rest"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Repos
      </button>
    </div>
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        max={59}
        value={parseRecoveryMinSec(exercise.rest).min || ""}
        onChange={(e) => {
          const min = e.target.value === "" ? 0 : Number(e.target.value);
          const sec = parseRecoveryMinSec(exercise.rest).sec;
          onChange("rest", min * 60 + sec || null);
        }}
        placeholder="0"
        className="w-14 rounded-2xl text-center"
      />
      <span className="text-xs text-muted-foreground">min</span>
      <Input
        type="number"
        min={0}
        max={59}
        value={parseRecoveryMinSec(exercise.rest).sec || ""}
        onChange={(e) => {
          const sec = e.target.value === "" ? 0 : Number(e.target.value);
          const min = parseRecoveryMinSec(exercise.rest).min;
          onChange("rest", min * 60 + sec || null);
        }}
        placeholder="0"
        className="w-14 rounded-2xl text-center"
      />
      <span className="text-xs text-muted-foreground">sec</span>
    </div>
    {exercise.rest ? (
      <button
        type="button"
        onClick={() => onChange("rest", null)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Effacer
      </button>
    ) : null}
  </div>
</div>
```

**Step 3: Optimize form layout — group reps/distance/stroke/type on one row**

Replace the current 2-column grid for reps/distance/stroke/type with a more compact layout:

```tsx
<div className="grid flex-1 grid-cols-4 gap-2">
  <div>
    <div className="text-[11px] font-semibold text-muted-foreground">Rép.</div>
    <div className="mt-1">
      <Input
        type="number"
        min={1}
        value={exercise.repetitions ?? ""}
        onChange={(e) =>
          onChange("repetitions", e.target.value === "" ? null : Number(e.target.value))
        }
        className="rounded-2xl"
      />
    </div>
  </div>
  <div>
    <div className="text-[11px] font-semibold text-muted-foreground">Dist. (m)</div>
    <div className="mt-1">
      <Input
        type="number"
        min={0}
        value={exercise.distance ?? ""}
        onChange={(e) => onChange("distance", e.target.value === "" ? null : Number(e.target.value))}
        className="rounded-2xl"
      />
    </div>
  </div>
  <div>
    <div className="text-[11px] font-semibold text-muted-foreground">Nage</div>
    <div className="mt-1">
      <Select value={exercise.stroke} onValueChange={(value) => onChange("stroke", value)}>
        <SelectTrigger className="rounded-2xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {strokeOptions.map((stroke) => (
            <SelectItem key={stroke.value} value={stroke.value}>
              {stroke.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
  <div>
    <div className="text-[11px] font-semibold text-muted-foreground">Type</div>
    <div className="mt-1">
      <Select value={exercise.strokeType} onValueChange={(value) => onChange("strokeType", value)}>
        <SelectTrigger className="rounded-2xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {strokeTypeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
</div>
```

On mobile (< sm), Tailwind will naturally stack these. Add responsive classes if needed: `grid-cols-2 sm:grid-cols-4`.

**Step 4: Run type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: Pass

**Step 5: Commit**

```bash
git add src/components/coach/swim/SwimExerciseForm.tsx
git commit -m "feat(swim): add departure/rest recovery toggle and compact exercise form layout"
```

---

### Task 3: Fuse compact/detailed views into accordion inline in SwimSessionBuilder

**Files:**
- Modify: `src/components/coach/swim/SwimSessionBuilder.tsx`

This is the main UX change. The compact view becomes interactive with inline accordion editing.

**Step 1: Add state for tracking which exercise is expanded**

Add state after existing state declarations:

```ts
const [expandedExercise, setExpandedExercise] = React.useState<{
  blockIndex: number;
  exerciseIndex: number;
} | null>(null);
```

**Step 2: Remove the `coachView` state and the toggle UI**

Delete the `coachView` state (line ~175) and the entire toggle section ("Vue coach" + "Condensé" / "Détail" buttons, lines ~300-324). Also delete the conditional rendering `{coachView === "compact" ? ... : ...}` structure — we'll replace it with the single unified view.

**Step 3: Build the unified view**

Replace the entire compact/detailed conditional with a single view. Each block shows its exercises as compact badge rows. Clicking an exercise opens the SwimExerciseForm inline below that exercise's summary row.

Key structure:

```tsx
<div className="space-y-3">
  {session.blocks.map((block, blockIndex) => (
    <div key={blockIndex} className="rounded-2xl border border-border bg-card">
      {/* Block header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            <Repeat className="inline h-3 w-3" /> {block.repetitions ?? 1}x
          </span>
          <Input
            value={block.title}
            onChange={(e) => updateBlock(blockIndex, "title", e.target.value)}
            placeholder={`Bloc ${blockIndex + 1}`}
            className="h-7 rounded-lg border-none bg-transparent px-1 text-xs font-semibold shadow-none focus-visible:bg-muted focus-visible:ring-1"
          />
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
            · {block.exercises.length} ex
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Block rep stepper */}
          <Input
            type="number"
            min={1}
            value={block.repetitions ?? ""}
            onChange={(e) =>
              updateBlock(blockIndex, "repetitions", e.target.value === "" ? null : Number(e.target.value))
            }
            className="h-7 w-12 rounded-lg text-center text-xs"
            placeholder="1"
          />
          <button type="button" onClick={() => moveBlock(blockIndex, "up")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
            disabled={blockIndex === 0}>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => moveBlock(blockIndex, "down")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
            disabled={blockIndex === session.blocks.length - 1}>
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => removeBlock(blockIndex)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Exercises */}
      <div className="border-t border-border">
        {block.exercises.map((exercise, exerciseIndex) => {
          const isExpanded =
            expandedExercise?.blockIndex === blockIndex &&
            expandedExercise?.exerciseIndex === exerciseIndex;
          const normalizedIntensity = normalizeIntensityValue(exercise.intensity);
          return (
            <div key={exerciseIndex} className="border-b border-border last:border-b-0">
              {/* Compact summary row — always visible */}
              <button
                type="button"
                onClick={() =>
                  setExpandedExercise(
                    isExpanded ? null : { blockIndex, exerciseIndex }
                  )
                }
                className={cn(
                  "flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] font-semibold transition-colors hover:bg-muted/50",
                  isExpanded && "bg-muted/50"
                )}
              >
                <span className="text-muted-foreground">
                  {exercise.repetitions ?? ""}×{exercise.distance ?? ""}m
                </span>
                <span className="text-muted-foreground">{exercise.stroke}</span>
                <span className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-0.5 ring-1",
                  swimTypeTone[exercise.strokeType] ?? "bg-muted ring-border"
                )}>
                  {strokeTypeLabels[exercise.strokeType] ?? exercise.strokeType}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-card px-1.5 py-0.5 ring-1",
                  intensityRingTone[normalizedIntensity],
                  intensityTextTone[normalizedIntensity],
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", intensityTone[normalizedIntensity] ?? "bg-muted")} />
                  {formatIntensityLabel(normalizedIntensity)}
                </span>
                {exercise.rest ? (
                  <span className="text-muted-foreground">
                    {exercise.restType === "departure" ? "⏱" : "⏸"}{" "}
                    {exercise.restType === "departure" ? "Dép." : "Repos"}{" "}
                    {formatRecoveryTime(exercise.rest)}
                  </span>
                ) : null}
                {exercise.equipment.length > 0 ? (
                  <span className="text-muted-foreground">
                    🏊{exercise.equipment.length}
                  </span>
                ) : null}
                <span className="ml-auto flex items-center gap-1">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExercise(blockIndex, exerciseIndex);
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </span>
              </button>

              {/* Expanded edit form */}
              {isExpanded ? (
                <div className="border-t border-border bg-muted/30 px-3 py-3">
                  <SwimExerciseForm
                    exercise={exercise}
                    onChange={(field, value) =>
                      updateExercise(blockIndex, exerciseIndex, field, value)
                    }
                    onDelete={() => removeExercise(blockIndex, exerciseIndex)}
                    onDuplicate={() => duplicateExercise(blockIndex, exerciseIndex)}
                    showDelete={true}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Add exercise button */}
      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => addExercise(blockIndex)}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80"
        >
          <Plus className="h-3 w-3" /> Exercice
        </button>
      </div>
    </div>
  ))}

  {!session.blocks.length ? (
    <div className="rounded-2xl border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
      Aucun bloc. Ajoute un bloc pour commencer.
    </div>
  ) : null}
</div>
```

**Step 4: Add `duplicateExercise` function**

After `removeExercise` function:

```ts
const duplicateExercise = (blockIndex: number, exerciseIndex: number) => {
  const blocks = [...session.blocks];
  const original = blocks[blockIndex].exercises[exerciseIndex];
  const copy = { ...original };
  blocks[blockIndex].exercises = [
    ...blocks[blockIndex].exercises.slice(0, exerciseIndex + 1),
    copy,
    ...blocks[blockIndex].exercises.slice(exerciseIndex + 1),
  ];
  onSessionChange({ ...session, blocks });
  setExpandedExercise({ blockIndex, exerciseIndex: exerciseIndex + 1 });
};
```

**Step 5: Add `formatRecoveryTime` helper (same as in SwimExerciseForm)**

Add at the top of the file:

```ts
const formatRecoveryTime = (seconds: number | null) => {
  if (!seconds) return "";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0 && sec > 0) return `${min}'${sec.toString().padStart(2, "0")}`;
  if (min > 0) return `${min}'00`;
  return `${sec}s`;
};
```

**Step 6: Update `SwimExerciseForm` props to accept `onDuplicate`**

In `SwimExerciseForm.tsx`, add to the props interface:

```ts
interface SwimExerciseFormProps {
  exercise: SwimExercise;
  onChange: (field: keyof SwimExercise, value: string | number | null | string[]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;  // NEW
  showDelete?: boolean;
}
```

Add a duplicate button next to the delete button in the form:

```tsx
{onDuplicate && (
  <button
    type="button"
    onClick={onDuplicate}
    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
    aria-label="Dupliquer exercice"
    title="Dupliquer exercice"
  >
    <Copy className="h-4 w-4" />
  </button>
)}
```

Add `Copy` to the lucide-react imports.

**Step 7: Add "Ajouter bloc" button after the blocks list**

After the blocks mapping, add:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={addBlock}
  className="h-10 rounded-full px-3 text-xs"
>
  <Plus className="h-4 w-4" /> Ajouter bloc
</Button>
```

**Step 8: Run type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: Pass

**Step 9: Commit**

```bash
git add src/components/coach/swim/SwimSessionBuilder.tsx src/components/coach/swim/SwimExerciseForm.tsx
git commit -m "feat(swim): unified accordion view with inline editing and exercise duplication"
```

---

### Task 4: Update SwimSessionConsultation to display recovery type

**Files:**
- Modify: `src/components/swim/SwimSessionConsultation.tsx`

**Step 1: Display "Dép." or "Repos" based on `exercise_rest_type`**

In the exercise rendering section, update the rest display (around line ~327-329). Currently it shows `{payload.exercise_rest}s`. Update to show the correct label:

```tsx
{payload.exercise_rest ? (
  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1 ring-border">
    <Timer className="h-3 w-3" />
    {payload.exercise_rest_type === "departure" ? "Dép." : "Repos"}{" "}
    {formatRecoveryDisplay(payload.exercise_rest)}
  </span>
) : null}
```

**Step 2: Add `formatRecoveryDisplay` helper**

Add at the top of the file:

```ts
const formatRecoveryDisplay = (seconds?: number | null) => {
  if (!seconds) return "";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0 && sec > 0) return `${min}'${sec.toString().padStart(2, "0")}`;
  if (min > 0) return `${min}'00`;
  return `${sec}s`;
};
```

**Step 3: Also update the compact mode display (around line ~349-353)**

Same change in the compact mode section.

**Step 4: Update `SwimExerciseDetail` type**

Add `restType` to the `SwimExerciseDetail` export:

```ts
export type SwimExerciseDetail = {
  // ... existing ...
  restType?: "departure" | "rest" | null;  // NEW
};
```

And set it in the exerciseDetail construction:

```ts
restType: (payload.exercise_rest_type as "departure" | "rest") ?? "rest",
```

**Step 5: Run type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: Pass

**Step 6: Commit**

```bash
git add src/components/swim/SwimSessionConsultation.tsx
git commit -m "feat(swim): display departure vs rest recovery type in session consultation"
```

---

### Task 5: Verify, build, and update documentation

**Files:**
- Run: `npm run build`
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/ROADMAP.md`

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Add entry to `docs/implementation-log.md`**

Add entry for the swim builder redesign with:
- Context and motivation
- List of all changes
- Files modified
- Decisions made (accordion inline, departure/rest toggle, duplication)

**Step 5: Update `docs/FEATURES_STATUS.md`**

Update the swim catalog feature status if needed.

**Step 6: Update `docs/ROADMAP.md`**

Add/update the swim builder redesign chantier status.

**Step 7: Final commit**

```bash
git add docs/
git commit -m "docs: update implementation log and feature status for swim builder redesign"
```

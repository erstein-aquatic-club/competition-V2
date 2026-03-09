# Strength UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the athlete strength training UX for mobile gym use — fix layout issues, remove friction, improve timer/rest experience, add exercise substitution/addition, and add offline resilience.

**Architecture:** 10 changes across 4 existing components (SessionDetailPreview, WorkoutRunner, SessionList, Strength page) plus 2 new components (ExercisePicker, ConnectionIndicator). No DB migrations. All exercise substitutions/additions are local state only — the real exercise_id in logs provides coach traceability.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Radix UI/Shadcn, Framer Motion, Zustand (via useStrengthState hook), localStorage for offline buffer.

---

## Task 1: Fix BottomActionBar safe area + radius iPhone

**Files:**
- Modify: `src/components/shared/BottomActionBar.tsx`

**Step 1: Update BottomActionBar styling**

In `src/components/shared/BottomActionBar.tsx`, update the inner container div (line 99-106) to add rounded top corners and proper safe-area padding:

```tsx
// Replace the inner div className (line 99-106)
<div
  className={cn(
    "flex w-full items-center justify-between gap-2 border-t bg-background/95 backdrop-blur-sm px-4 py-3",
    position === "fixed" && "mx-auto max-w-md rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]",
    position === "fixed" && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
    position === "static" && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
    containerClassName,
  )}
>
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```
fix: add rounded corners and safe-area padding to BottomActionBar
```

---

## Task 2: Fix SessionDetailPreview overflow + bottom padding

**Files:**
- Modify: `src/components/strength/SessionDetailPreview.tsx`

**Step 1: Increase bottom padding to prevent content hidden under action bar**

In `SessionDetailPreview.tsx` line 56, change `pb-36` to `pb-48`:

```tsx
<motion.div
  className="space-y-5 pb-48"
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```
fix: increase preview bottom padding to prevent content hidden under action bar
```

---

## Task 3: Add cycle context banner to SessionDetailPreview

**Files:**
- Modify: `src/components/strength/SessionDetailPreview.tsx`

**Step 1: Add cycle descriptions map and banner component**

After the imports in `SessionDetailPreview.tsx`, add a cycle descriptions map:

```tsx
const cycleDescriptions: Record<string, { color: string; bgColor: string; borderColor: string; description: string }> = {
  endurance: {
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Charges légères, séries longues, récupération courte. Travail d'endurance musculaire.",
  },
  hypertrophie: {
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800",
    description: "Charges modérées, séries moyennes. Travail de volume et de développement musculaire.",
  },
  force: {
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    borderColor: "border-red-200 dark:border-red-800",
    description: "Charges lourdes, peu de répétitions, récupération longue entre les séries.",
  },
};
```

**Step 2: Add banner JSX after the header in the component**

Insert after the header `<div className="flex items-center gap-3">` block (after line 77), before the hero card:

```tsx
{/* Cycle context banner */}
{(() => {
  const desc = cycleDescriptions[cycleType] ?? cycleDescriptions.endurance;
  const cycleLabel = cycleOptions.find((o) => o.value === cycleType)?.label ?? cycleType;
  const assignedCycle = assignment?.cycle;
  const hasCoachRecommendation = assignedCycle && assignedCycle !== cycleType;
  return (
    <div className={cn("rounded-2xl border p-4 space-y-2", desc.bgColor, desc.borderColor)}>
      <div className={cn("text-sm font-bold", desc.color)}>
        Cycle {cycleLabel} sélectionné
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {desc.description}
      </p>
      {hasCoachRecommendation && (
        <p className="text-xs font-semibold text-muted-foreground">
          Recommandé par le coach :{" "}
          <span className={desc.color}>
            {cycleOptions.find((o) => o.value === assignedCycle)?.label ?? assignedCycle}
          </span>
        </p>
      )}
    </div>
  );
})()}
```

**Step 3: Add `onCycleChange` prop to SessionDetailPreview**

Add to props interface:
```tsx
onCycleChange?: (cycle: StrengthCycleType) => void;
```

And in `Strength.tsx` where `SessionDetailPreview` is rendered (line 682), pass:
```tsx
onCycleChange={setCycleType}
```

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```
feat: add cycle context banner with description in session preview
```

---

## Task 4: Remove Step 0 from WorkoutRunner

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`
- Modify: `src/pages/Strength.tsx`

**Step 1: Remove step 0 rendering block**

In `WorkoutRunner.tsx`, delete the entire `if (currentStep === 0)` block (lines 540-583). Also remove the `isStarting` state variable (line 184) since it's only used in step 0.

**Step 2: Update initialStep default**

In `WorkoutRunner.tsx` line 160, change default from `0` to `1`:
```tsx
const [currentStep, setCurrentStep] = useState(initialStep ?? 1);
```

**Step 3: Ensure handleLaunchFocus always sets step to 1**

In `Strength.tsx`, `handleLaunchFocus` (line 475) already sets `setActiveRunnerStep(1)` — confirm this is the case. No change needed.

**Step 4: Remove onStart prop usage**

The `onStart` prop in WorkoutRunner was only used by step 0. Remove it from the component props interface and the destructuring. In `Strength.tsx`, remove the `onStart` prop passed to `<WorkoutRunner>` (lines 557-583).

**Step 5: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```
feat: remove step 0 intro screen — preview launches directly into exercise 1
```

---

## Task 5: Refonte bottom action bar in focus mode

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`

**Step 1: Replace 3-button bar with single primary + text link**

Replace the bottom bar block (lines 819-852) with:

```tsx
{!inputSheetOpen && !isResting ? (
  <BottomActionBar
    className="bottom-0 z-modal"
    containerClassName="flex-col gap-2 py-4"
  >
    <Button
      className="w-full h-14 rounded-2xl text-base font-bold shadow-lg active:scale-[0.97] transition-transform"
      onClick={handleValidateSet}
    >
      <Check className="mr-2 h-5 w-5" />
      {currentLoggedSet ? "Série suivante" : "Valider série"}
    </Button>
    <button
      type="button"
      className="text-xs text-muted-foreground font-medium py-1 active:text-foreground transition-colors"
      onClick={() => advanceExercise()}
    >
      Passer cet exercice
    </button>
  </BottomActionBar>
) : null}
```

**Step 2: Make autoRest always true and remove toggle**

In WorkoutRunner, change the initial state (line 172):
```tsx
const [autoRest, setAutoRest] = useState(true);
```

Remove the Switch + "Auto repos" label from the card header (lines 766-769). Replace with just the series info:

```tsx
<div className="flex items-center justify-between mb-3">
  <div className="text-sm font-semibold">
    Série {currentSetIndex}/{formatStrengthValue(currentBlock?.sets)} · {formatStrengthValue(currentBlock?.reps)} reps
  </div>
  {restDuration > 0 && (
    <span className="text-xs text-muted-foreground">
      Repos {restDuration}s
    </span>
  )}
</div>
```

**Step 3: Remove unused imports**

Remove `Switch` from the imports (line 9), `Timer` from lucide imports (line 29).

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```
feat: simplify focus bottom bar — single validate button, always-on auto rest
```

---

## Task 6: Enriched full-screen rest timer

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`

**Step 1: Replace rest timer overlay**

Replace the entire `{isResting && (...)}` block (lines 854-947) with a new enriched timer:

```tsx
{isResting && (
  <div className="fixed inset-0 z-modal flex flex-col bg-background pb-[env(safe-area-inset-bottom)]">
    {/* Header */}
    <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
      <div className="text-sm font-semibold text-muted-foreground">
        {restType === "exercise" ? "Transition" : "Repos"}
      </div>
      <button
        type="button"
        className="rounded-full p-2 text-muted-foreground hover:bg-muted active:scale-95 transition-all"
        onClick={() => { setIsResting(false); setIsRestPaused(false); }}
        aria-label="Fermer"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    {/* Circular timer — tap to skip */}
    <button
      type="button"
      className="flex-1 flex flex-col items-center justify-center gap-2 px-6 active:opacity-80 transition-opacity"
      onClick={() => {
        restEndRef.current = 0;
        setIsResting(false);
        setRestTimer(0);
        setIsRestPaused(false);
      }}
      aria-label="Passer le repos"
    >
      <div className="relative">
        <svg className="h-52 w-52 -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
          <circle
            cx="100" cy="100" r="90" fill="none" stroke="currentColor"
            className="text-primary transition-all duration-1000"
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={restDuration ? 2 * Math.PI * 90 * (1 - restTimer / restDuration) : 0}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold tabular-nums tracking-tight">
            {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, "0")}
          </span>
          <span className="text-xs text-muted-foreground mt-1">tap pour passer</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full px-5 mt-2"
        onClick={(e) => {
          e.stopPropagation();
          restEndRef.current += 30 * 1000;
          setRestTimer((prev) => prev + 30);
        }}
      >
        +30s
      </Button>
    </button>

    {/* Next exercise card */}
    {(() => {
      const nextEx = restType === "exercise" ? nextExerciseDef : currentExerciseDef;
      const nextItem = restType === "exercise" ? nextBlock : currentBlock;
      if (!nextEx || !nextItem) return null;
      const noteText = exerciseNotes?.[nextEx.id];
      return (
        <div className="mx-5 mb-6 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {restType === "exercise" ? "Prochain exercice" : "Exercice en cours"}
          </div>
          <div className="flex items-center gap-3">
            {nextEx.illustration_gif ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-muted/20">
                <img
                  src={nextEx.illustration_gif}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted/20">
                <Dumbbell className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{nextEx.nom_exercice}</p>
              <p className="text-xs text-muted-foreground">
                {formatStrengthValue(nextItem.sets)}×{formatStrengthValue(nextItem.reps)}
                {nextItem.percent_1rm ? ` · ${formatStrengthValue(nextItem.percent_1rm)}% 1RM` : ""}
              </p>
              {noteText && (
                <p className="text-xs italic text-muted-foreground/70 truncate mt-0.5">{noteText}</p>
              )}
            </div>
          </div>
        </div>
      );
    })()}
  </div>
)}
```

**Step 2: Remove unused imports**

Remove `Pause`, `RotateCcw` from lucide imports if no longer used elsewhere.

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
feat: enriched rest timer with circular countdown and next exercise preview
```

---

## Task 7: Fix scroll in series overview sheet + compact cards

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`

**Step 1: Update series sheet for iOS scroll and compact layout**

Replace the series Sheet content (lines 978-1017) with:

```tsx
<Sheet open={seriesSheetOpen} onOpenChange={setSeriesSheetOpen}>
  <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
    <SheetHeader>
      <SheetTitle>Aperçu séance</SheetTitle>
    </SheetHeader>
    <div
      className="mt-4 space-y-2 overflow-y-auto overscroll-contain pb-8"
      style={{ maxHeight: "calc(80vh - 5rem)", WebkitOverflowScrolling: "touch" }}
    >
      {workoutPlan.map((item, index) => {
        const exercise = exercises.find((ex) => ex.id === item.exercise_id);
        const loggedSets = Array.from({ length: item.sets }).filter((_, setIndex) =>
          logLookup.get(`${item.exercise_id}-${setIndex + 1}`),
        ).length;
        const isActive = index === currentExerciseIndex;
        const isDone = loggedSets >= item.sets;
        return (
          <div
            key={`${item.exercise_id}-${index}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              isActive && "border-primary bg-primary/5",
              isDone && !isActive && "opacity-50",
            )}
          >
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              isDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {exercise?.nom_exercice ?? item.exercise_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatStrengthValue(item.sets)}×{formatStrengthValue(item.reps)}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0">
              {loggedSets}/{formatStrengthValue(item.sets)}
            </span>
          </div>
        );
      })}
    </div>
  </SheetContent>
</Sheet>
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```
fix: scrollable series overview with compact cards and active exercise highlight
```

---

## Task 8: Suppress save toasts in focus mode + connection indicator

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`
- Modify: `src/pages/Strength.tsx`

**Step 1: Add connection indicator to WorkoutRunner header**

Add a small indicator dot in the header bar of the focus mode (after the exit button area, line ~725). Use `navigator.onLine` + event listeners:

At the top of WorkoutRunner function body, add:
```tsx
const [isOnline, setIsOnline] = useState(navigator.onLine);
useEffect(() => {
  const on = () => setIsOnline(true);
  const off = () => setIsOnline(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}, []);
```

In the header (line ~670, inside the flex row with GIF + title + exit), add before the note button:
```tsx
<div className={cn(
  "h-2 w-2 shrink-0 rounded-full transition-colors",
  isOnline ? "bg-emerald-500" : "bg-red-500"
)} aria-label={isOnline ? "En ligne" : "Hors ligne"} />
```

**Step 2: Remove non-error toasts from focus-related mutations**

In `Strength.tsx`, for `logStrengthSet` mutation (lines 277-302) and `updateRun` mutation (lines 304-342):
- Remove `setSaveState("saving")` and `setSaveState("saved")` calls from `onMutate` and `onSuccess`
- Keep only `setSaveState("error")` in `onError`
- Remove `toast({ title: "Nouveau 1RM détecté" })` from logStrengthSet onSuccess (line 288) — or keep it since it's actually useful feedback. Keep it.

Actually, more targeted: only suppress the save state pill in BottomActionBar by not passing `saveState` to the focus mode BottomActionBar. In WorkoutRunner, the BottomActionBar doesn't receive `saveState` prop already — so just ensure the parent `Strength.tsx` doesn't show the floating save pill during focus. The save state is already not passed to WorkoutRunner's BottomActionBar, so this is already handled. The issue is the `BottomActionBar` in `SessionDetailPreview` — that one uses `saveState`. Leave that one.

The main fix: in `Strength.tsx`, wrap the `setSaveState` calls for `logStrengthSet` and `updateRun` mutations to only fire when NOT in focus mode:

```tsx
// In logStrengthSet.onMutate:
onMutate: () => {
  if (screenMode !== "focus") setSaveState("saving");
},
onSuccess: (data) => {
  if (screenMode !== "focus") {
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  }
  // ... keep 1RM toast
},
```

Same pattern for `updateRun` mutation — suppress saving/saved in focus mode.

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
feat: add connection indicator in focus mode, suppress save toasts during workout
```

---

## Task 9: Inline notes for exercises

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`

**Step 1: Replace note icon + sheet with inline editable field**

Remove the StickyNote button (lines 695-708) and the note Sheet at the bottom (lines 1212-1236).

Replace the inline notes display (lines 728-732) with an editable inline field:

```tsx
{/* Inline note field */}
{onUpdateNote && currentBlock && (
  <div className="-mt-1">
    <input
      type="text"
      value={exerciseNotes?.[currentBlock.exercise_id] ?? ""}
      onChange={(e) => onUpdateNote(currentBlock.exercise_id, e.target.value || null)}
      placeholder="Réglages machine, repères..."
      className="w-full bg-transparent text-xs italic text-muted-foreground placeholder:text-muted-foreground/40 border-none outline-none focus:text-foreground py-1"
    />
  </div>
)}
```

Add a debounce to avoid saving on every keystroke. Add at the top of the component:
```tsx
const noteTimerRef = useRef<ReturnType<typeof setTimeout>>();
const handleNoteChange = (exerciseId: number, value: string | null) => {
  clearTimeout(noteTimerRef.current);
  noteTimerRef.current = setTimeout(() => {
    onUpdateNote?.(exerciseId, value);
  }, 800);
};
```

Use `handleNoteChange` in the input onChange instead of direct `onUpdateNote`.

Also keep a local state for the note draft to make the input responsive:
```tsx
const [localNote, setLocalNote] = useState("");
```

Update `localNote` when `currentBlock` changes:
```tsx
useEffect(() => {
  if (currentBlock) {
    setLocalNote(exerciseNotes?.[currentBlock.exercise_id] ?? "");
  }
}, [currentBlock?.exercise_id, exerciseNotes]);
```

The input becomes:
```tsx
<input
  type="text"
  value={localNote}
  onChange={(e) => {
    setLocalNote(e.target.value);
    handleNoteChange(currentBlock.exercise_id, e.target.value || null);
  }}
  placeholder="Réglages machine, repères..."
  className="w-full bg-transparent text-xs italic text-muted-foreground placeholder:text-muted-foreground/40 border-none outline-none focus:text-foreground py-1"
/>
```

**Step 2: Remove unused state/imports**

Remove `noteSheetOpen`, `noteDraft` state variables. Remove `StickyNote` from lucide imports if no longer used.

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
feat: inline editable exercise notes with debounced save
```

---

## Task 10: Exercise Picker component

**Files:**
- Create: `src/components/strength/ExercisePicker.tsx`

**Step 1: Create the ExercisePicker component**

This is a reusable Sheet component for picking an exercise from the catalog:

```tsx
import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search, Dumbbell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/api";

interface ExercisePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  /** If provided, exercises matching this type are shown first */
  preferredType?: string | null;
  onSelect: (exercise: Exercise) => void;
  title?: string;
}

export function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  preferredType,
  onSelect,
  title = "Choisir un exercice",
}: ExercisePickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = exercises.filter((e) => e.exercise_type === "strength");
    if (q) {
      list = list.filter((e) =>
        (e.nom_exercice ?? "").toLowerCase().includes(q)
      );
    }
    // Sort: preferred type first
    if (preferredType) {
      list.sort((a, b) => {
        const aMatch = a.exercise_type === preferredType ? 0 : 1;
        const bMatch = b.exercise_type === preferredType ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return list;
  }, [exercises, search, preferredType]);

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSearch(""); }}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <Input
            placeholder="Rechercher..."
            className="h-10 rounded-xl bg-muted/30 pl-10 pr-4 border-0 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div
          className="mt-3 space-y-1 overflow-y-auto overscroll-contain pb-8"
          style={{ maxHeight: "calc(85vh - 8rem)", WebkitOverflowScrolling: "touch" }}
        >
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Aucun exercice trouvé</p>
          )}
          {filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 active:scale-[0.98]"
              onClick={() => { onSelect(exercise); onOpenChange(false); setSearch(""); }}
            >
              {exercise.illustration_gif ? (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted/20">
                  <img
                    src={exercise.illustration_gif}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
                  <Dumbbell className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{exercise.nom_exercice}</p>
                {exercise.description && (
                  <p className="text-xs text-muted-foreground truncate">{exercise.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```
feat: add ExercisePicker reusable component for exercise selection
```

---

## Task 11: Exercise substitution in Preview

**Files:**
- Modify: `src/components/strength/SessionDetailPreview.tsx`
- Modify: `src/pages/Strength.tsx`

**Step 1: Add substitution state and callbacks to Strength.tsx**

In `Strength.tsx`, add state to track substitutions:

```tsx
const [substitutions, setSubstitutions] = useState<Map<number, { originalIndex: number; exercise: Exercise }>>(new Map());
```

Add a handler:
```tsx
const handleSubstitute = (itemIndex: number, newExercise: Exercise) => {
  setSubstitutions((prev) => {
    const next = new Map(prev);
    next.set(itemIndex, { originalIndex: itemIndex, exercise: newExercise });
    return next;
  });
  // Update activeSession items with the new exercise_id
  setActiveSession((prev) => {
    if (!prev?.items) return prev;
    const items = [...prev.items];
    items[itemIndex] = { ...items[itemIndex], exercise_id: newExercise.id, exercise_name: newExercise.nom_exercice };
    return { ...prev, items };
  });
};
```

Pass to SessionDetailPreview:
```tsx
<SessionDetailPreview
  ...existing props
  exercises={exercises}
  substitutions={substitutions}
  onSubstitute={handleSubstitute}
/>
```

**Step 2: Add substitution UI to SessionDetailPreview**

Add props:
```tsx
substitutions?: Map<number, { originalIndex: number; exercise: Exercise }>;
onSubstitute?: (itemIndex: number, exercise: Exercise) => void;
```

Import `ExercisePicker`:
```tsx
import { ExercisePicker } from "@/components/strength/ExercisePicker";
```

Add state:
```tsx
const [pickerOpen, setPickerOpen] = useState(false);
const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
const [disclaimerShown, setDisclaimerShown] = useState(false);
const [disclaimerOpen, setDisclaimerOpen] = useState(false);
const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
```

Add a disclaimer gate function:
```tsx
const withDisclaimer = (action: () => void) => {
  if (disclaimerShown) { action(); return; }
  setPendingAction(() => action);
  setDisclaimerOpen(true);
};
```

On each exercise row, add a "Remplacer" button (small, after the chevron):
```tsx
{onSubstitute && (
  <button
    type="button"
    className="shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors px-2 py-1"
    onClick={(e) => {
      e.stopPropagation();
      withDisclaimer(() => { setPickerTargetIndex(index); setPickerOpen(true); });
    }}
  >
    Remplacer
  </button>
)}
```

Show badge "Modifié" if substitution exists:
```tsx
{substitutions?.has(index) && (
  <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
    Modifié
  </span>
)}
```

Add ExercisePicker and disclaimer dialog at the end of the component (before closing `</motion.div>`):
```tsx
<ExercisePicker
  open={pickerOpen}
  onOpenChange={setPickerOpen}
  exercises={exercises}
  onSelect={(exercise) => {
    if (pickerTargetIndex !== null && onSubstitute) {
      onSubstitute(pickerTargetIndex, exercise);
    }
    setPickerTargetIndex(null);
  }}
  title="Remplacer l'exercice"
/>

<AlertDialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Attention</AlertDialogTitle>
      <AlertDialogDescription>
        Toute modification se fait sous ta responsabilité. Le coach aura accès à la séance réelle effectuée. Des changements incohérents avec le travail demandé peuvent entraîner des risques de blessure ou une perte de performance.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setPendingAction(null)}>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={() => {
        setDisclaimerShown(true);
        setDisclaimerOpen(false);
        pendingAction?.();
        setPendingAction(null);
      }}>
        J'ai compris
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Add AlertDialog imports.

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
feat: exercise substitution in session preview with disclaimer
```

---

## Task 12: Add exercise from Preview

**Files:**
- Modify: `src/components/strength/SessionDetailPreview.tsx`
- Modify: `src/pages/Strength.tsx`

**Step 1: Add "add exercise" handler in Strength.tsx**

```tsx
const handleAddExercise = (exercise: Exercise) => {
  setActiveSession((prev) => {
    if (!prev) return prev;
    const newItem: StrengthSessionItem = {
      exercise_id: exercise.id,
      exercise_name: exercise.nom_exercice,
      order_index: (prev.items?.length ?? 0),
      sets: 3,
      reps: 10,
      rest_seconds: 90,
      percent_1rm: 0,
      cycle_type: cycleType,
    };
    return { ...prev, items: [...(prev.items ?? []), newItem] };
  });
};
```

Pass to SessionDetailPreview:
```tsx
onAddExercise={handleAddExercise}
```

**Step 2: Add button and picker in SessionDetailPreview**

Add prop:
```tsx
onAddExercise?: (exercise: Exercise) => void;
```

Add state:
```tsx
const [addPickerOpen, setAddPickerOpen] = useState(false);
```

After the exercise list (after `items.length === 0` empty state), before the BottomActionBar:
```tsx
{onAddExercise && (
  <button
    type="button"
    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors active:scale-[0.98]"
    onClick={() => withDisclaimer(() => setAddPickerOpen(true))}
  >
    + Ajouter un exercice
  </button>
)}

<ExercisePicker
  open={addPickerOpen}
  onOpenChange={setAddPickerOpen}
  exercises={exercises}
  onSelect={(exercise) => onAddExercise?.(exercise)}
  title="Ajouter un exercice"
/>
```

Show "Ajouté" badge on added items (items beyond original count). Pass `originalItemCount` prop:

In `Strength.tsx`, track original count:
```tsx
const [originalItemCount, setOriginalItemCount] = useState(0);
// Set when entering reader mode:
// In startAssignment and startCatalogSession, add:
setOriginalItemCount(items.length);
```

Pass to preview:
```tsx
originalItemCount={originalItemCount}
```

In preview, show badge for items at index >= originalItemCount:
```tsx
{index >= (originalItemCount ?? items.length) && (
  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
    Ajouté
  </span>
)}
```

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
feat: add exercise from session preview with disclaimer gate
```

---

## Task 13: "Continue" from completion screen

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`

**Step 1: Add "continue" state and button to completion screen**

Add state:
```tsx
const [isContinuing, setIsContinuing] = useState(false);
const [continuePickerOpen, setContinuePickerOpen] = useState(false);
```

Add prop to WorkoutRunner:
```tsx
onAddExercise?: (exercise: Exercise) => void;
```

In the completion screen (`if (currentStep > workoutPlan.length)` block), before the difficulty section, add:

```tsx
<div className="border-t pt-4">
  <Button
    variant="outline"
    className="w-full rounded-2xl h-12"
    onClick={() => setContinuePickerOpen(true)}
  >
    + Continuer — ajouter des exercices
  </Button>
</div>

<ExercisePicker
  open={continuePickerOpen}
  onOpenChange={setContinuePickerOpen}
  exercises={exercises}
  onSelect={(exercise) => {
    onAddExercise?.(exercise);
    // Go back to the newly added exercise
    const newStep = workoutPlan.length + 1;
    // The parent will re-render with updated items, so workoutPlan.length will increase
    // We need to reset hasCelebrated so we don't re-confetti
    setHasCelebrated(false);
    updateStep(newStep);
  }}
  title="Ajouter un exercice"
/>
```

In `Strength.tsx`, pass `onAddExercise` to WorkoutRunner:
```tsx
onAddExercise={(exercise) => {
  handleAddExercise(exercise);
  // Update activeFilteredItems will happen via useMemo re-computation
}}
```

Note: Since `activeFilteredItems` is derived from `activeSession.items`, and `handleAddExercise` updates `activeSession`, the WorkoutRunner will re-render with the new item in `workoutPlan`.

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```
feat: add "continue with more exercises" option from completion screen
```

---

## Task 14: Exercise substitution in focus mode

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`

**Step 1: Add substitution in focus mode header**

Add state:
```tsx
const [substitutePickerOpen, setSubstitutePickerOpen] = useState(false);
const [focusDisclaimerShown, setFocusDisclaimerShown] = useState(false);
const [focusDisclaimerOpen, setFocusDisclaimerOpen] = useState(false);
const [focusPendingAction, setFocusPendingAction] = useState<(() => void) | null>(null);
```

Add disclaimer gate:
```tsx
const withFocusDisclaimer = (action: () => void) => {
  if (focusDisclaimerShown) { action(); return; }
  setFocusPendingAction(() => action);
  setFocusDisclaimerOpen(true);
};
```

Add prop:
```tsx
onSubstitute?: (itemIndex: number, exercise: Exercise) => void;
```

Replace the exit button area (lines 709-725) to include a dropdown menu with "Remplacer" and "Quitter":

```tsx
<div className="flex items-center gap-1 shrink-0">
  {onSubstitute && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => withFocusDisclaimer(() => setSubstitutePickerOpen(true))}
      aria-label="Remplacer l'exercice"
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  )}
  {onExitFocus && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => {
        if (logs.length > 0) { setExitConfirmOpen(true); } else { onExitFocus(); }
      }}
      aria-label="Quitter"
    >
      <X className="h-4 w-4" />
    </Button>
  )}
</div>
```

Add ExercisePicker and disclaimer dialog before the closing `</div>` of the main return:

```tsx
{onSubstitute && (
  <ExercisePicker
    open={substitutePickerOpen}
    onOpenChange={setSubstitutePickerOpen}
    exercises={exercises}
    onSelect={(exercise) => {
      onSubstitute(currentExerciseIndex, exercise);
    }}
    title="Remplacer l'exercice"
  />
)}

<AlertDialog open={focusDisclaimerOpen} onOpenChange={setFocusDisclaimerOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Attention</AlertDialogTitle>
      <AlertDialogDescription>
        Toute modification se fait sous ta responsabilité. Le coach aura accès à la séance réelle effectuée.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setFocusPendingAction(null)}>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={() => {
        setFocusDisclaimerShown(true);
        setFocusDisclaimerOpen(false);
        focusPendingAction?.();
        setFocusPendingAction(null);
      }}>
        J'ai compris
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

In `Strength.tsx`, pass `onSubstitute` to WorkoutRunner:
```tsx
onSubstitute={handleSubstitute}
```

**Step 2: Re-add RotateCcw import** (it was removed in Task 6)

Add back `RotateCcw` to lucide imports.

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```
feat: exercise substitution in focus mode with disclaimer
```

---

## Task 15: GIF optimization

**Files:**
- Modify: `src/components/strength/WorkoutRunner.tsx`
- Modify: `src/components/strength/SessionDetailPreview.tsx`

**Step 1: Add loading placeholder for GIFs**

In WorkoutRunner, for the header GIF thumbnail (line 680-691), wrap in a container with placeholder:

```tsx
<button
  type="button"
  aria-label="Voir l'animation de l'exercice"
  onClick={() => { if (currentExerciseDef?.illustration_gif) setIsGifOpen(true); }}
  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/30 shadow-sm"
>
  {currentExerciseDef?.illustration_gif ? (
    <img
      src={currentExerciseDef.illustration_gif}
      alt=""
      className="h-full w-full object-cover"
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  ) : (
    <Dumbbell className="h-5 w-5 text-muted-foreground" />
  )}
</button>
```

**Step 2: Preload next exercise GIF**

In WorkoutRunner, add a preload effect:
```tsx
useEffect(() => {
  if (nextExerciseDef?.illustration_gif) {
    const img = new Image();
    img.src = nextExerciseDef.illustration_gif;
  }
}, [nextExerciseDef?.illustration_gif]);
```

**Step 3: Add fetchPriority="low" to non-visible GIFs**

In `SessionDetailPreview.tsx`, the GIF in the Sheet detail:
```tsx
<img
  src={exercise.illustration_gif}
  ...
  loading="lazy"
  decoding="async"
  fetchPriority="low"
/>
```

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```
perf: preload next exercise GIF and optimize loading priorities
```

---

## Task 16: Final integration test + type check

**Files:** None (verification only)

**Step 1: Full type check**

Run: `npx tsc --noEmit`

**Step 2: Run tests**

Run: `npm test`

**Step 3: Dev server smoke test**

Run: `npm run dev` — verify on localhost:8080:
- Navigate to Muscu tab
- Select a cycle, pick a session
- Verify cycle banner in preview
- Verify bottom bar styling with rounded corners
- Launch session → lands on exercise 1 (no step 0)
- Validate a set → auto rest timer with circular countdown
- Check series overview scrolls
- Check connection indicator dot
- Test exercise substitution (disclaimer appears first time)
- Test add exercise from preview
- Complete session, test "Continue" button

**Step 4: Commit all remaining fixes**

```
chore: final cleanup and integration verification
```

---

## Task 17: Update documentation

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CLAUDE.md`

**Step 1: Add implementation log entry**

Add a new section in `docs/implementation-log.md` documenting all 10 changes with files modified.

**Step 2: Update ROADMAP**

Add a new entry (§89 or next number) marking this chantier as "Fait".

**Step 3: Update CLAUDE.md**

Add `ExercisePicker.tsx` to the key files table.

**Step 4: Commit**

```
docs: add strength UX overhaul to implementation log and roadmap
```

# Coach Swimmer Detail Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated coach page per swimmer with tabs for Ressentis (session feedback history), Objectifs (CRUD), and placeholders for Planification & Entretiens.

**Architecture:** New route `/#/coach/swimmer/:id` with a `CoachSwimmerDetail` page component. Uses Shadcn Tabs. `handleOpenAthlete` navigates here instead of `/progress`. Athlete context passed via Zustand `selectedAthlete` (persisted in localStorage) with URL param as fallback. Reuses existing API functions and extracts `ObjectiveFormSheet` from `CoachObjectivesScreen`.

**Tech Stack:** React, TypeScript, Tailwind, Wouter (hash routing), Radix Tabs (Shadcn), React Query, Supabase

**Design doc:** `docs/plans/2026-02-28-coach-swimmer-detail-design.md`

---

### Task 1: Add route and page shell

**Files:**
- Create: `src/pages/coach/CoachSwimmerDetail.tsx`
- Modify: `src/App.tsx:235-254` (add route)
- Modify: `src/pages/Coach.tsx:435-438` (change handleOpenAthlete navigation target)

**Step 1: Create `src/pages/coach/CoachSwimmerDetail.tsx`**

This is the page shell with header and tabs structure. It reads the athlete ID from the URL param, gets the athlete name from the auth store, and fetches the profile for avatar/group info.

```typescript
import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Target, CalendarRange, MessageSquare } from "lucide-react";

export default function CoachSwimmerDetail() {
  const [, params] = useRoute("/coach/swimmer/:id");
  const [, navigate] = useLocation();
  const { selectedAthleteId, selectedAthleteName } = useAuth();

  const athleteId = params?.id ? Number(params.id) : selectedAthleteId;
  const athleteName = selectedAthleteName;

  const { data: profile } = useQuery({
    queryKey: ["profile", athleteId],
    queryFn: () => api.getProfile({ userId: athleteId }),
    enabled: athleteId != null,
  });

  const displayName = profile?.display_name ?? athleteName ?? "Nageur";
  const avatarUrl = profile?.avatar_url ?? null;
  const groupLabel = profile?.group_label ?? null;

  if (!athleteId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Aucun nageur sélectionné.</p>
        <button type="button" onClick={() => navigate("/coach")} className="mt-2 text-primary underline">
          Retour au dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/coach")}
          className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate">{displayName}</h1>
          {groupLabel && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {groupLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ressentis">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="ressentis" className="text-xs gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ressentis</span>
          </TabsTrigger>
          <TabsTrigger value="objectifs" className="text-xs gap-1">
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Objectifs</span>
          </TabsTrigger>
          <TabsTrigger value="planification" className="text-xs gap-1">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Planif.</span>
          </TabsTrigger>
          <TabsTrigger value="entretiens" className="text-xs gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Entretiens</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ressentis" className="mt-4">
          <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
        </TabsContent>

        <TabsContent value="objectifs" className="mt-4">
          <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
        </TabsContent>

        <TabsContent value="planification" className="mt-4">
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <CalendarRange className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Bientôt disponible</p>
            <p className="text-xs text-muted-foreground mt-1">Macro-cycles (blocs entre compétitions) et micro-cycles (semaines typées).</p>
          </div>
        </TabsContent>

        <TabsContent value="entretiens" className="mt-4">
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Bientôt disponible</p>
            <p className="text-xs text-muted-foreground mt-1">Comptes-rendus structurés d'entretiens individuels avec liens vers objectifs et planification.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Add route in `src/App.tsx`**

Find the `<Switch>` block (around line 235). Add the new route BEFORE the `/coach` route (more specific routes must come first in Wouter):

```typescript
<Route path="/coach/swimmer/:id" component={CoachSwimmerDetail} />
```

Also add the lazy import at the top with the other lazy imports:
```typescript
const CoachSwimmerDetail = lazy(() => import("./pages/coach/CoachSwimmerDetail"));
```

**Step 3: Update `handleOpenAthlete` in `src/pages/Coach.tsx:435-438`**

Change from:
```typescript
const handleOpenAthlete = (athlete: { id: number | null; display_name: string }) => {
  setSelectedAthlete({ id: athlete.id ?? null, name: athlete.display_name });
  navigate("/progress");
};
```
To:
```typescript
const handleOpenAthlete = (athlete: { id: number | null; display_name: string }) => {
  setSelectedAthlete({ id: athlete.id ?? null, name: athlete.display_name });
  navigate(athlete.id != null ? `/coach/swimmer/${athlete.id}` : "/progress");
};
```

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/pages/coach/CoachSwimmerDetail.tsx src/App.tsx src/pages/Coach.tsx
git commit -m "feat: add coach swimmer detail page shell with tabs"
```

---

### Task 2: SwimmerFeedbackTab — Ressentis list

**Files:**
- Create: `src/pages/coach/SwimmerFeedbackTab.tsx`
- Modify: `src/pages/coach/CoachSwimmerDetail.tsx` (wire tab)

**Step 1: Create `src/pages/coach/SwimmerFeedbackTab.tsx`**

This component fetches sessions for a given athlete and displays them as a chronological list.

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ChevronDown } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const INDICATORS = [
  { key: "effort" as const, label: "Diff.", mode: "hard" as const },
  { key: "feeling" as const, label: "Fat.", mode: "hard" as const },
  { key: "performance" as const, label: "Perf", mode: "good" as const },
  { key: "engagement" as const, label: "Eng.", mode: "good" as const },
];

function indicatorColor(mode: "hard" | "good", value: number | null | undefined): string {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 1 || v > 5) return "bg-muted text-muted-foreground";
  // For "hard" indicators (difficulty, fatigue): 1=good(green), 5=bad(red)
  // For "good" indicators (performance, engagement): 1=bad(red), 5=good(green)
  const effective = mode === "hard" ? 6 - v : v;
  if (effective >= 4) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (effective >= 3) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

interface Props {
  athleteId: number;
  athleteName: string;
}

export default function SwimmerFeedbackTab({ athleteId, athleteName }: Props) {
  const [limit, setLimit] = useState(20);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", athleteId],
    queryFn: () => api.getSessions(athleteName, athleteId),
  });

  const displayed = sessions.slice(0, limit);
  const hasMore = sessions.length > limit;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-3 animate-pulse motion-reduce:animate-none">
            <div className="h-4 w-32 rounded bg-muted mb-2" />
            <div className="h-3 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun ressenti enregistré.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map((session) => {
        const isExpanded = expandedId === session.id;
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => setExpandedId(isExpanded ? null : session.id)}
            className="w-full rounded-2xl border bg-card p-3 text-left hover:border-primary/20 transition-all"
          >
            {/* Row 1: date + slot + indicators */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-foreground">
                  {new Date(session.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">{session.slot}</span>
              </div>
              <div className="flex items-center gap-1">
                {INDICATORS.map((ind) => {
                  const value = session[ind.key] as number | null | undefined;
                  return (
                    <span
                      key={ind.key}
                      title={`${ind.label}: ${value ?? "—"}`}
                      className={cn(
                        "inline-flex items-center justify-center h-6 w-6 rounded-lg text-[10px] font-bold",
                        indicatorColor(ind.mode, value)
                      )}
                    >
                      {value ?? "—"}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Row 2: distance + expand hint */}
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">
                {session.distance > 0 ? `${session.distance}m` : "—"}
              </span>
              {session.comments && (
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
              )}
            </div>

            {/* Expanded: comment */}
            {isExpanded && session.comments && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-foreground whitespace-pre-wrap">{session.comments}</p>
              </div>
            )}
          </button>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setLimit((l) => l + 20); }}
          className="w-full rounded-2xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition"
        >
          Charger plus ({sessions.length - limit} restants)
        </button>
      )}
    </div>
  );
}
```

**Step 2: Wire into CoachSwimmerDetail**

In `CoachSwimmerDetail.tsx`, replace the ressentis TabsContent placeholder with:

```typescript
import SwimmerFeedbackTab from "./SwimmerFeedbackTab";

// In the ressentis TabsContent:
<TabsContent value="ressentis" className="mt-4">
  <SwimmerFeedbackTab athleteId={athleteId} athleteName={displayName} />
</TabsContent>
```

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/pages/coach/SwimmerFeedbackTab.tsx src/pages/coach/CoachSwimmerDetail.tsx
git commit -m "feat: add SwimmerFeedbackTab with session history list"
```

---

### Task 3: SwimmerObjectivesTab — Objectives CRUD

**Files:**
- Create: `src/pages/coach/SwimmerObjectivesTab.tsx`
- Modify: `src/pages/coach/CoachSwimmerDetail.tsx` (wire tab)

**Step 1: Create `src/pages/coach/SwimmerObjectivesTab.tsx`**

This component manages objectives for a single athlete. It reuses the CRUD pattern from `CoachObjectivesScreen` but scoped to one athlete.

Key approach:
- Fetch the athlete's `auth_uid` from supabase (needed because `objectives.athlete_id` is the auth UUID, not `public.users.id`)
- Fetch objectives filtered by that auth UUID
- Render list + create/edit/delete with a sheet form

Read `src/pages/coach/CoachObjectivesScreen.tsx` carefully to understand:
- The `ObjectiveFormSheet` component (lines 77-412) — extract its logic
- The athlete auth UUID lookup pattern (lines 490-494)
- The mutations pattern (lines 123-154)
- The objectives list rendering (lines 520-656)

The component should:
1. Take `athleteId: number` and `athleteName: string` as props
2. Query `users` table to get `auth_id` for this athlete (same pattern as CoachObjectivesScreen line 490-494)
3. Fetch objectives via `api.getObjectives(authUid)`
4. Fetch competitions via `api.getCompetitions()` for the competition picker
5. Render a list of objectives with edit/delete buttons
6. Sheet form for create/edit with: type toggle (chrono/texte/both), event code, pool length, target time, text, competition link

IMPORTANT: Copy the exact form structure from `CoachObjectivesScreen.ObjectiveFormSheet` — do NOT redesign it. The form fields, validation, and mutation logic should be identical.

**Step 2: Wire into CoachSwimmerDetail**

```typescript
import SwimmerObjectivesTab from "./SwimmerObjectivesTab";

// In the objectifs TabsContent:
<TabsContent value="objectifs" className="mt-4">
  <SwimmerObjectivesTab athleteId={athleteId} athleteName={displayName} />
</TabsContent>
```

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/pages/coach/SwimmerObjectivesTab.tsx src/pages/coach/CoachSwimmerDetail.tsx
git commit -m "feat: add SwimmerObjectivesTab with CRUD objectives"
```

---

### Task 4: Build verification and documentation

**Step 1: Full verification**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass

**Step 2: Update documentation**

- `docs/implementation-log.md` — add §73 entry
- `CLAUDE.md` — add `CoachSwimmerDetail.tsx`, `SwimmerFeedbackTab.tsx`, `SwimmerObjectivesTab.tsx` to key files table + add chantier §73

**Step 3: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add coach swimmer detail page to implementation log"
```

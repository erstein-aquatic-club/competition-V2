# Coach Events Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous `CoachEventsTimeline` component that displays upcoming competitions, pending interviews, and cycle endings in a unified chronological timeline.

**Architecture:** Hook-based approach (`useCoachEventsTimeline`) fetching 3 data sources in parallel via React Query, normalizing into `TimelineEvent[]`, consumed by a pure UI component. New `getAllPendingInterviews()` API function with join on users table.

**Tech Stack:** React 19, TypeScript, React Query 5, Tailwind CSS 4, Shadcn UI (Badge, ToggleGroup, Select, Skeleton), Lucide icons, Vitest for tests.

---

### Task 1: Add `getAllPendingInterviews()` API function

**Files:**
- Modify: `src/lib/api/interviews.ts` (append new export)
- Modify: `src/lib/api/index.ts:236-246` (add re-export)
- Modify: `src/lib/api.ts:232-234` (add import alias) and `src/lib/api.ts:676-685` (add delegation stub)

**Step 1: Add the function to interviews.ts**

Append at the end of `src/lib/api/interviews.ts`:

```typescript
/** Coach: get all interviews not yet signed, with athlete display_name */
export async function getAllPendingInterviews(): Promise<
  (Interview & { athlete_name: string })[]
> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase
    .from("interviews")
    .select("*, athlete:users!athlete_id(display_name)")
    .neq("status", "signed")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    athlete_name: row.athlete?.display_name ?? "?",
    athlete: undefined,
  }));
}
```

**Step 2: Add re-export in index.ts**

In `src/lib/api/index.ts`, in the interviews export block (line ~236), add `getAllPendingInterviews`:

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
  getPreviousInterview,
  getAllPendingInterviews,
} from './interviews';
```

**Step 3: Wire up in api.ts facade**

In `src/lib/api.ts`, add import alias alongside the other interview imports (~line 232):

```typescript
  getAllPendingInterviews as _getAllPendingInterviews,
```

And add delegation stub after `getPreviousInterview` (~line 685):

```typescript
  async getAllPendingInterviews() { return _getAllPendingInterviews(); },
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to `getAllPendingInterviews`

**Step 5: Commit**

```bash
git add src/lib/api/interviews.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat(api): add getAllPendingInterviews for coach timeline"
```

---

### Task 2: Create `TimelineEvent` types and `useCoachEventsTimeline` hook

**Files:**
- Create: `src/hooks/useCoachEventsTimeline.ts`

**Step 1: Write the hook file**

Create `src/hooks/useCoachEventsTimeline.ts`:

```typescript
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCompetitions } from "@/lib/api/competitions";
import { getAllPendingInterviews } from "@/lib/api/interviews";
import { getTrainingCycles } from "@/lib/api/planning";

// ── Types ────────────────────────────────────────────────────

export type EventType = "competition" | "interview" | "cycle_end";
export type EventUrgency = "overdue" | "imminent" | "upcoming" | "future";

export interface TimelineEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  subtitle?: string;
  athleteName?: string;
  athleteId?: number;
  urgency: EventUrgency;
  metadata: Record<string, unknown>;
}

// ── Pure helpers (exported for testing) ──────────────────────

const INTERVIEW_STATUS_LABELS: Record<string, string> = {
  draft_athlete: "En attente nageur",
  draft_coach: "En attente coach",
  sent: "Envoyé, à signer",
};

export function computeUrgency(dateStr: string, today: string): EventUrgency {
  const d = new Date(dateStr);
  const t = new Date(today);
  const diffMs = d.getTime() - t.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "imminent";
  if (diffDays <= 30) return "upcoming";
  return "future";
}

export function normalizeCompetitions(
  competitions: Awaited<ReturnType<typeof getCompetitions>>,
  today: string,
): TimelineEvent[] {
  return competitions.map((c) => ({
    id: `comp-${c.id}`,
    type: "competition" as const,
    date: c.date,
    title: c.name,
    subtitle: c.location ?? undefined,
    urgency: computeUrgency(c.date, today),
    metadata: { ...c },
  }));
}

export function normalizeInterviews(
  interviews: Awaited<ReturnType<typeof getAllPendingInterviews>>,
  today: string,
): TimelineEvent[] {
  return interviews.map((i) => ({
    id: `intv-${i.id}`,
    type: "interview" as const,
    date: i.date,
    title: `Entretien : ${i.athlete_name}`,
    subtitle: INTERVIEW_STATUS_LABELS[i.status] ?? i.status,
    athleteName: i.athlete_name,
    athleteId: i.athlete_id,
    urgency: computeUrgency(i.date, today),
    metadata: { ...i },
  }));
}

export function normalizeCycleEnds(
  cycles: Awaited<ReturnType<typeof getTrainingCycles>>,
  today: string,
): TimelineEvent[] {
  return cycles
    .filter((c) => c.end_competition_date != null)
    .map((c) => ({
      id: `cycle-${c.id}`,
      type: "cycle_end" as const,
      date: c.end_competition_date!,
      title: `Fin cycle : ${c.name}`,
      subtitle: c.end_competition_name ?? undefined,
      athleteId: c.athlete_id ?? undefined,
      urgency: computeUrgency(c.end_competition_date!, today),
      metadata: { ...c },
    }));
}

export function mergeAndSort(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function filterByType(
  events: TimelineEvent[],
  typeFilter: EventType | "all",
): TimelineEvent[] {
  if (typeFilter === "all") return events;
  return events.filter((e) => e.type === typeFilter);
}

export function filterByPeriod(
  events: TimelineEvent[],
  periodDays: number,
  today: string,
): TimelineEvent[] {
  if (periodDays === 0) return events;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + periodDays);
  return events.filter((e) => new Date(e.date) <= cutoff);
}

// ── Hook ─────────────────────────────────────────────────────

export function useCoachEventsTimeline() {
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [periodDays, setPeriodDays] = useState<number>(30);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const competitionsQ = useQuery({
    queryKey: ["coach-events-competitions"],
    queryFn: getCompetitions,
  });

  const interviewsQ = useQuery({
    queryKey: ["coach-events-interviews"],
    queryFn: getAllPendingInterviews,
  });

  const cyclesQ = useQuery({
    queryKey: ["coach-events-cycles"],
    queryFn: () => getTrainingCycles(),
  });

  const isLoading =
    competitionsQ.isLoading || interviewsQ.isLoading || cyclesQ.isLoading;

  const allEvents = useMemo(() => {
    const comps = normalizeCompetitions(competitionsQ.data ?? [], today);
    const intvs = normalizeInterviews(interviewsQ.data ?? [], today);
    const cycles = normalizeCycleEnds(cyclesQ.data ?? [], today);
    return mergeAndSort([...comps, ...intvs, ...cycles]);
  }, [competitionsQ.data, interviewsQ.data, cyclesQ.data, today]);

  const events = useMemo(() => {
    let filtered = filterByType(allEvents, typeFilter);
    filtered = filterByPeriod(filtered, periodDays, today);
    return filtered;
  }, [allEvents, typeFilter, periodDays, today]);

  const counts = useMemo(() => {
    const c = { competition: 0, interview: 0, cycle_end: 0, total: 0 };
    for (const e of allEvents) {
      c[e.type]++;
      c.total++;
    }
    return c;
  }, [allEvents]);

  return {
    events,
    isLoading,
    typeFilter,
    setTypeFilter,
    periodDays,
    setPeriodDays,
    counts,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/hooks/useCoachEventsTimeline.ts
git commit -m "feat: add useCoachEventsTimeline hook with pure normalizers"
```

---

### Task 3: Write tests for hook pure functions

**Files:**
- Create: `src/hooks/__tests__/useCoachEventsTimeline.test.ts`

**Step 1: Write the test file**

Create `src/hooks/__tests__/useCoachEventsTimeline.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  computeUrgency,
  normalizeCompetitions,
  normalizeInterviews,
  normalizeCycleEnds,
  mergeAndSort,
  filterByType,
  filterByPeriod,
} from "../useCoachEventsTimeline";
import type { TimelineEvent } from "../useCoachEventsTimeline";

const TODAY = "2026-03-01";

describe("computeUrgency", () => {
  it("returns overdue for past dates", () => {
    expect(computeUrgency("2026-02-28", TODAY)).toBe("overdue");
  });
  it("returns imminent for ≤7 days", () => {
    expect(computeUrgency("2026-03-05", TODAY)).toBe("imminent");
  });
  it("returns upcoming for ≤30 days", () => {
    expect(computeUrgency("2026-03-20", TODAY)).toBe("upcoming");
  });
  it("returns future for >30 days", () => {
    expect(computeUrgency("2026-06-01", TODAY)).toBe("future");
  });
  it("returns imminent for today", () => {
    expect(computeUrgency("2026-03-01", TODAY)).toBe("imminent");
  });
});

describe("normalizeCompetitions", () => {
  it("maps a competition to TimelineEvent", () => {
    const comps = [
      { id: "c1", name: "Régionaux", date: "2026-03-15", location: "Strasbourg", end_date: null, description: null, created_by: null, created_at: null },
    ];
    const result = normalizeCompetitions(comps, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("comp-c1");
    expect(result[0].type).toBe("competition");
    expect(result[0].title).toBe("Régionaux");
    expect(result[0].subtitle).toBe("Strasbourg");
    expect(result[0].urgency).toBe("upcoming");
  });
  it("returns empty array for empty input", () => {
    expect(normalizeCompetitions([], TODAY)).toEqual([]);
  });
});

describe("normalizeInterviews", () => {
  it("maps a pending interview to TimelineEvent", () => {
    const intvs = [
      { id: "i1", athlete_id: 42, status: "draft_athlete" as const, date: "2026-03-05", athlete_name: "Léa Martin", athlete_successes: null, athlete_difficulties: null, athlete_goals: null, athlete_commitments: null, coach_review: null, coach_objectives: null, coach_actions: null, coach_comment_successes: null, coach_comment_difficulties: null, coach_comment_goals: null, athlete_commitment_review: null, current_cycle_id: null, submitted_at: null, sent_at: null, signed_at: null, created_by: null, created_at: null },
    ];
    const result = normalizeInterviews(intvs, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("intv-i1");
    expect(result[0].type).toBe("interview");
    expect(result[0].title).toBe("Entretien : Léa Martin");
    expect(result[0].subtitle).toBe("En attente nageur");
    expect(result[0].athleteName).toBe("Léa Martin");
    expect(result[0].athleteId).toBe(42);
  });
});

describe("normalizeCycleEnds", () => {
  it("maps a cycle with end_competition_date to TimelineEvent", () => {
    const cycles = [
      { id: "cy1", name: "Prépa Régionaux", end_competition_date: "2026-04-10", end_competition_name: "Championnats", athlete_id: 5, group_id: null, start_competition_id: null, end_competition_id: "c2", start_date: null, notes: null, created_by: null, created_at: null, start_competition_name: null, start_competition_date: null },
    ];
    const result = normalizeCycleEnds(cycles, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cycle-cy1");
    expect(result[0].type).toBe("cycle_end");
    expect(result[0].title).toBe("Fin cycle : Prépa Régionaux");
    expect(result[0].subtitle).toBe("Championnats");
    expect(result[0].urgency).toBe("future");
  });
  it("skips cycles without end_competition_date", () => {
    const cycles = [
      { id: "cy2", name: "Test", end_competition_date: null, end_competition_name: null, athlete_id: null, group_id: null, start_competition_id: null, end_competition_id: "c3", start_date: null, notes: null, created_by: null, created_at: null, start_competition_name: null, start_competition_date: null },
    ];
    expect(normalizeCycleEnds(cycles, TODAY)).toEqual([]);
  });
});

describe("mergeAndSort", () => {
  it("sorts events by date ascending", () => {
    const events: TimelineEvent[] = [
      { id: "a", type: "competition", date: "2026-04-01", title: "A", urgency: "future", metadata: {} },
      { id: "b", type: "interview", date: "2026-03-01", title: "B", urgency: "imminent", metadata: {} },
      { id: "c", type: "cycle_end", date: "2026-03-15", title: "C", urgency: "upcoming", metadata: {} },
    ];
    const sorted = mergeAndSort(events);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });
  it("returns empty for empty input", () => {
    expect(mergeAndSort([])).toEqual([]);
  });
});

describe("filterByType", () => {
  const events: TimelineEvent[] = [
    { id: "1", type: "competition", date: "2026-03-01", title: "A", urgency: "imminent", metadata: {} },
    { id: "2", type: "interview", date: "2026-03-01", title: "B", urgency: "imminent", metadata: {} },
    { id: "3", type: "cycle_end", date: "2026-03-01", title: "C", urgency: "imminent", metadata: {} },
  ];

  it("returns all for 'all' filter", () => {
    expect(filterByType(events, "all")).toHaveLength(3);
  });
  it("filters by competition", () => {
    const filtered = filterByType(events, "competition");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });
  it("filters by interview", () => {
    expect(filterByType(events, "interview")).toHaveLength(1);
  });
});

describe("filterByPeriod", () => {
  const events: TimelineEvent[] = [
    { id: "1", type: "competition", date: "2026-03-05", title: "A", urgency: "imminent", metadata: {} },
    { id: "2", type: "competition", date: "2026-04-15", title: "B", urgency: "future", metadata: {} },
    { id: "3", type: "competition", date: "2026-06-01", title: "C", urgency: "future", metadata: {} },
  ];

  it("returns all when periodDays=0", () => {
    expect(filterByPeriod(events, 0, TODAY)).toHaveLength(3);
  });
  it("filters to 7 days", () => {
    expect(filterByPeriod(events, 7, TODAY)).toHaveLength(1);
  });
  it("filters to 30 days", () => {
    expect(filterByPeriod(events, 30, TODAY)).toHaveLength(1);
  });
  it("filters to 90 days", () => {
    expect(filterByPeriod(events, 90, TODAY)).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useCoachEventsTimeline.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/hooks/__tests__/useCoachEventsTimeline.test.ts
git commit -m "test: add pure function tests for useCoachEventsTimeline"
```

---

### Task 4: Create `CoachEventsTimeline` UI component

**Files:**
- Create: `src/components/coach/CoachEventsTimeline.tsx`

**Dependencies to know about:**
- Shadcn components live in `src/components/ui/` — use existing Badge, ToggleGroup (check if exists, else use button group), Select, Skeleton
- Icons from `lucide-react`
- Hook from Task 2

**Step 1: Check which Shadcn components are available**

Run: `ls src/components/ui/ | grep -E "badge|toggle|select|skeleton"`
Expected: Files should exist for badge, select, skeleton. ToggleGroup may or may not exist.

**Step 2: Create the component**

Create `src/components/coach/CoachEventsTimeline.tsx`:

```tsx
import { Calendar, Trophy, MessageSquare, RotateCcw, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCoachEventsTimeline,
  type EventType,
  type EventUrgency,
  type TimelineEvent,
} from "@/hooks/useCoachEventsTimeline";

// ── Config ───────────────────────────────────────────────────

const TYPE_CONFIG: Record<EventType, { icon: typeof Calendar; label: string; dotColor: string; borderColor: string }> = {
  competition: { icon: Trophy, label: "Compétition", dotColor: "bg-blue-500", borderColor: "border-blue-200 dark:border-blue-800" },
  interview: { icon: MessageSquare, label: "Entretien", dotColor: "bg-amber-500", borderColor: "border-amber-200 dark:border-amber-800" },
  cycle_end: { icon: RotateCcw, label: "Fin de cycle", dotColor: "bg-violet-500", borderColor: "border-violet-200 dark:border-violet-800" },
};

const URGENCY_CONFIG: Record<EventUrgency, { label: string; className: string }> = {
  overdue: { label: "En retard", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  imminent: { label: "Imminent", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  upcoming: { label: "À venir", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  future: { label: "Futur", className: "bg-muted text-muted-foreground" },
};

const PERIOD_OPTIONS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "0", label: "Tout" },
];

const TYPE_FILTER_OPTIONS: Array<{ value: EventType | "all"; label: string }> = [
  { value: "all", label: "Tout" },
  { value: "competition", label: "Compétitions" },
  { value: "interview", label: "Entretiens" },
  { value: "cycle_end", label: "Cycles" },
];

// ── Sub-components ───────────────────────────────────────────

function TimelineItem({ event }: { event: TimelineEvent }) {
  const cfg = TYPE_CONFIG[event.type];
  const urgCfg = URGENCY_CONFIG[event.urgency];
  const Icon = cfg.icon;

  const dateFormatted = new Date(event.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {/* Dot on the timeline */}
      <div className="relative flex flex-col items-center">
        <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.dotColor} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Card */}
      <div className={`flex-1 rounded-lg border ${cfg.borderColor} bg-card p-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
            {event.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{event.subtitle}</p>
            )}
          </div>
          <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 ${urgCfg.className}`}>
            {urgCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{dateFormatted}</p>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse motion-reduce:animate-none">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export function CoachEventsTimeline() {
  const {
    events,
    isLoading,
    typeFilter,
    setTypeFilter,
    periodDays,
    setPeriodDays,
    counts,
  } = useCoachEventsTimeline();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Échéances</h2>
        <span className="text-xs text-muted-foreground">{counts.total} événement{counts.total !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex gap-1">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  typeFilter === opt.value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {opt.label}
                {opt.value !== "all" && counts[opt.value as EventType] > 0 && (
                  <span className="ml-1 opacity-60">{counts[opt.value as EventType]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <Select
          value={String(periodDays)}
          onValueChange={(v) => setPeriodDays(Number(v))}
        >
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline body */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune échéance à venir</p>
        </div>
      ) : (
        <div className="relative ml-4 border-l-2 border-border pl-0">
          {events.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/components/coach/CoachEventsTimeline.tsx
git commit -m "feat: add CoachEventsTimeline UI component with vertical timeline"
```

---

### Task 5: Run `/frontend-design` on CoachEventsTimeline for premium polish

**Step 1: Invoke the frontend-design skill**

Run the `/frontend-design` slash command on `src/components/coach/CoachEventsTimeline.tsx` to apply premium design treatment: timeline verticale de type chronologie, look premium mobile-first.

**Step 2: Apply design changes from the skill output**

Follow the skill's recommendations to refine spacing, colors, animations, and visual polish.

**Step 3: Verify it compiles and looks good**

Run: `npx tsc --noEmit 2>&1 | head -20`
Run: `npm run dev` and visually check the component in isolation.

**Step 4: Commit**

```bash
git add src/components/coach/CoachEventsTimeline.tsx
git commit -m "style: apply frontend-design polish to CoachEventsTimeline"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `docs/implementation-log.md` (append §84 entry)
- Modify: `docs/FEATURES_STATUS.md` (add timeline feature)
- Modify: `docs/ROADMAP.md` (update chantier status)
- Modify: `CLAUDE.md` (add new files to key files table)

**Step 1: Add implementation log entry**

Append to `docs/implementation-log.md`:

```markdown
## §84 — Coach Events Timeline (Tableau de Bord des Échéances)

**Date :** 2026-03-01
**Contexte :** Composant autonome consolidant les échéances du coach (compétitions, entretiens, fins de cycles) dans une timeline verticale chronologique.

**Changements :**
- `src/lib/api/interviews.ts` — Ajout `getAllPendingInterviews()` (join users pour athlete_name, filtre status != signed)
- `src/lib/api/index.ts` — Re-export getAllPendingInterviews
- `src/lib/api.ts` — Delegation stub getAllPendingInterviews
- `src/hooks/useCoachEventsTimeline.ts` — Hook: 3 useQuery parallèles, normalisation TimelineEvent[], filtres type/période, calcul urgency
- `src/components/coach/CoachEventsTimeline.tsx` — UI timeline verticale premium (points colorés, badges urgency, skeleton, empty state)
- `src/hooks/__tests__/useCoachEventsTimeline.test.ts` — Tests purs: computeUrgency, normalizers, merge, filters

**Fichiers modifiés :** 6 fichiers
**Tests :** ~15 tests (normalisation, tri, filtres, urgency, cas limites)
**Décisions :** Approche hook + composant pur (cohérent avec useCoachCalendarState pattern). Pas de RPC/vue SQL pour ce MVP.
**Limites :** Brique autonome, pas encore intégrée dans Coach.tsx.
```

**Step 2: Update CLAUDE.md key files table**

Add to the key files table in `CLAUDE.md`:

```markdown
| `src/hooks/useCoachEventsTimeline.ts` | Hook timeline échéances coach (fetch + normalisation) | ~130 lignes |
| `src/components/coach/CoachEventsTimeline.tsx` | Timeline verticale échéances coach (compétitions, entretiens, cycles) | ~180 lignes |
```

**Step 3: Commit documentation**

```bash
git add docs/implementation-log.md docs/FEATURES_STATUS.md docs/ROADMAP.md CLAUDE.md
git commit -m "docs: add §84 Coach Events Timeline implementation log"
```

---

## Summary

| Task | Description | Files | Est. |
|------|------------|-------|------|
| 1 | API `getAllPendingInterviews()` | 3 modify | 3 min |
| 2 | Hook `useCoachEventsTimeline` | 1 create | 5 min |
| 3 | Tests pure functions | 1 create | 5 min |
| 4 | UI `CoachEventsTimeline` | 1 create | 8 min |
| 5 | `/frontend-design` polish | 1 modify | 10 min |
| 6 | Documentation | 4 modify | 3 min |

**Total: 6 tasks, ~34 minutes**

Tasks 1-3 can be parallelized (API + Hook can be written together, tests validate the hook).
Task 4 depends on Task 2.
Task 5 depends on Task 4.
Task 6 can run in parallel with Task 5.

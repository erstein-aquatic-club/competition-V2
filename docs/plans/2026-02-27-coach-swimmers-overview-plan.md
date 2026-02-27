# Coach Swimmers Overview Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the basic coach "Nageurs" list with a dashboard of swimmer cards showing forme, assiduité, and objectifs KPIs.

**Architecture:** New `CoachSwimmersOverview` component replaces inline JSX in Coach.tsx. A new bulk API function fetches recent sessions for all athletes. KPIs are computed client-side from existing data (dim_sessions, objectives). AthleteSummary type is extended with `avatar_url`.

**Tech Stack:** React, TypeScript, Tailwind, React Query, Supabase

**Design doc:** `docs/plans/2026-02-27-coach-swimmers-overview-design.md`

---

### Task 1: Extend AthleteSummary with avatar_url

**Files:**
- Modify: `src/lib/api/types.ts:164-171`
- Modify: `src/lib/api/users.ts:100-170`

**Step 1: Add `avatar_url` to the AthleteSummary interface**

In `src/lib/api/types.ts`, add `avatar_url` to the existing interface:

```typescript
export interface AthleteSummary {
  id: number | null;
  display_name: string;
  email?: string | null;
  group_id?: number | null;
  group_label?: string | null;
  ffn_iuf?: string | null;
  avatar_url?: string | null;  // NEW
}
```

**Step 2: Fetch avatar_url in getAthletes()**

In `src/lib/api/users.ts`, the `getAthletes()` function already queries `user_profiles` for `ffn_iuf`. Extend the select to also fetch `avatar_url`:

Line ~130-133, change:
```typescript
const { data: profiles } = await supabase
  .from("user_profiles")
  .select("user_id, ffn_iuf");
const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
```
To:
```typescript
const { data: profiles } = await supabase
  .from("user_profiles")
  .select("user_id, ffn_iuf, avatar_url");
const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
```

Then add `avatar_url` in both mapping paths:
- Line ~143 (no groups path): add `avatar_url: profileMap.get(u.id)?.avatar_url ?? null`
- Line ~158-165 (groups path): add `avatar_url: profileMap.get(userId)?.avatar_url ?? null`

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/lib/api/types.ts src/lib/api/users.ts
git commit -m "feat: add avatar_url to AthleteSummary"
```

---

### Task 2: Add bulk recent sessions API function

**Files:**
- Modify: `src/lib/api/users.ts` (add function)
- Modify: `src/lib/api/index.ts` (re-export)
- Modify: `src/lib/api.ts` (delegation stub)

**Step 1: Create `getRecentSessionsAllAthletes()` in `src/lib/api/users.ts`**

Add at the end of the file, before the closing. This queries `dim_sessions` for the last 30 days across all athletes:

```typescript
export async function getRecentSessionsAllAthletes(days = 30): Promise<
  Array<{
    athlete_id: number | null;
    athlete_name: string;
    session_date: string;
    effort: number | null;
    performance: number | null;
    engagement: number | null;
    fatigue: number | null;
  }>
> {
  if (!canUseSupabase()) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("dim_sessions")
    .select("athlete_id, athlete_name, session_date, rpe, performance, engagement, fatigue")
    .gte("session_date", sinceISO)
    .order("session_date", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    athlete_id: row.athlete_id ? safeInt(row.athlete_id) : null,
    athlete_name: String(row.athlete_name ?? ""),
    session_date: String(row.session_date ?? ""),
    effort: safeOptionalInt(row.rpe),
    performance: safeOptionalInt(row.performance),
    engagement: safeOptionalInt(row.engagement),
    fatigue: safeOptionalInt(row.fatigue),
  }));
}
```

Note: We use `rpe` (mapped from `effort` on write) and `fatigue` (mapped from `feeling` on write) as stored in the DB. These correspond to the 4 indicators the nageur fills: difficulté→rpe, fatigue_end→fatigue, performance→performance, engagement→engagement.

**Step 2: Re-export in `src/lib/api/index.ts`**

Add to the users imports:
```typescript
import { getRecentSessionsAllAthletes as _getRecentSessionsAllAthletes } from './users';
```

And re-export it.

**Step 3: Add delegation stub in `src/lib/api.ts`**

In the Users delegation stubs section (~line 615), add:
```typescript
async getRecentSessionsAllAthletes(days?: number) { return _getRecentSessionsAllAthletes(days); },
```

Also add the import alias at the top of `api.ts`.

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/lib/api/users.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add getRecentSessionsAllAthletes bulk API"
```

---

### Task 3: Create CoachSwimmersOverview component

**Files:**
- Create: `src/pages/coach/CoachSwimmersOverview.tsx`

**Step 1: Create the component with data fetching, KPI computation, and card grid**

This is the main component. It:
1. Receives `athletes` (already fetched by Coach.tsx) and `athletesLoading` as props
2. Fetches recent sessions and objectives via React Query
3. Computes KPIs per athlete
4. Renders a filter bar (group chips + sort selector) + card grid

```typescript
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import type { AthleteSummary, Objective } from "@/lib/api/types";
import CoachSectionHeader from "./CoachSectionHeader";

// --- Types ---

type SortKey = "name" | "forme" | "assiduity";

interface AthleteKPIs {
  forme: number | null;        // 1-5 scale (higher = better)
  lastSessionDate: string | null;
  sessionsCount30d: number;
  assiduity: number | null;    // 0-100 percentage
  objectivesTotal: number;
  objectivesAchieved: number;  // those with target_time_seconds AND competition past
}

// --- Helpers ---

function computeFormeScore(sessions: Array<{
  effort: number | null;
  performance: number | null;
  engagement: number | null;
  fatigue: number | null;
}>): number | null {
  if (sessions.length === 0) return null;
  // Take the most recent session (already sorted desc)
  const last = sessions[0];
  const effort = last.effort;
  const fatigue = last.fatigue;
  const perf = last.performance;
  const engagement = last.engagement;
  // All values are stored on a 1-10 scale in DB (expandScaleToTen on write)
  // Invert effort and fatigue (high = bad), normalize to 1-5
  const values: number[] = [];
  if (effort != null) values.push((11 - effort) / 2);     // 10→0.5, 1→5
  if (fatigue != null) values.push((11 - fatigue) / 2);
  if (perf != null) values.push(perf / 2);                 // 10→5, 1→0.5
  if (engagement != null) values.push(engagement / 2);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function formeBadge(score: number | null): { label: string; className: string } {
  if (score == null) return { label: "—", className: "bg-muted text-muted-foreground" };
  if (score >= 3.5) return { label: `${score.toFixed(1)}`, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (score >= 2.5) return { label: `${score.toFixed(1)}`, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: `${score.toFixed(1)}`, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
}

// --- Component ---

interface Props {
  athletes: AthleteSummary[];
  athletesLoading: boolean;
  onBack: () => void;
  onOpenAthlete: (athlete: AthleteSummary) => void;
}

export default function CoachSwimmersOverview({ athletes, athletesLoading, onBack, onOpenAthlete }: Props) {
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");

  // Fetch recent sessions (30 days)
  const { data: recentSessions = [] } = useQuery({
    queryKey: ["recent-sessions-all", 30],
    queryFn: () => api.getRecentSessionsAllAthletes(30),
    enabled: athletes.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all objectives
  const { data: allObjectives = [] } = useQuery({
    queryKey: ["objectives-all"],
    queryFn: () => api.getObjectives(),
    enabled: athletes.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Group list for filter chips
  const groups = useMemo(() => {
    const map = new Map<number, string>();
    athletes.forEach((a) => {
      if (a.group_id && a.group_label) map.set(a.group_id, a.group_label);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [athletes]);

  // Compute KPIs per athlete
  const athleteKPIs = useMemo(() => {
    const kpiMap = new Map<number, AthleteKPIs>();

    // Index sessions by athlete_id
    const sessionsByAthleteId = new Map<number, typeof recentSessions>();
    for (const s of recentSessions) {
      if (s.athlete_id == null) continue;
      const list = sessionsByAthleteId.get(s.athlete_id) ?? [];
      list.push(s);
      sessionsByAthleteId.set(s.athlete_id, list);
    }

    // Index objectives by athlete_id (auth UUID → need to match via athlete_name)
    // objectives.athlete_id is auth UUID, but athletes.id is public.users.id
    // We'll match objectives by athlete_name instead
    const objectivesByName = new Map<string, Objective[]>();
    for (const obj of allObjectives) {
      const name = obj.athlete_name?.toLowerCase() ?? "";
      if (!name) continue;
      const list = objectivesByName.get(name) ?? [];
      list.push(obj);
      objectivesByName.set(name, list);
    }

    for (const athlete of athletes) {
      if (athlete.id == null) continue;
      const sessions = sessionsByAthleteId.get(athlete.id) ?? [];
      const objectives = objectivesByName.get(athlete.display_name.toLowerCase()) ?? [];

      const forme = computeFormeScore(sessions);
      const lastSessionDate = sessions.length > 0 ? sessions[0].session_date : null;

      kpiMap.set(athlete.id, {
        forme,
        lastSessionDate,
        sessionsCount30d: sessions.length,
        assiduity: null, // V1: we show session count, not % (requires assignment data)
        objectivesTotal: objectives.length,
        objectivesAchieved: 0, // Simplified: count is enough for V1
      });
    }
    return kpiMap;
  }, [athletes, recentSessions, allObjectives]);

  // Filter + sort
  const sortedAthletes = useMemo(() => {
    let list = [...athletes];
    if (groupFilter != null) {
      list = list.filter((a) => a.group_id === groupFilter);
    }
    switch (sortKey) {
      case "forme":
        list.sort((a, b) => {
          const fa = a.id != null ? (athleteKPIs.get(a.id)?.forme ?? 99) : 99;
          const fb = b.id != null ? (athleteKPIs.get(b.id)?.forme ?? 99) : 99;
          return fa - fb; // lowest forme first (needs attention)
        });
        break;
      case "assiduity":
        list.sort((a, b) => {
          const sa = a.id != null ? (athleteKPIs.get(a.id)?.sessionsCount30d ?? 99) : 99;
          const sb = b.id != null ? (athleteKPIs.get(b.id)?.sessionsCount30d ?? 99) : 99;
          return sa - sb; // least sessions first
        });
        break;
      default: // name
        list.sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"));
    }
    return list;
  }, [athletes, groupFilter, sortKey, athleteKPIs]);

  // --- Render ---

  return (
    <div className="space-y-4">
      <CoachSectionHeader
        title="Nageurs"
        description={
          athletesLoading
            ? "Chargement…"
            : `${athletes.length} nageur${athletes.length !== 1 ? "s" : ""}`
        }
        onBack={onBack}
      />

      {/* Filters */}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGroupFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
              groupFilter == null
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            Tous
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                groupFilter === g.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Trier :</span>
        {([
          { key: "name" as const, label: "Nom" },
          { key: "forme" as const, label: "Forme" },
          { key: "assiduity" as const, label: "Activité" },
        ]).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortKey(opt.key)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition ${
              sortKey === opt.key
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {athletesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-4 animate-pulse motion-reduce:animate-none">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedAthletes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {groupFilter != null ? "Aucun nageur dans ce groupe." : "Aucun nageur disponible."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedAthletes.map((athlete) => {
            const kpis = athlete.id != null ? athleteKPIs.get(athlete.id) : null;
            const forme = formeBadge(kpis?.forme ?? null);

            return (
              <button
                key={athlete.id ?? athlete.display_name}
                type="button"
                onClick={() => onOpenAthlete(athlete)}
                className="rounded-2xl border bg-card p-4 text-left hover:shadow-md hover:border-primary/20 transition-all"
              >
                {/* Header: avatar + name + group */}
                <div className="flex items-center gap-3">
                  {athlete.avatar_url ? (
                    <img
                      src={athlete.avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {athlete.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{athlete.display_name}</p>
                    {athlete.group_label && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5">
                        {athlete.group_label}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* KPIs */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {/* Forme */}
                  <div className="text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1">Forme</div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${forme.className}`}>
                      {forme.label}
                    </span>
                  </div>

                  {/* Activité (session count 30d) */}
                  <div className="text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1">30j</div>
                    <span className="text-sm font-bold text-foreground">
                      {kpis?.sessionsCount30d ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">séances</span>
                  </div>

                  {/* Objectifs */}
                  <div className="text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1">Objectifs</div>
                    <span className="text-sm font-bold text-foreground">
                      {kpis?.objectivesTotal ?? 0}
                    </span>
                  </div>
                </div>

                {/* Last session date */}
                {kpis?.lastSessionDate && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Dernier ressenti : {new Date(kpis.lastSessionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/pages/coach/CoachSwimmersOverview.tsx
git commit -m "feat: create CoachSwimmersOverview dashboard component"
```

---

### Task 4: Wire into Coach.tsx

**Files:**
- Modify: `src/pages/Coach.tsx`

**Step 1: Import the new component**

Add near the other coach imports (~line 14-22):
```typescript
import CoachSwimmersOverview from "./coach/CoachSwimmersOverview";
```

**Step 2: Replace the swimmers section**

In Coach.tsx, find the block `{activeSection === "swimmers" ? (` (line ~544) through its closing `} : null}` (line ~616).

Replace the entire block with:
```typescript
{activeSection === "swimmers" ? (
  <CoachSwimmersOverview
    athletes={athletes}
    athletesLoading={athletesLoading}
    onBack={() => setActiveSection("home")}
    onOpenAthlete={handleOpenAthlete}
  />
) : null}
```

**Step 3: Type check + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: both pass

**Step 4: Commit**

```bash
git add src/pages/Coach.tsx
git commit -m "feat: wire CoachSwimmersOverview into coach dashboard"
```

---

### Task 5: Verify and finalize

**Step 1: Full build verification**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors, build succeeds

**Step 2: Manual smoke test checklist**

- [ ] Coach navigates to "Nageurs" → grid of cards loads
- [ ] Each card shows: name, avatar/initial, group badge, forme, 30j sessions, objectifs
- [ ] Group filter chips work (filter list)
- [ ] Sort buttons work (nom, forme, activité)
- [ ] Clicking a card opens the athlete's progress page
- [ ] Loading state shows skeleton cards
- [ ] Empty state shows appropriate message
- [ ] Mobile: 1 column, Desktop: 2-3 columns

**Step 3: Update documentation**

Update `docs/implementation-log.md` with the implementation entry.
Update `docs/ROADMAP.md` with the new chantier status.
Update `CLAUDE.md` if new key files were added.

**Step 4: Final commit**

```bash
git add docs/
git commit -m "docs: add coach swimmers overview to implementation log"
```

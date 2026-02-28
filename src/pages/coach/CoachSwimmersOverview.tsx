import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import type { AthleteSummary } from "@/lib/api/types";
import CoachSectionHeader from "./CoachSectionHeader";

// --- Types ---

type SortKey = "name" | "forme" | "assiduity";

interface AthleteKPIs {
  forme: number | null;
  lastSessionDate: string | null;
  sessionsCount30d: number;
  assiduity: number | null;
  objectivesTotal: number;
  objectivesAchieved: number;
}

// --- Helpers ---

function computeFormeScore(sessions: Array<{
  effort: number | null;
  performance: number | null;
  engagement: number | null;
  fatigue: number | null;
}>): number | null {
  if (sessions.length === 0) return null;
  const last = sessions[0];
  const effort = last.effort;
  const fatigue = last.fatigue;
  const perf = last.performance;
  const engagement = last.engagement;
  // Values are stored on a 1-10 scale in DB (expandScaleToTen on write)
  // Invert effort and fatigue (high = bad), normalize to 1-5
  const values: number[] = [];
  if (effort != null) values.push((11 - effort) / 2);
  if (fatigue != null) values.push((11 - fatigue) / 2);
  if (perf != null) values.push(perf / 2);
  if (engagement != null) values.push(engagement / 2);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function formeBadge(score: number | null): { label: string; className: string } {
  if (score == null) return { label: "\u2014", className: "bg-muted text-muted-foreground" };
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

  const { data: recentSessions = [] } = useQuery({
    queryKey: ["recent-sessions-all", 30],
    queryFn: () => api.getRecentSessionsAllAthletes(30),
    enabled: athletes.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: objectiveCounts } = useQuery({
    queryKey: ["objectives-counts-by-user"],
    queryFn: () => api.getObjectivesCountsByUser(),
    enabled: athletes.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const groups = useMemo(() => {
    const map = new Map<number, string>();
    athletes.forEach((a) => {
      if (a.group_id && a.group_label) map.set(a.group_id, a.group_label);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [athletes]);

  const athleteKPIs = useMemo(() => {
    const kpiMap = new Map<number, AthleteKPIs>();
    const sessionsByAthleteId = new Map<number, typeof recentSessions>();
    for (const s of recentSessions) {
      if (s.athlete_id == null) continue;
      const list = sessionsByAthleteId.get(s.athlete_id) ?? [];
      list.push(s);
      sessionsByAthleteId.set(s.athlete_id, list);
    }
    for (const athlete of athletes) {
      if (athlete.id == null) continue;
      const sessions = sessionsByAthleteId.get(athlete.id) ?? [];
      const forme = computeFormeScore(sessions);
      const lastSessionDate = sessions.length > 0 ? sessions[0].session_date : null;
      kpiMap.set(athlete.id, {
        forme,
        lastSessionDate,
        sessionsCount30d: sessions.length,
        assiduity: null,
        objectivesTotal: objectiveCounts?.get(athlete.id) ?? 0,
        objectivesAchieved: 0,
      });
    }
    return kpiMap;
  }, [athletes, recentSessions, objectiveCounts]);

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
          return fa - fb;
        });
        break;
      case "assiduity":
        list.sort((a, b) => {
          const sa = a.id != null ? (athleteKPIs.get(a.id)?.sessionsCount30d ?? 99) : 99;
          const sb = b.id != null ? (athleteKPIs.get(b.id)?.sessionsCount30d ?? 99) : 99;
          return sa - sb;
        });
        break;
      default:
        list.sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"));
    }
    return list;
  }, [athletes, groupFilter, sortKey, athleteKPIs]);

  return (
    <div className="space-y-4">
      <CoachSectionHeader
        title="Nageurs"
        description={
          athletesLoading
            ? "Chargement\u2026"
            : `${athletes.length} nageur${athletes.length !== 1 ? "s" : ""}`
        }
        onBack={onBack}
      />

      {/* Group filter chips */}
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

      {/* Sort buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Trier :</span>
        {([
          { key: "name" as const, label: "Nom" },
          { key: "forme" as const, label: "Forme" },
          { key: "assiduity" as const, label: "Activit\u00e9" },
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

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1">Forme</div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${forme.className}`}>
                      {forme.label}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1">30j</div>
                    <span className="text-sm font-bold text-foreground">
                      {kpis?.sessionsCount30d ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">séances</span>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1">Objectifs</div>
                    <span className="text-sm font-bold text-foreground">
                      {kpis?.objectivesTotal ?? 0}
                    </span>
                  </div>
                </div>

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

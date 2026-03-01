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

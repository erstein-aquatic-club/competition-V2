import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TrainingWeek } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SwimmerFeedbackTab from "@/pages/coach/SwimmerFeedbackTab";
import AthleteInterviewsSection from "./AthleteInterviewsSection";
import SwimmerObjectivesView from "./SwimmerObjectivesView";
import { weekTypeColor, weekTypeTextColor } from "@/lib/weekTypeColor";
import {
  ArrowLeft,
  CalendarRange,
  Clock,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

interface Props {
  athleteId: number;
  athleteName: string;
  groupLabel?: string | null;
  onBack: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function getSunday(mondayIso: string): string {
  const d = new Date(mondayIso + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

function isCurrentWeek(mondayIso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(mondayIso + "T00:00:00");
  const sunday = new Date(mondayIso + "T00:00:00");
  sunday.setDate(sunday.getDate() + 6);
  return today >= monday && today <= sunday;
}

function getMondays(startDate: string, endDate: string): string[] {
  const mondays: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const current = new Date(start);
  const day = current.getDay();
  const diffToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  current.setDate(current.getDate() + diffToMonday);
  while (current <= end) {
    mondays.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 7);
  }
  return mondays;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00");
  const b = new Date(dateB + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function AthleteSeasonPlanning({ athleteId }: { athleteId: number }) {
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  const { data: assignedIds = [] } = useQuery({
    queryKey: ["my-competition-ids", athleteId],
    queryFn: () => api.getMyCompetitionIds(athleteId),
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["training-cycles", "athlete", athleteId],
    queryFn: () => api.getTrainingCycles({ athleteId }),
  });

  const upcomingCompetitions = useMemo(() => {
    const assignedSet = new Set(assignedIds);
    return competitions
      .filter((competition) => assignedSet.has(competition.id) && competition.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [assignedIds, competitions, todayIso]);

  const cyclesByCompetitionId = useMemo(() => {
    const map = new Map<string, (typeof cycles)[number]>();
    cycles
      .slice()
      .sort((a, b) => (a.end_competition_date ?? "").localeCompare(b.end_competition_date ?? ""))
      .forEach((cycle) => {
        if (cycle.end_competition_id && !map.has(cycle.end_competition_id)) {
          map.set(cycle.end_competition_id, cycle);
        }
      });
    return map;
  }, [cycles]);

  const plannedCycles = useMemo(() => {
    const seen = new Set<string>();
    return upcomingCompetitions
      .map((competition) => cyclesByCompetitionId.get(competition.id) ?? null)
      .filter((cycle): cycle is NonNullable<typeof cycle> => {
        if (!cycle || seen.has(cycle.id)) return false;
        seen.add(cycle.id);
        return true;
      });
  }, [cyclesByCompetitionId, upcomingCompetitions]);

  const weekQueries = useQueries({
    queries: plannedCycles.map((cycle) => ({
      queryKey: ["training-weeks", cycle.id],
      queryFn: () => api.getTrainingWeeks(cycle.id),
      enabled: !!cycle.id,
    })),
  });

  const weeksByCycleId = useMemo(() => {
    const map = new Map<string, TrainingWeek[]>();
    plannedCycles.forEach((cycle, index) => {
      map.set(cycle.id, (weekQueries[index]?.data as TrainingWeek[] | undefined) ?? []);
    });
    return map;
  }, [plannedCycles, weekQueries]);

  const nextCompetition = upcomingCompetitions[0] ?? null;

  if (upcomingCompetitions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-card/70 px-4 py-8 text-center">
        <CalendarRange className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">Aucune échéance assignée pour le moment.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dès qu&apos;une compétition est ciblée, le macrocycle apparaîtra ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border bg-gradient-to-br from-primary/[0.08] via-background to-amber-500/[0.08] p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {upcomingCompetitions.length} échéance{upcomingCompetitions.length > 1 ? "s" : ""} à l&apos;horizon
          </span>
          {nextCompetition && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
              prochaine J-{daysBetween(todayIso, nextCompetition.date)}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Vision multi-macrocycles: chaque échéance garde son cap, même si le cycle n&apos;est pas encore détaillé.
        </p>
      </div>

      <div className="space-y-3">
        {upcomingCompetitions.map((competition, compIndex) => {
          const cycle = cyclesByCompetitionId.get(competition.id) ?? null;
          const cycleStart = cycle?.start_date ?? cycle?.start_competition_date ?? todayIso;
          const visibleStart = cycleStart > todayIso ? cycleStart : todayIso;
          const visibleMondays = cycle ? getMondays(visibleStart, competition.date) : [];
          const totalMondays = cycle ? getMondays(cycleStart, competition.date) : [];
          const hiddenWeeks = Math.max(totalMondays.length - visibleMondays.length, 0);
          const cycleWeeks = cycle ? (weeksByCycleId.get(cycle.id) ?? []) : [];
          const weeksByStart = new Map(cycleWeeks.map((week) => [week.week_start, week]));
          const daysUntil = daysBetween(todayIso, competition.date);

          return (
            <section key={competition.id} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
              <div className="border-b border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{competition.name}</span>
                  {compIndex === 0 && (
                    <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary">
                      Priorité
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {formatDate(competition.date)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    J-{daysUntil}
                  </Badge>
                </div>
                {cycle ? (
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{cycle.name}</span>
                    {cycle.start_competition_name && (
                      <span>depuis {cycle.start_competition_name}</span>
                    )}
                    <span>{totalMondays.length} sem.</span>
                    {hiddenWeeks > 0 && (
                      <span>{hiddenWeeks} déjà écoulée{hiddenWeeks > 1 ? "s" : ""}</span>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aucun macrocycle détaillé pour cette échéance.
                  </p>
                )}
              </div>

              {!cycle ? (
                <div className="px-4 py-4 text-xs text-muted-foreground italic">
                  La compétition reste visible pour garder une projection saison complète.
                </div>
              ) : visibleMondays.length === 0 ? (
                <div className="px-4 py-4 text-xs text-muted-foreground italic">
                  Aucune semaine future à afficher sur ce macrocycle.
                </div>
              ) : (
                <div className="px-4 py-4">
                  <div className="relative ml-2 space-y-2 border-l-2 border-border pl-4">
                    {visibleMondays.map((monday, index) => {
                      const week = weeksByStart.get(monday);
                      const current = isCurrentWeek(monday);
                      const sunday = getSunday(monday);

                      return (
                        <div
                          key={monday}
                          className={`rounded-2xl border bg-card px-3 py-2 text-xs ${
                            current ? "ring-2 ring-primary/40 bg-primary/[0.04]" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                current
                                  ? "bg-primary"
                                  : week?.week_type
                                    ? "bg-muted-foreground/40"
                                    : "bg-muted-foreground/20"
                              }`}
                            />
                            <span className="whitespace-nowrap text-muted-foreground">
                              Sem. {hiddenWeeks + index + 1}
                            </span>
                            <span className="whitespace-nowrap text-muted-foreground/70">
                              {fmtShort(monday)} - {fmtShort(sunday)}
                            </span>
                            {week?.week_type && (
                              <Badge
                                className="ml-auto border-0 px-1.5 py-0 text-[10px]"
                                style={{
                                  backgroundColor: weekTypeColor(week.week_type),
                                  color: weekTypeTextColor(week.week_type),
                                }}
                              >
                                {week.week_type}
                              </Badge>
                            )}
                          </div>
                          {week?.notes && (
                            <p className="mt-1 pl-4 text-[11px] text-muted-foreground line-clamp-2">
                              {week.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function AthletePerformanceHub({
  athleteId,
  athleteName,
  groupLabel,
  onBack,
}: Props) {
  const [, navigate] = useLocation();

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <div className="rounded-[1.75rem] border bg-gradient-to-br from-primary/[0.12] via-background to-amber-500/[0.08] p-4 shadow-sm">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-semibold uppercase italic text-foreground">
                Suivi saison
              </h1>
              <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary">
                Vue nageur
              </Badge>
              {groupLabel && (
                <Badge variant="secondary" className="text-[10px]">
                  {groupLabel}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {athleteName}: ressenti, objectifs, macrocycles et entretiens regroupés dans un seul espace.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="ressentis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 rounded-2xl">
          <TabsTrigger value="ressentis" className="gap-1 text-xs">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ressentis</span>
          </TabsTrigger>
          <TabsTrigger value="objectifs" className="gap-1 text-xs">
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Objectifs</span>
          </TabsTrigger>
          <TabsTrigger value="planification" className="gap-1 text-xs">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Planif.</span>
          </TabsTrigger>
          <TabsTrigger value="entretiens" className="gap-1 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Entretiens</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ressentis" className="mt-0">
          <SwimmerFeedbackTab
            athleteId={athleteId}
            athleteName={athleteName}
            onOpenProgression={() => navigate("/progress")}
          />
        </TabsContent>

        <TabsContent value="objectifs" className="mt-0">
          <SwimmerObjectivesView embedded />
        </TabsContent>

        <TabsContent value="planification" className="mt-0">
          <AthleteSeasonPlanning athleteId={athleteId} />
        </TabsContent>

        <TabsContent value="entretiens" className="mt-0">
          <AthleteInterviewsSection embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

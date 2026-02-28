import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellRing, CalendarDays, ChevronRight, Clock, Dumbbell, HeartPulse, Search, Trophy, Users, UsersRound, Waves } from "lucide-react";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Input } from "@/components/ui/input";
import CoachSectionHeader from "./coach/CoachSectionHeader";
const CoachSwimmersOverview = lazy(() => import("./coach/CoachSwimmersOverview"));
const CoachMessagesScreen = lazy(() => import("./coach/CoachMessagesScreen"));
const CoachSmsScreen = lazy(() => import("./coach/CoachSmsScreen"));
const CoachCalendar = lazy(() => import("./coach/CoachCalendar"));
const CoachGroupsScreen = lazy(() => import("./coach/CoachGroupsScreen"));
const CoachCompetitionsScreen = lazy(() => import("./coach/CoachCompetitionsScreen"));
const CoachObjectivesScreen = lazy(() => import("./coach/CoachObjectivesScreen"));
const CoachTrainingSlotsScreen = lazy(() => import("./coach/CoachTrainingSlotsScreen"));
const CoachSwimmerDetail = lazy(() => import("./coach/CoachSwimmerDetail"));
import ComingSoon from "./ComingSoon";
import { FEATURES } from "@/lib/features";
import type { LocalStrengthRun } from "@/lib/types";

// Lazy load heavy catalog components
const StrengthCatalog = lazy(() => import("./coach/StrengthCatalog"));
const SwimCatalog = lazy(() => import("./coach/SwimCatalog"));

type CoachSection = "home" | "swim" | "strength" | "swimmers" | "messaging" | "sms" | "calendar" | "groups" | "competitions" | "objectives" | "training-slots" | "athlete";
type KpiLookbackPeriod = 7 | 30 | 365;

type CoachAthleteOption = {
  id: number | null;
  display_name: string;
  group_label?: string | null;
};

type CoachHomeProps = {
  onNavigate: (section: CoachSection) => void;
  onOpenRecordsAdmin: () => void;
  onOpenRecordsClub: () => void;
  onOpenAthlete: (athlete: CoachAthleteOption) => void;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null; ffn_iuf?: string | null }>;
  athletesLoading: boolean;
  kpiLoading: boolean;
  fatigueAlerts: Array<{ athleteName: string; rating: number }>;
  mostLoadedAthlete?: { athleteName: string; loadScore: number } | null;
  swimSessionCount?: number;
  strengthSessionCount?: number;
};

const CoachHome = ({
  onNavigate,
  onOpenRecordsAdmin,
  onOpenRecordsClub,
  onOpenAthlete,
  athletes,
  athletesLoading,
  kpiLoading,
  fatigueAlerts,
  mostLoadedAthlete,
  swimSessionCount,
  strengthSessionCount,
}: CoachHomeProps) => {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("fr-FR"));

  const visibleAthletes = useMemo(() => {
    if (!deferredSearch) {
      return athletes.slice(0, 5);
    }

    return athletes
      .filter((athlete) => {
        const name = athlete.display_name.toLocaleLowerCase("fr-FR");
        const group = athlete.group_label?.toLocaleLowerCase("fr-FR") ?? "";
        return name.includes(deferredSearch) || group.includes(deferredSearch);
      })
      .slice(0, 6);
  }, [athletes, deferredSearch]);

  const primaryAction =
    fatigueAlerts.length > 0
      ? {
          label: `${fatigueAlerts.length} alerte${fatigueAlerts.length > 1 ? "s" : ""} fatigue`,
          detail: "Ouvrir la vue nageurs",
          action: () => onNavigate("swimmers"),
        }
      : {
          label: "Assigner une séance",
          detail: "Planifier pour un groupe",
          action: () => onNavigate("calendar"),
        };

  return (
    <div className="space-y-4 pb-24">
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="shrink-0 rounded-full border px-3 py-2 text-sm font-semibold active:bg-muted"
          >
            Aujourd'hui
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un nageur"
              className="h-10 rounded-full pl-9"
            />
          </div>
          <Button size="sm" className="shrink-0 rounded-full" onClick={() => onNavigate("messaging")}>
            Message
          </Button>
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground capitalize">
          {today}
        </p>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-display font-bold uppercase italic">Aujourd'hui</h1>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onNavigate("swimmers")}>
            Tous les nageurs
          </Button>
        </div>
        <div className="space-y-2 rounded-2xl border bg-card p-3 shadow-sm">
          <button
            type="button"
            onClick={primaryAction.action}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left active:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">{primaryAction.label}</p>
              <p className="text-xs text-muted-foreground">{primaryAction.detail}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("objectives")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left active:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">Objectifs</p>
              <p className="text-xs text-muted-foreground">Ouvrir les temps cibles</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("messaging")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left active:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">Message rapide</p>
              <p className="text-xs text-muted-foreground">Notifier un groupe ou un nageur</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Nageurs
          </h2>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs font-semibold text-primary"
            >
              Effacer
            </button>
          ) : null}
        </div>
        <div className="rounded-2xl border bg-card p-2 shadow-sm">
          {athletesLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : visibleAthletes.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucun nageur trouvé.
            </div>
          ) : (
            <div className="space-y-1">
              {visibleAthletes.map((athlete) => {
                const isFatigueAlert = fatigueAlerts.some(
                  (item) => item.athleteName === athlete.display_name,
                );

                return (
                  <button
                    key={athlete.id ?? athlete.display_name}
                    type="button"
                    onClick={() => onOpenAthlete(athlete)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left active:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{athlete.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {athlete.group_label || "Sans groupe"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFatigueAlert ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">
                          Alerte
                        </span>
                      ) : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Repères
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Fatigue</span>
              <HeartPulse className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold tabular-nums">{kpiLoading ? "–" : fatigueAlerts.length}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {kpiLoading
                ? "Chargement…"
                : fatigueAlerts.length > 0
                  ? fatigueAlerts.slice(0, 2).map((a) => a.athleteName.split(" ")[0]).join(", ")
                  : "Aucune alerte"}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Plus chargé</span>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold truncate">
              {kpiLoading ? "–" : mostLoadedAthlete?.athleteName?.split(" ")[0] ?? "–"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {kpiLoading
                ? "Calcul…"
                : mostLoadedAthlete
                  ? `Charge ${Math.round(mostLoadedAthlete.loadScore)}`
                  : "Pas de données"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="space-y-2 rounded-2xl border bg-card p-3 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Outils
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Natation", icon: Waves, action: () => onNavigate("swim") },
              { label: "Muscu", icon: Dumbbell, action: () => onNavigate("strength") },
              { label: "Groupes", icon: UsersRound, action: () => onNavigate("groups") },
              { label: "Compétitions", icon: Trophy, action: () => onNavigate("competitions") },
              { label: "Créneaux", icon: Clock, action: () => onNavigate("training-slots") },
              { label: "SMS", icon: BellRing, action: () => onNavigate("sms") },
              { label: "Records", icon: Trophy, action: onOpenRecordsClub },
              { label: "Admin records", icon: Trophy, action: onOpenRecordsAdmin },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium active:bg-muted"
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("calendar")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left active:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">Assigner</p>
              <p className="text-xs text-muted-foreground">Natation et musculation</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {swimSessionCount ?? 0} nat · {strengthSessionCount ?? 0} muscu
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("swimmers")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left active:bg-muted"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">Voir tous les nageurs</p>
              <p className="text-xs text-muted-foreground">
                {athletesLoading
                  ? "Chargement…"
                  : `${athletes.length} nageur${athletes.length > 1 ? "s" : ""}`}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </section>
    </div>
  );
};

const getDateOnly = (value: Date) => value.toISOString().split("T")[0];
const getRunTimestamp = (run: LocalStrengthRun) =>
  new Date(run.completed_at || run.started_at || run.date || run.created_at || 0).getTime();

const buildFatigueRating = (values: number[]) => {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rating = Math.min(5, Math.max(1, Math.round((average / 10) * 5)));
  return { average, rating };
};

export default function Coach() {
  const role = useAuth((state) => state.role);
  const setSelectedAthlete = useAuth((state) => state.setSelectedAthlete);
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<CoachSection>(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]section=([^&]+)/);
    return (match?.[1] as CoachSection) || "home";
  });
  const kpiPeriod: KpiLookbackPeriod = 7;
  const [selectedCoachAthlete, setSelectedCoachAthlete] = useState<CoachAthleteOption | null>(null);

  // Reset to home when nav icon is tapped while already on /coach
  useEffect(() => {
    const reset = () => {
      setActiveSection("home");
      setSelectedCoachAthlete(null);
    };
    window.addEventListener("nav:reset", reset);
    return () => window.removeEventListener("nav:reset", reset);
  }, []);

  const coachAccess = role === "coach" || role === "admin";
  const shouldLoadCatalogs = activeSection === "home" || activeSection === "calendar";
  const shouldLoadAthletes =
    activeSection === "home" ||
    activeSection === "messaging" ||
    activeSection === "sms" ||
    activeSection === "swimmers" ||
    activeSection === "athlete" ||
    activeSection === "calendar" ||
    activeSection === "groups" ||
    activeSection === "objectives";
  const shouldLoadGroups = activeSection === "messaging" || activeSection === "sms" || activeSection === "calendar" || activeSection === "groups" || activeSection === "training-slots";

  // Queries
  const { data: swimSessions } = useQuery({
    queryKey: ["swim_catalog"],
    queryFn: () => api.getSwimCatalog(),
    enabled: coachAccess && shouldLoadCatalogs,
  });
  const { data: strengthSessions } = useQuery({
    queryKey: ["strength_catalog"],
    queryFn: () => api.getStrengthSessions(),
    enabled: coachAccess && shouldLoadCatalogs,
  });
  const { data: athletes = [], isLoading: athletesLoading } = useQuery({
    queryKey: ["athletes"],
    queryFn: () => api.getAthletes(),
    enabled: coachAccess && shouldLoadAthletes,
  });
  const topAthletes = useMemo(() => athletes.slice(0, 5), [athletes]);
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
    enabled: coachAccess && shouldLoadGroups,
  });
  const coachKpisQuery = useQuery({
    queryKey: ["coach-kpis", kpiPeriod, topAthletes.map((athlete) => athlete.id ?? athlete.display_name)],
    enabled: coachAccess && activeSection === "home" && topAthletes.length > 0,
    queryFn: async () => {
      const lookbackDays = kpiPeriod;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);
      const fromDate = getDateOnly(startDate);
      const toDate = getDateOnly(new Date());

      const perAthlete = await Promise.all(
        topAthletes.map(async (athlete) => {
          const [sessions, strength] = await Promise.all([
            api.getSessions(athlete.display_name, athlete.id),
            api.getStrengthHistory(athlete.display_name, {
              athleteId: athlete.id,
              limit: 50,
              from: fromDate,
              to: toDate,
            }),
          ]);
          const recentSessions = sessions.filter(
            (session) => new Date(session.date).getTime() >= startDate.getTime(),
          );
          const sessionFatigueValues = recentSessions
            .map((session) => session.fatigue ?? session.feeling)
            .filter((value): value is number => Number.isFinite(value));
          const swimLoad = recentSessions.reduce(
            (sum, session) => sum + (Number(session.duration) || 0) * (Number(session.effort) || 0),
            0,
          );
          const runs = strength?.runs ?? [];
          const recentRuns = runs.filter((run: LocalStrengthRun) => getRunTimestamp(run) >= startDate.getTime());
          const runFatigueValues = recentRuns
            .map((run: LocalStrengthRun) => run.fatigue ?? run.feeling ?? run.rpe)
            .filter((value: unknown): value is number => Number.isFinite(Number(value)))
            .map((value: unknown) => Number(value));
          const strengthLoad = recentRuns.reduce((sum: number, run: LocalStrengthRun) => {
            const runEffort = Number(run.feeling ?? run.rpe ?? 0);
            const runDuration = Number(run.duration ?? 0);
            if (runDuration > 0 && runEffort > 0) {
              return sum + runDuration * runEffort;
            }
            const setCount = Array.isArray(run.logs) ? run.logs.length : 0;
            return sum + setCount * 5;
          }, 0);
          const fatigueRating = buildFatigueRating([...sessionFatigueValues, ...runFatigueValues]);
          return {
            athleteName: athlete.display_name,
            loadScore: swimLoad + strengthLoad,
            fatigueRating,
          };
        }),
      );

      const fatigueAlerts = perAthlete
        .filter((entry) => entry.fatigueRating?.rating === 5)
        .map((entry) => ({
          athleteName: entry.athleteName,
          rating: entry.fatigueRating?.rating ?? 0,
        }));
      const mostLoadedAthlete = perAthlete
        .filter((entry) => entry.loadScore > 0)
        .sort((a, b) => b.loadScore - a.loadScore)[0];

      return { fatigueAlerts, mostLoadedAthlete: mostLoadedAthlete ?? null };
    },
  });

  const handleOpenAthlete = (athlete: CoachAthleteOption) => {
    setSelectedAthlete({ id: athlete.id ?? null, name: athlete.display_name });
    if (athlete.id == null) {
      navigate("/progress");
      return;
    }
    setSelectedCoachAthlete(athlete);
    setActiveSection("athlete");
  };

  if (!coachAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in motion-reduce:animate-none">
        <Card className="w-full max-w-sm shadow-xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 uppercase italic">
              <Users className="h-5 w-5 text-primary" />
              Accès Coach
            </CardTitle>
            <CardDescription>Cette section est réservée aux coachs et administrateurs.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connectez-vous avec un compte autorisé pour accéder aux outils de gestion.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeSection === "home" ? (
        <CoachHome
          onNavigate={setActiveSection}
          onOpenRecordsAdmin={() => navigate("/records-admin")}
          onOpenRecordsClub={() => navigate("/records-club")}
          onOpenAthlete={handleOpenAthlete}
          athletes={athletes}
          athletesLoading={athletesLoading}
          kpiLoading={coachKpisQuery.isLoading}
          fatigueAlerts={coachKpisQuery.data?.fatigueAlerts ?? []}
          mostLoadedAthlete={coachKpisQuery.data?.mostLoadedAthlete ?? null}
          swimSessionCount={swimSessions?.length}
          strengthSessionCount={strengthSessions?.length}
        />
      ) : null}

      {activeSection === "swim" ? (
        <div className="space-y-6">
          <CoachSectionHeader
            title="Bibliothèque natation"
            description="Accédez aux séances et aux templates natation."
            onBack={() => setActiveSection("home")}
            actions={
              <Button variant="outline" size="sm" onClick={() => setActiveSection("calendar")}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Assigner
              </Button>
            }
          />
          <Suspense fallback={<PageSkeleton />}>
            <SwimCatalog />
          </Suspense>
        </div>
      ) : null}

      {activeSection === "strength" ? (
        <div className="space-y-6">
          <CoachSectionHeader
            title="Bibliothèque musculation"
            description="Consultez et créez des séances musculation."
            onBack={() => setActiveSection("home")}
            actions={
              <Button variant="outline" size="sm" onClick={() => setActiveSection("calendar")}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Assigner
              </Button>
            }
          />
          {FEATURES.coachStrength ? (
            <Suspense fallback={<PageSkeleton />}>
              <StrengthCatalog />
            </Suspense>
          ) : (
            <ComingSoon
              title="Musculation coach"
              description="Le builder musculation est en cours de finalisation."
            />
          )}
        </div>
      ) : null}

      {activeSection === "swimmers" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachSwimmersOverview
            athletes={athletes}
            athletesLoading={athletesLoading}
            onBack={() => setActiveSection("home")}
            onOpenAthlete={handleOpenAthlete}
          />
        </Suspense>
      ) : null}

      {activeSection === "athlete" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachSwimmerDetail
            athleteId={selectedCoachAthlete?.id ?? null}
            athleteName={selectedCoachAthlete?.display_name ?? null}
            onBack={() => setActiveSection("home")}
          />
        </Suspense>
      ) : null}

      {activeSection === "messaging" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachMessagesScreen
            onBack={() => setActiveSection("home")}
            athletes={athletes}
            groups={groups}
            athletesLoading={athletesLoading}
          />
        </Suspense>
      ) : null}

      {activeSection === "sms" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachSmsScreen
            onBack={() => setActiveSection("home")}
            athletes={athletes}
            groups={groups}
            athletesLoading={athletesLoading}
          />
        </Suspense>
      ) : null}

      {activeSection === "calendar" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachCalendar
            onBack={() => setActiveSection("home")}
            athletes={athletes}
            groups={groups}
            swimSessions={swimSessions}
            strengthSessions={strengthSessions}
          />
        </Suspense>
      ) : null}

      {activeSection === "groups" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachGroupsScreen
            onBack={() => setActiveSection("home")}
            athletes={athletes}
            groups={groups}
            athletesLoading={athletesLoading}
          />
        </Suspense>
      ) : null}

      {activeSection === "competitions" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachCompetitionsScreen
            onBack={() => setActiveSection("home")}
          />
        </Suspense>
      ) : null}

      {activeSection === "objectives" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachObjectivesScreen
            onBack={() => setActiveSection("home")}
            athletes={athletes}
            athletesLoading={athletesLoading}
          />
        </Suspense>
      ) : null}

      {activeSection === "training-slots" ? (
        <Suspense fallback={<PageSkeleton />}>
          <CoachTrainingSlotsScreen
            onBack={() => setActiveSection("home")}
            groups={groups}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

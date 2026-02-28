import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Dumbbell, HeartPulse, Mail, MessageSquare, Target, Trophy, Users, UsersRound, Waves } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import CoachSectionHeader from "./coach/CoachSectionHeader";
import CoachSwimmersOverview from "./coach/CoachSwimmersOverview";
import CoachMessagesScreen from "./coach/CoachMessagesScreen";
import CoachSmsScreen from "./coach/CoachSmsScreen";
import CoachCalendar from "./coach/CoachCalendar";
import CoachGroupsScreen from "./coach/CoachGroupsScreen";
import CoachCompetitionsScreen from "./coach/CoachCompetitionsScreen";
import CoachObjectivesScreen from "./coach/CoachObjectivesScreen";
import ComingSoon from "./ComingSoon";
import { FEATURES } from "@/lib/features";
import type { LocalStrengthRun } from "@/lib/types";

// Lazy load heavy catalog components
const StrengthCatalog = lazy(() => import("./coach/StrengthCatalog"));
const SwimCatalog = lazy(() => import("./coach/SwimCatalog"));

type CoachSection = "home" | "swim" | "strength" | "swimmers" | "messaging" | "sms" | "calendar" | "groups" | "competitions" | "objectives";
type KpiLookbackPeriod = 7 | 30 | 365;

type CoachHomeProps = {
  onNavigate: (section: CoachSection) => void;
  onOpenRecordsAdmin: () => void;
  onOpenRecordsClub: () => void;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null; ffn_iuf?: string | null }>;
  athletesLoading: boolean;
  upcomingBirthdays?: Array<{ id: number; display_name: string; next_birthday: string; days_until: number }>;
  birthdaysLoading: boolean;
  kpiLoading: boolean;
  kpiPeriod: KpiLookbackPeriod;
  onKpiPeriodChange: (period: KpiLookbackPeriod) => void;
  fatigueAlerts: Array<{ athleteName: string; rating: number }>;
  mostLoadedAthlete?: { athleteName: string; loadScore: number } | null;
  swimSessionCount?: number;
  strengthSessionCount?: number;
};

const CoachHome = ({
  onNavigate,
  onOpenRecordsAdmin,
  onOpenRecordsClub,
  athletes,
  athletesLoading,
  upcomingBirthdays,
  birthdaysLoading,
  kpiLoading,
  kpiPeriod,
  onKpiPeriodChange,
  fatigueAlerts,
  mostLoadedAthlete,
  swimSessionCount,
  strengthSessionCount,
}: CoachHomeProps) => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hasFatigueAlerts = fatigueAlerts.length > 0;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-display font-bold uppercase italic">
          {greeting}, <span className="text-primary">Coach</span>
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{today}</p>
      </div>

      {/* KPI Strip — unified mobile/desktop */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Signaux · {kpiPeriod}j
          </h2>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={String(kpiPeriod)}
            onValueChange={(v) => {
              if (v) onKpiPeriodChange(Number(v) as KpiLookbackPeriod);
            }}
          >
            <ToggleGroupItem value="7" className="h-7 px-2 text-xs" aria-label="7 jours">
              7j
            </ToggleGroupItem>
            <ToggleGroupItem value="30" className="h-7 px-2 text-xs" aria-label="30 jours">
              30j
            </ToggleGroupItem>
            <ToggleGroupItem value="365" className="h-7 px-2 text-xs" aria-label="1 an">
              1an
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`rounded-xl border p-3 ${
              hasFatigueAlerts ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Fatigue 5/5</span>
              <HeartPulse
                className={`h-3.5 w-3.5 ${hasFatigueAlerts ? "text-destructive" : "text-muted-foreground"}`}
              />
            </div>
            <p className="text-xl font-bold tabular-nums">
              {kpiLoading ? "–" : fatigueAlerts.length}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {kpiLoading
                ? "Chargement…"
                : hasFatigueAlerts
                  ? fatigueAlerts.slice(0, 2).map((a) => a.athleteName.split(" ")[0]).join(", ")
                  : "Aucune alerte"}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-1">
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
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNavigate("calendar")}
          className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 py-2 text-sm font-semibold active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Assigner
        </button>
        <button
          type="button"
          onClick={() => onNavigate("messaging")}
          className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </button>
        <button
          type="button"
          onClick={() => onNavigate("sms")}
          className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          SMS
        </button>
        <button
          type="button"
          onClick={() => onNavigate("groups")}
          className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UsersRound className="h-3.5 w-3.5" />
          Groupes
        </button>
      </div>

      {/* Navigation Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("swim")}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Waves className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Natation</p>
          <p className="text-xs text-muted-foreground">
            {swimSessionCount != null
              ? `${swimSessionCount} séance${swimSessionCount !== 1 ? "s" : ""}`
              : "Bibliothèque"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("strength")}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Dumbbell className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Musculation</p>
          <p className="text-xs text-muted-foreground">
            {strengthSessionCount != null
              ? `${strengthSessionCount} séance${strengthSessionCount !== 1 ? "s" : ""}`
              : "Bibliothèque"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("swimmers")}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Users className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Nageurs</p>
          <p className="text-xs text-muted-foreground">
            {athletesLoading
              ? "Chargement…"
              : `${athletes.length} nageur${athletes.length !== 1 ? "s" : ""}`}
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenRecordsAdmin}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trophy className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Records club</p>
          <p className="text-xs text-muted-foreground">Import & administration</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("competitions")}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trophy className="h-5 w-5 text-amber-500 mb-2" />
          <p className="text-sm font-bold">Compétitions</p>
          <p className="text-xs text-muted-foreground">Échéances & calendrier</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("objectives")}
          className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Target className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-bold">Objectifs</p>
          <p className="text-xs text-muted-foreground">Temps cibles & objectifs</p>
        </button>
      </div>

      {/* Records club shortcut */}
      <button
        type="button"
        onClick={onOpenRecordsClub}
        className="w-full text-center text-sm text-primary font-semibold py-1 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Voir les records du club
      </button>

      {/* Birthdays */}
      {!birthdaysLoading && upcomingBirthdays && upcomingBirthdays.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Anniversaires
          </h2>
          <div className="space-y-1.5">
            {upcomingBirthdays.slice(0, 3).map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{b.display_name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(b.next_birthday)}
                  </span>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">J-{b.days_until}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("fr-FR");
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
  const [kpiPeriod, setKpiPeriod] = useState<KpiLookbackPeriod>(7);

  // Reset to home when nav icon is tapped while already on /coach
  useEffect(() => {
    const reset = () => setActiveSection("home");
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
    activeSection === "calendar" ||
    activeSection === "groups" ||
    activeSection === "objectives";
  const shouldLoadGroups = activeSection === "messaging" || activeSection === "sms" || activeSection === "calendar" || activeSection === "groups";
  const shouldLoadBirthdays = activeSection === "home" || activeSection === "swimmers";

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
  const birthdaysQuery = useQuery({
    queryKey: ["upcoming-birthdays"],
    queryFn: () => api.getUpcomingBirthdays({ days: 30 }),
    enabled: coachAccess && shouldLoadBirthdays,
  });
  const upcomingBirthdays = birthdaysQuery.data;
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

  const handleOpenAthlete = (athlete: { id: number | null; display_name: string }) => {
    setSelectedAthlete({ id: athlete.id ?? null, name: athlete.display_name });
    navigate(athlete.id != null ? `/coach/swimmer/${athlete.id}` : "/progress");
  };

  const { toast } = useToast();

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
          athletes={athletes}
          athletesLoading={athletesLoading}
          upcomingBirthdays={upcomingBirthdays}
          birthdaysLoading={birthdaysQuery.isLoading}
          kpiLoading={coachKpisQuery.isLoading}
          kpiPeriod={kpiPeriod}
          onKpiPeriodChange={setKpiPeriod}
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
        <CoachSwimmersOverview
          athletes={athletes}
          athletesLoading={athletesLoading}
          onBack={() => setActiveSection("home")}
          onOpenAthlete={handleOpenAthlete}
        />
      ) : null}

      {activeSection === "messaging" ? (
        <CoachMessagesScreen
          onBack={() => setActiveSection("home")}
          athletes={athletes}
          groups={groups}
          athletesLoading={athletesLoading}
        />
      ) : null}

      {activeSection === "sms" ? (
        <CoachSmsScreen
          onBack={() => setActiveSection("home")}
          athletes={athletes}
          groups={groups}
          athletesLoading={athletesLoading}
        />
      ) : null}

      {activeSection === "calendar" ? (
        <CoachCalendar
          onBack={() => setActiveSection("home")}
          athletes={athletes}
          groups={groups}
          swimSessions={swimSessions}
          strengthSessions={strengthSessions}
        />
      ) : null}

      {activeSection === "groups" ? (
        <CoachGroupsScreen
          onBack={() => setActiveSection("home")}
          athletes={athletes}
          groups={groups}
          athletesLoading={athletesLoading}
        />
      ) : null}

      {activeSection === "competitions" ? (
        <CoachCompetitionsScreen
          onBack={() => setActiveSection("home")}
        />
      ) : null}

      {activeSection === "objectives" ? (
        <CoachObjectivesScreen
          onBack={() => setActiveSection("home")}
          athletes={athletes}
          athletesLoading={athletesLoading}
        />
      ) : null}
    </div>
  );
}

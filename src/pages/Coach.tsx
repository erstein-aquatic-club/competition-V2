import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Dumbbell, HeartPulse, MessageSquare, Trophy, Users, Waves } from "lucide-react";
import StrengthCatalog from "./coach/StrengthCatalog";
import SwimCatalog from "./coach/SwimCatalog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import CoachSectionHeader from "./coach/CoachSectionHeader";
import CoachAssignScreen from "./coach/CoachAssignScreen";
import CoachMessagesScreen from "./coach/CoachMessagesScreen";
import ComingSoon from "./ComingSoon";
import { FEATURES } from "@/lib/features";

type CoachSection = "home" | "swim" | "strength" | "swimmers" | "assignments" | "messaging";
type KpiLookbackPeriod = 7 | 30 | 365;

type CoachQuickActionsProps = {
  onNavigate: (section: CoachSection) => void;
};

const CoachQuickActions = ({ onNavigate }: CoachQuickActionsProps) => (
  <Card className="border-l-4 border-l-primary">
    <CardHeader>
      <CardTitle>Actions rapides</CardTitle>
      <CardDescription>Accélérez vos tâches les plus fréquentes.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2">
      <Button className="justify-start" variant="outline" onClick={() => onNavigate("assignments")}>
        <Bell className="mr-2 h-4 w-4" />
        Assigner une séance
      </Button>
      <Button className="justify-start" variant="outline" onClick={() => onNavigate("messaging")}>
        <MessageSquare className="mr-2 h-4 w-4" />
        Message rapide
      </Button>
    </CardContent>
  </Card>
);

type CoachHomeProps = {
  onNavigate: (section: CoachSection) => void;
  onOpenRecordsAdmin: () => void;
  athletes: Array<{ id: number | null; display_name: string }>;
  athletesLoading: boolean;
  upcomingBirthdays?: Array<{ id: number; display_name: string; next_birthday: string; days_until: number }>;
  birthdaysLoading: boolean;
  kpiLoading: boolean;
  kpiPeriod: KpiLookbackPeriod;
  onKpiPeriodChange: (period: KpiLookbackPeriod) => void;
  fatigueAlerts: Array<{ athleteName: string; rating: number }>;
  mostLoadedAthlete?: { athleteName: string; loadScore: number } | null;
};

const CoachHome = ({
  onNavigate,
  onOpenRecordsAdmin,
  athletes,
  athletesLoading,
  upcomingBirthdays,
  birthdaysLoading,
  kpiLoading,
  kpiPeriod,
  onKpiPeriodChange,
  fatigueAlerts,
  mostLoadedAthlete,
}: CoachHomeProps) => (
  <div className="space-y-6">
    <div className="space-y-1">
      <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Espace Coach</h1>
      <p className="text-sm text-muted-foreground">
        Votre tableau de bord pour gérer les séances, les nageurs et la communication.
      </p>
    </div>

    <div className="space-y-3 sm:hidden">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Par où commencer
        </h2>
      </div>
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => onNavigate("swim")}
          className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Créer une séance natation</p>
              <p className="text-xs text-muted-foreground">Structurer un nouveau plan.</p>
            </div>
            <Waves className="h-5 w-5 text-primary" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("assignments")}
          className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Assigner une séance</p>
              <p className="text-xs text-muted-foreground">Envoyer une séance à un nageur.</p>
            </div>
            <Bell className="h-5 w-5 text-primary" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("messaging")}
          className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Envoyer un message</p>
              <p className="text-xs text-muted-foreground">Relancer ou féliciter un nageur.</p>
            </div>
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
        </button>
      </div>
    </div>

    <div className="hidden sm:block">
      <CoachQuickActions onNavigate={onNavigate} />
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-primary" />
            Natation
          </CardTitle>
          <CardDescription>Consultez et créez des séances natation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => onNavigate("swim")}>
            Accéder à la bibliothèque
          </Button>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            Musculation
          </CardTitle>
          <CardDescription>Préparez les plans muscu et les suivis.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => onNavigate("strength")}>
            Accéder à la bibliothèque
          </Button>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Mes nageurs
          </CardTitle>
          <CardDescription>Accédez aux fiches individuelles et aux groupes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => onNavigate("swimmers")}>
            Voir les nageurs
          </Button>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Records club
          </CardTitle>
          <CardDescription>Importer les performances FFN et reconstruire les records.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" variant="outline" onClick={onOpenRecordsAdmin}>
            Administration des records
          </Button>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="sm:hidden bg-primary text-primary-foreground">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Indicateurs clés</CardTitle>
          <CardDescription className="text-primary-foreground/70">Synthèse rapide pour aujourd'hui.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">Fatigue 5/5</p>
              <p className="text-2xl font-semibold">{kpiLoading ? "…" : fatigueAlerts.length}</p>
              <p className="text-xs text-primary-foreground/70">
                {kpiLoading
                  ? "Chargement..."
                  : fatigueAlerts.length
                    ? fatigueAlerts.slice(0, 2).map((alert) => alert.athleteName).join(", ")
                    : "Aucune alerte"}
              </p>
            </div>
            <HeartPulse className="h-5 w-5 text-primary-foreground/70" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">Nageur le plus chargé</p>
              <p className="text-lg font-semibold">
                {kpiLoading ? "…" : mostLoadedAthlete?.athleteName ?? "-"}
              </p>
              <p className="text-xs text-primary-foreground/70">
                {kpiLoading
                  ? "Calcul en cours"
                  : mostLoadedAthlete
                    ? `Charge ${Math.round(mostLoadedAthlete.loadScore)}`
                    : "Pas de données récentes"}
              </p>
            </div>
            <Users className="h-5 w-5 text-primary-foreground/70" />
          </div>
        </CardContent>
      </Card>
      <Card className="hidden sm:block">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Signaux clés</CardTitle>
              <CardDescription>Vue d'ensemble rapide de votre groupe.</CardDescription>
            </div>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={String(kpiPeriod)}
              onValueChange={(value) => {
                if (!value) return;
                onKpiPeriodChange(Number(value) as KpiLookbackPeriod);
              }}
            >
              <ToggleGroupItem value="7" aria-label="Période 7 jours" aria-pressed={kpiPeriod === 7}>
                7j
              </ToggleGroupItem>
              <ToggleGroupItem value="30" aria-label="Période 30 jours" aria-pressed={kpiPeriod === 30}>
                30j
              </ToggleGroupItem>
              <ToggleGroupItem value="365" aria-label="Période 365 jours" aria-pressed={kpiPeriod === 365}>
                365j
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-sm text-muted-foreground">Fatigue 5/5 ({kpiPeriod}j)</p>
              <p className="text-xl font-semibold">
                {kpiLoading ? "…" : fatigueAlerts.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {kpiLoading
                  ? "Chargement..."
                  : fatigueAlerts.length
                    ? fatigueAlerts.slice(0, 2).map((alert) => alert.athleteName).join(", ")
                    : "Aucune alerte"}
              </p>
            </div>
            <HeartPulse className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-sm text-muted-foreground">Nageur le plus chargé ({kpiPeriod}j)</p>
              <p className="text-xl font-semibold">
                {kpiLoading ? "…" : mostLoadedAthlete?.athleteName ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                {kpiLoading
                  ? "Calcul en cours"
                  : mostLoadedAthlete
                    ? `Charge ${Math.round(mostLoadedAthlete.loadScore)}`
                    : "Pas de données récentes"}
              </p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Anniversaires à venir</CardTitle>
          <CardDescription>Les 30 prochains jours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {birthdaysLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : upcomingBirthdays && upcomingBirthdays.length > 0 ? (
            upcomingBirthdays.slice(0, 3).map((birthday) => (
              <div key={birthday.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{birthday.display_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(birthday.next_birthday)}</p>
                </div>
                <span className="text-xs font-semibold text-primary">J-{birthday.days_until}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aucun anniversaire dans les 30 prochains jours.</p>
          )}
          <Button variant="outline" className="w-full" onClick={() => onNavigate("swimmers")}>
            Voir tous les nageurs
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("fr-FR");
};

const getDateOnly = (value: Date) => value.toISOString().split("T")[0];
const getRunTimestamp = (run: any) =>
  new Date(run.completed_at || run.started_at || run.date || run.created_at || 0).getTime();

const buildFatigueRating = (values: number[]) => {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rating = Math.min(5, Math.max(1, Math.round((average / 10) * 5)));
  return { average, rating };
};

export default function Coach() {
  const role = useAuth((state) => state.role);
  const selectedAthleteId = useAuth((state) => state.selectedAthleteId);
  const setSelectedAthlete = useAuth((state) => state.setSelectedAthlete);
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<CoachSection>("home");
  const [kpiPeriod, setKpiPeriod] = useState<KpiLookbackPeriod>(7);

  const coachAccess = role === "coach" || role === "admin";
  const shouldLoadAssignments = activeSection === "assignments";
  const shouldLoadAthletes =
    activeSection === "home" ||
    activeSection === "assignments" ||
    activeSection === "messaging" ||
    activeSection === "swimmers";
  const shouldLoadGroups = activeSection === "assignments" || activeSection === "messaging";
  const shouldLoadBirthdays = activeSection === "home" || activeSection === "swimmers";

  // Queries
  const { data: swimSessions } = useQuery({
    queryKey: ["swim_catalog"],
    queryFn: () => api.getSwimCatalog(),
    enabled: coachAccess && shouldLoadAssignments,
  });
  const { data: strengthSessions } = useQuery({
    queryKey: ["strength_catalog"],
    queryFn: () => api.getStrengthSessions(),
    enabled: coachAccess && shouldLoadAssignments,
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
          const recentRuns = runs.filter((run: any) => getRunTimestamp(run) >= startDate.getTime());
          const runFatigueValues = recentRuns
            .map((run: any) => run.fatigue ?? run.feeling ?? run.rpe)
            .filter((value: unknown): value is number => Number.isFinite(Number(value)))
            .map((value: unknown) => Number(value));
          const strengthLoad = recentRuns.reduce((sum: number, run: any) => {
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
    navigate("/progress");
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
          athletes={athletes}
          athletesLoading={athletesLoading}
          upcomingBirthdays={upcomingBirthdays}
          birthdaysLoading={birthdaysQuery.isLoading}
          kpiLoading={coachKpisQuery.isLoading}
          kpiPeriod={kpiPeriod}
          onKpiPeriodChange={setKpiPeriod}
          fatigueAlerts={coachKpisQuery.data?.fatigueAlerts ?? []}
          mostLoadedAthlete={coachKpisQuery.data?.mostLoadedAthlete ?? null}
        />
      ) : null}

      {activeSection === "assignments" ? (
        <CoachAssignScreen
          onBack={() => setActiveSection("home")}
          swimSessions={swimSessions}
          strengthSessions={strengthSessions}
          athletes={athletes}
          groups={groups}
        />
      ) : null}

      {activeSection === "swim" ? (
        <div className="space-y-6">
          <CoachSectionHeader
            title="Bibliothèque natation"
            description="Accédez aux séances et aux templates natation."
            onBack={() => setActiveSection("home")}
            actions={
              <Button variant="outline" onClick={() => setActiveSection("assignments")}>
                <Bell className="mr-2 h-4 w-4" />
                Nouvelle assignation
              </Button>
            }
          />
          <SwimCatalog />
        </div>
      ) : null}

      {activeSection === "strength" ? (
        <div className="space-y-6">
          <CoachSectionHeader
            title="Bibliothèque musculation"
            description="Consultez et créez des séances musculation."
            onBack={() => setActiveSection("home")}
            actions={
              <Button variant="outline" onClick={() => setActiveSection("assignments")}>
                <Bell className="mr-2 h-4 w-4" />
                Nouvelle assignation
              </Button>
            }
          />
          {FEATURES.coachStrength ? (
            <StrengthCatalog />
          ) : (
            <ComingSoon
              title="Musculation coach"
              description="Le builder musculation est en cours de finalisation."
            />
          )}
        </div>
      ) : null}

      {activeSection === "swimmers" ? (
        <div className="space-y-6">
          <CoachSectionHeader
            title="Nageurs"
            description="Accédez aux fiches individuelles des nageurs."
            onBack={() => setActiveSection("home")}
            actions={
              <Button variant="outline" onClick={() => setActiveSection("messaging")}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Message rapide
              </Button>
            }
          />
          <Card>
            <CardHeader>
              <CardTitle>Suivi des Nageurs</CardTitle>
              <CardDescription>Accédez aux fiches individuelles des nageurs.</CardDescription>
            </CardHeader>
            <CardContent>
              {athletesLoading ? (
                <div className="space-y-3 p-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-4 w-1/3 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
                      <div className="h-4 w-1/4 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
                      <div className="ml-auto h-8 w-16 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
                    </div>
                  ))}
                </div>
              ) : athletes.length ? (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nageur</TableHead>
                        <TableHead>Groupe</TableHead>
                        <TableHead className="text-right">Fiche</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {athletes.map((athlete) => (
                        <TableRow key={athlete.id ?? athlete.display_name}>
                          <TableCell className="font-medium">{athlete.display_name}</TableCell>
                          <TableCell>
                            {athlete.group_label ? (
                              <Badge variant="secondary">{athlete.group_label}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sans groupe</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleOpenAthlete(athlete)}>
                              Voir la fiche
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun nageur disponible.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeSection === "messaging" ? (
        <CoachMessagesScreen
          onBack={() => setActiveSection("home")}
          athletes={athletes}
          groups={groups}
          athletesLoading={athletesLoading}
        />
      ) : null}
    </div>
  );
}

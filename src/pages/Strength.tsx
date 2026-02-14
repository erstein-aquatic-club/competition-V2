import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, StrengthCycleType, StrengthSessionTemplate, StrengthSessionItem, Exercise, Assignment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Dumbbell, SlidersHorizontal, Info, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WorkoutRunner, resolveNextStep } from "@/components/strength/WorkoutRunner";
import { SessionList } from "@/components/strength/SessionList";
import { SessionDetailPreview } from "@/components/strength/SessionDetailPreview";
import { HistoryTable } from "@/components/strength/HistoryTable";
import { useStrengthState } from "@/hooks/useStrengthState";
import { orderStrengthItems } from "@/components/strength/utils";
import type { SetLogEntry, UpdateStrengthRunInput, OneRmEntry } from "@/lib/types";

const normalizeStrengthCycle = (value?: string | null): StrengthCycleType => {
  if (value === "endurance" || value === "hypertrophie" || value === "force") {
    return value;
  }
  return "endurance";
};

type StrengthExerciseParams = {
  sets: number | null;
  reps: number | null;
  percent1rm: number | null;
  restSeries: number | null;
  restExercise: number | null;
};

const normalizeStrengthParam = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

const resolveExerciseParams = (
  exercise: Exercise | undefined,
  cycle: StrengthCycleType,
): StrengthExerciseParams => {
  if (!exercise) {
    return {
      sets: null,
      reps: null,
      percent1rm: null,
      restSeries: null,
      restExercise: null,
    };
  }
  const cycleParams = {
    endurance: {
      sets: exercise.Nb_series_endurance,
      reps: exercise.Nb_reps_endurance,
      percent1rm: exercise.pct_1rm_endurance,
      restSeries: exercise.recup_endurance,
      restExercise: exercise.recup_exercices_endurance,
    },
    hypertrophie: {
      sets: exercise.Nb_series_hypertrophie,
      reps: exercise.Nb_reps_hypertrophie,
      percent1rm: exercise.pct_1rm_hypertrophie,
      restSeries: exercise.recup_hypertrophie,
      restExercise: exercise.recup_exercices_hypertrophie,
    },
    force: {
      sets: exercise.Nb_series_force,
      reps: exercise.Nb_reps_force,
      percent1rm: exercise.pct_1rm_force,
      restSeries: exercise.recup_force,
      restExercise: exercise.recup_exercices_force,
    },
  }[cycle];
  return {
    sets: normalizeStrengthParam(cycleParams.sets),
    reps: normalizeStrengthParam(cycleParams.reps),
    percent1rm: normalizeStrengthParam(cycleParams.percent1rm),
    restSeries: normalizeStrengthParam(cycleParams.restSeries),
    restExercise: normalizeStrengthParam(cycleParams.restExercise),
  };
};

const getCycleItems = (items: StrengthSessionTemplate["items"] = [], cycle: StrengthCycleType) => {
  const filtered = items.filter((item) => item.cycle_type === cycle);
  const cycleItems = filtered.length ? filtered : items;
  return orderStrengthItems(cycleItems);
};

const resolveStrengthItems = (
  items: StrengthSessionItem[] = [],
  cycle: StrengthCycleType,
  exerciseLookup: Map<number, Exercise>,
) =>
  getCycleItems(items, cycle).map((item) => {
    const params = resolveExerciseParams(exerciseLookup.get(item.exercise_id), cycle);
    return {
      ...item,
      sets: params.sets ?? 0,
      reps: params.reps ?? 0,
      rest_seconds: params.restSeries ?? 0,
      percent_1rm: params.percent1rm ?? 0,
    };
  });

const createInProgressRun = ({
  runId,
  assignmentId,
  startedAt,
}: {
  runId: number;
  assignmentId?: number | null;
  startedAt: string;
}) => ({
  id: runId,
  assignment_id: assignmentId ?? null,
  started_at: startedAt,
  progress_pct: 0,
  status: "in_progress",
  logs: [],
});

const buildInProgressRunCache = (run: ReturnType<typeof createInProgressRun> | null) => ({
  runs: run ? [run] : [],
  pagination: { limit: 1, offset: 0, total: run ? 1 : 0 },
  exercise_summary: [],
});

export default function Strength() {
  const { user, userId, role, selectedAthleteId, selectedAthleteName } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasCoachSelection =
    (role === "coach" || role === "admin") &&
    (selectedAthleteId !== null || !!selectedAthleteName);
  const historyAthleteName = hasCoachSelection ? selectedAthleteName : user;
  const historyAthleteId = hasCoachSelection ? selectedAthleteId : userId;
  const historyAthleteKey = historyAthleteId ?? historyAthleteName;

  const {
    activeSession,
    setActiveSession,
    activeAssignment,
    setActiveAssignment,
    activeRunId,
    setActiveRunId,
    activeRunLogs,
    setActiveRunLogs,
    activeRunnerStep,
    setActiveRunnerStep,
    screenMode,
    setScreenMode,
    isFinishing,
    setIsFinishing,
    saveState,
    setSaveState,
    preferences,
    setPreferences,
    searchQuery,
    setSearchQuery,
    cycleType,
    setCycleType,
    clearActiveRunState,
  } = useStrengthState({ athleteKey: historyAthleteKey });

  const { poolMode, largeText } = preferences;

  const cycleOptions: Array<{ value: StrengthCycleType; label: string }> = [
    { value: "endurance", label: "Endurance" },
    { value: "hypertrophie", label: "Hypertrophie" },
    { value: "force", label: "Force" },
  ];

  // Queries
  const { data: assignments, isLoading: assignmentsLoading, error: assignmentsError, refetch: refetchAssignments } = useQuery({
    queryKey: ["assignments", user, "strength"],
    queryFn: () => api.getAssignments(user!, userId, { assignmentType: "strength" }),
    enabled: !!user,
  });

  const { data: strengthCatalog, isLoading: catalogLoading, error: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: ["strength_catalog"],
    queryFn: () => api.getStrengthSessions(),
  });

  const { data: exercises, error: exercisesError, refetch: refetchExercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.getExercises(),
  });

  const isListLoading = assignmentsLoading || catalogLoading;
  const error = assignmentsError || catalogError || exercisesError;
  const refetch = () => {
    refetchAssignments();
    refetchCatalog();
    refetchExercises();
  };

  const { data: oneRMs } = useQuery({
    queryKey: ["1rm", user, userId],
    queryFn: () => api.get1RM({ athleteName: user, athleteId: userId }),
    enabled: !!user,
  });

  const exerciseNotes = useMemo(() => {
    const map: Record<number, string | null> = {};
    (oneRMs ?? []).forEach((entry: OneRmEntry) => {
      if (entry.notes) map[entry.exercise_id] = entry.notes;
    });
    return map;
  }, [oneRMs]);

  const exerciseLookup = useMemo(() => {
    if (!exercises) return new Map<number, Exercise>();
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const activeFilteredItems = useMemo(() => {
    if (!activeSession) return [];
    return resolveStrengthItems(activeSession.items ?? [], cycleType, exerciseLookup);
  }, [activeSession, cycleType, exerciseLookup]);

  // Mutations
  const startRun = useMutation({
    mutationFn: (data: Parameters<typeof api.startStrengthRun>[0]) => api.startStrengthRun(data),
    onMutate: () => {
      setSaveState("saving");
    },
    onSuccess: (data) => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      if (data?.run_id) {
        setActiveRunId(data.run_id);
        setActiveRunLogs((prev) => prev ?? []);
        if (historyAthleteKey) {
          const runSnapshot = createInProgressRun({
            runId: data.run_id,
            assignmentId: activeAssignment?.id ?? null,
            startedAt: new Date().toISOString(),
          });
          queryClient.setQueryData(
            ["strength_run_in_progress", historyAthleteKey],
            buildInProgressRunCache(runSnapshot),
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ["assignments", user, "strength"] });
      queryClient.invalidateQueries({ queryKey: ["strength_run_in_progress", historyAthleteKey] });
      queryClient.invalidateQueries({ queryKey: ["strength_history"] });
    },
    onError: () => {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      toast({ title: "Erreur", description: "Impossible de démarrer la séance.", variant: "destructive" });
    },
  });

  const logStrengthSet = useMutation({
    mutationFn: (data: Parameters<typeof api.logStrengthSet>[0]) => api.logStrengthSet(data),
    onMutate: () => {
      setSaveState("saving");
    },
    onSuccess: (data) => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      if (data?.one_rm_updated) {
        queryClient.invalidateQueries({ queryKey: ["1rm", user, userId] });
        toast({
          title: "Nouveau 1RM détecté",
          description: "Ton record vient d'être mis à jour.",
        });
      }
    },
    onError: () => {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer une série.",
        variant: "destructive",
      });
    },
  });

  const updateRun = useMutation({
    mutationFn: (data: UpdateStrengthRunInput) => api.updateStrengthRun(data),
    onMutate: () => {
      setSaveState("saving");
    },
    onSuccess: (_data, variables) => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      setIsFinishing(false);
      queryClient.invalidateQueries({ queryKey: ["strength_history"] });
      if (variables?.status !== "completed") {
        return;
      }
      if (historyAthleteKey) {
        queryClient.setQueryData(
          ["strength_run_in_progress", historyAthleteKey],
          buildInProgressRunCache(null),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["assignments", user] });
      queryClient.invalidateQueries({ queryKey: ["assignments", user, "strength"] });
      queryClient.invalidateQueries({ queryKey: ["1rm", user, userId] });
      setActiveAssignment(null);
      setActiveRunId(null);
      setActiveSession(null);
      setActiveRunLogs(null);
      setScreenMode("list");
      toast({ title: "Séance sauvegardée", description: "Bravo pour l'effort !" });
    },
    onError: (_error, variables) => {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      if (variables?.status === "completed") {
        setIsFinishing(false);
        toast({ title: "Erreur", description: "Impossible d'enregistrer la séance. Réessayez.", variant: "destructive" });
      }
    },
  });

  const updateNote = useMutation({
    mutationFn: (params: { exercise_id: number; notes: string | null }) =>
      api.updateExerciseNote({
        athlete_id: userId ?? 0,
        exercise_id: params.exercise_id,
        notes: params.notes,
      }),
    onMutate: () => {
      setSaveState("saving");
    },
    onSuccess: () => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      queryClient.invalidateQueries({ queryKey: ["1rm", user, userId] });
    },
    onError: () => {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      toast({ title: "Erreur", description: "Impossible de sauvegarder la note.", variant: "destructive" });
    },
  });

  type StrengthAssignment = Assignment & { session_type: "strength"; items?: StrengthSessionItem[] };

  const handleStartAssignment = (
    assignment: StrengthAssignment & { session?: StrengthSessionTemplate },
    cycleOverride?: StrengthCycleType,
  ) => {
    const sessionItems = assignment.items ?? [];
    const cycle = normalizeStrengthCycle(
      cycleOverride ??
        assignment.cycle ??
        sessionItems.find((item) => item.cycle_type)?.cycle_type,
    );
    const items = resolveStrengthItems(sessionItems, cycle, exerciseLookup);
    setActiveAssignment(assignment);
    setActiveSession({
      ...assignment,
      title: assignment.title,
      description: assignment.description,
      cycle,
      items,
    });
    setActiveRunId(null);
    setActiveRunLogs(null);
    setActiveRunnerStep(0);
    setScreenMode("reader");
  };

  const startAssignment = (assign: StrengthAssignment) => {
    const sessionItems = assign.items ?? [];
    if (sessionItems.length === 0) {
      toast({
        title: "Séance vide",
        description: "Aucun exercice n'est disponible pour cette séance.",
      });
      return;
    }
    handleStartAssignment(assign, cycleType);
    setActiveRunId(null);
    setActiveRunLogs(null);
  };

  const startCatalogSession = (session: StrengthSessionTemplate) => {
    const sessionItems = session.items ?? [];
    const filteredItems = sessionItems.filter((item) => item.cycle_type === cycleType);
    const cycle =
      filteredItems.length > 0
        ? cycleType
        : normalizeStrengthCycle(session.cycle ?? sessionItems.find((item) => item.cycle_type)?.cycle_type);
    const items = resolveStrengthItems(sessionItems, cycle, exerciseLookup);
    if (items.length === 0) {
      toast({
        title: "Séance vide",
        description: "Aucun exercice n'est disponible pour cette séance.",
      });
      return;
    }
    setActiveSession({ ...session, cycle, items });
    setActiveAssignment(null);
    setActiveRunId(null);
    setActiveRunLogs(null);
    setActiveRunnerStep(0);
    setScreenMode("reader");
  };

  const handleLaunchFocus = () => {
    if (!activeSession) return;
    if (activeFilteredItems.length === 0) {
      toast({
        title: "Séance vide",
        description: "Aucun exercice n'est disponible pour cette séance.",
      });
      return;
    }
    setActiveSession({
      ...activeSession,
      cycle: cycleType,
      items: activeFilteredItems,
    });
    setActiveRunnerStep(0);
    setScreenMode("focus");
  };

  // Escape key handler for reader mode
  useEffect(() => {
    if (screenMode !== "reader") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setScreenMode("list");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screenMode]);

  const isLoading = assignmentsLoading || catalogLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-semibold">Impossible de charger les données</h3>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        <Button variant="default" onClick={() => refetch()} className="mt-4 h-12 md:h-10">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-4 md:space-y-6",
        poolMode && "dark bg-background text-foreground contrast-125",
        largeText && "text-lg leading-relaxed [&_.text-xs]:text-sm [&_.text-sm]:text-base",
      )}
    >
      {screenMode === "focus" && activeSession ? (
        exercises ? (
          <div className="animate-in fade-in motion-reduce:animate-none">
            <WorkoutRunner
              session={activeSession}
              exercises={exercises}
              oneRMs={oneRMs || []}
              exerciseNotes={exerciseNotes}
              onUpdateNote={(exerciseId, note) => updateNote.mutate({ exercise_id: exerciseId, notes: note })}
              initialLogs={activeRunLogs}
              initialStep={activeRunnerStep}
              isFinishing={isFinishing}
              onStepChange={(step) => setActiveRunnerStep(step)}
              onExitFocus={() => setScreenMode("reader")}
              onStart={async () => {
                if (activeRunId) return;
                const sessionId = activeAssignment?.session_id ?? activeSession?.id ?? null;
                if (!sessionId) {
                  toast({
                    title: "Session manquante",
                    description: "Impossible de démarrer sans session associée.",
                    variant: "destructive",
                  });
                  return;
                }
                const payload = {
                  assignment_id: activeAssignment?.id ?? null,
                  athlete_id: userId ?? null,
                  athleteName: user ?? undefined,
                  progress_pct: 0,
                  session_id: sessionId,
                  cycle_type: activeSession?.cycle,
                };
                try {
                  const res = await startRun.mutateAsync(payload);
                  if (res?.run_id) {
                    setActiveRunId(res.run_id);
                  }
                } catch {
                  return;
                }
              }}
              onLogSets={async (blockLogs) => {
                if (!activeRunId) return;
                setActiveRunLogs((prev) => [...(prev ?? []), ...blockLogs]);
                await Promise.all(
                  blockLogs.map((log: SetLogEntry, index: number) =>
                    logStrengthSet.mutateAsync({
                      run_id: activeRunId,
                      exercise_id: log.exercise_id,
                      set_index: log.set_number ?? index + 1,
                      reps: log.reps ?? null,
                      weight: log.weight ?? null,
                      athlete_id: userId ?? null,
                      athlete_name: user ?? null,
                    }),
                  ),
                );
              }}
              onProgress={async (progressPct) => {
                if (!activeRunId) return;
                await updateRun.mutateAsync({
                  run_id: activeRunId,
                  progress_pct: progressPct,
                  status: "in_progress",
                });
              }}
              onFinish={(result) => {
                if (!activeRunId) return;
                setIsFinishing(true);
                updateRun.mutate({
                  assignment_id: activeAssignment?.id ?? undefined,
                  run_id: activeRunId,
                  session_id: activeAssignment?.session_id ?? activeSession?.id ?? undefined,
                  athlete_id: userId ?? undefined,
                  date: new Date().toISOString(),
                  progress_pct: 100,
                  status: "completed",
                  ...result,
                });
              }}
            />
          </div>
        ) : (
          <div className="space-y-4 py-10">
            <div className="mx-auto h-8 w-48 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="mx-auto h-4 w-32 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="space-y-3 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Musculation</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Informations sur le calcul du 1RM"
                onClick={() => { window.location.hash = "#/records?tab=1rm"; }}
                className="text-muted-foreground"
              >
                <Dumbbell className="mr-2 h-4 w-4" /> Info 1RM
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setScreenMode("settings")}
                className="rounded-full border border-muted/50 text-muted-foreground"
                aria-label="Paramètres"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="start" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="start">S'entraîner</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="start" className="space-y-5 pt-4">
              {screenMode === "list" && (
                <SessionList
                  user={user}
                  userId={userId}
                  athleteName={historyAthleteName}
                  athleteId={historyAthleteId}
                  athleteKey={historyAthleteKey}
                  cycleType={cycleType}
                  searchQuery={searchQuery}
                  isLoading={isListLoading}
                  setSaveState={setSaveState}
                  onCycleChange={setCycleType}
                  onSearchChange={setSearchQuery}
                  onStartAssignment={(assignment) => {
                    if (assignment.session_type === "strength") {
                      startAssignment(assignment as StrengthAssignment);
                    }
                  }}
                  onStartCatalog={startCatalogSession}
                  onResumeInProgress={({ assignment, session, runId, logs, progressPct }) => {
                    setActiveAssignment(assignment);
                    setActiveSession(session);
                    setActiveRunId(runId);
                    setActiveRunLogs(logs);
                    setActiveRunnerStep(resolveNextStep(session?.items ?? [], logs, progressPct));
                    setScreenMode("focus");
                  }}
                />
              )}

              {screenMode === "settings" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScreenMode("list")}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Retour
                    </Button>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Préférences</p>
                      <h2 className="text-2xl font-display font-bold uppercase text-primary">Paramètres</h2>
                    </div>
                  </div>

                  <Card className="border border-muted/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg uppercase">Lisibilité & contrastes</CardTitle>
                      <CardDescription>
                        Ajuste l'écran pour rester lisible en bassin comme en extérieur.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold uppercase">Mode piscine</p>
                          <p className="text-sm text-muted-foreground">
                            Contraste renforcé et lisibilité optimisée.
                          </p>
                        </div>
                        <Switch
                          checked={poolMode}
                          onCheckedChange={(value) =>
                            setPreferences((prev) => ({ ...prev, poolMode: value }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold uppercase">Texte grand</p>
                          <p className="text-sm text-muted-foreground">
                            Police plus large pour lire pendant l'effort.
                          </p>
                        </div>
                        <Switch
                          checked={largeText}
                          onCheckedChange={(value) =>
                            setPreferences((prev) => ({ ...prev, largeText: value }))
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-muted/60 shadow-sm">
                    <CardContent className="space-y-3 pt-6">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>Les préférences sont enregistrées sur cet appareil.</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        {poolMode && <Badge variant="secondary">Mode piscine activé</Badge>}
                        {largeText && <Badge variant="secondary">Texte grand activé</Badge>}
                        {!poolMode && !largeText && <Badge variant="outline">Réglages par défaut</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {screenMode === "reader" && activeSession && exercises && (
                <SessionDetailPreview
                  session={activeSession}
                  assignment={activeAssignment}
                  cycleType={cycleType}
                  cycleOptions={cycleOptions}
                  exercises={exercises}
                  oneRMs={oneRMs || []}
                  saveState={saveState}
                  onBack={() => setScreenMode("list")}
                  onLaunch={handleLaunchFocus}
                />
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 pt-4">
              <HistoryTable
                athleteName={historyAthleteName}
                athleteId={historyAthleteId}
                athleteKey={historyAthleteKey}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

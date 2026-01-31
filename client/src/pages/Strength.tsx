import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, StrengthCycleType, StrengthSessionTemplate, StrengthSessionItem, Exercise, Assignment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Dumbbell, Calendar, Search, SlidersHorizontal, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { WorkoutRunner, resolveNextStep } from "@/components/strength/WorkoutRunner";

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

const formatStrengthValue = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return String(numeric);
};

const formatStrengthSeconds = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return `${numeric}s`;
};

export const orderStrengthItems = (items: StrengthSessionItem[] = []) => {
  if (!items.length) return items;
  const indexed = items.map((item, index) => {
    const order = Number(item.order_index);
    return {
      item,
      index,
      order: Number.isFinite(order) ? order : null,
    };
  });
  const hasOrder = indexed.some((entry) => entry.order !== null);
  if (!hasOrder) return items;
  return indexed
    .sort((a, b) => {
      if (a.order === null && b.order === null) return a.index - b.index;
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      if (a.order === b.order) return a.index - b.index;
      return a.order - b.order;
    })
    .map((entry) => entry.item);
};

const getCycleItems = (items: StrengthSessionTemplate["items"] = [], cycle: StrengthCycleType) => {
  const filtered = items.filter((item) => item.cycle_type === cycle);
  const cycleItems = filtered.length ? filtered : items;
  return orderStrengthItems(cycleItems);
};

export const resetStrengthRunState = (setters: {
  setActiveSession: (value: StrengthSessionTemplate | null) => void;
  setActiveAssignment: (value: Assignment | null) => void;
  setActiveRunId: (value: number | null) => void;
  setActiveRunLogs: (value: any[] | null) => void;
  setActiveRunnerStep: (value: number) => void;
  setScreenMode: (value: "list" | "reader" | "focus" | "settings") => void;
}) => {
  setters.setActiveSession(null);
  setters.setActiveAssignment(null);
  setters.setActiveRunId(null);
  setters.setActiveRunLogs(null);
  setters.setActiveRunnerStep(0);
  setters.setScreenMode("list");
};

export const createInProgressRun = ({
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

export const buildInProgressRunCache = (run: ReturnType<typeof createInProgressRun> | null) => ({
  runs: run ? [run] : [],
  pagination: { limit: 1, offset: 0, total: run ? 1 : 0 },
  exercise_summary: [],
});

export default function Strength() {
  const { user, userId, role, selectedAthleteId, selectedAthleteName } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const preferenceStorageKey = "strength-preferences";
  const [activeSession, setActiveSession] = useState<StrengthSessionTemplate | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [activeRunLogs, setActiveRunLogs] = useState<any[] | null>(null);
  const [activeRunnerStep, setActiveRunnerStep] = useState(0);
  const [screenMode, setScreenMode] = useState<"list" | "reader" | "focus" | "settings">("list");
  const [preferences, setPreferences] = useState({
    poolMode: false,
    largeText: false,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [cycleType, setCycleType] = useState<StrengthCycleType>("endurance");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const hasCoachSelection =
    (role === "coach" || role === "admin") &&
    (selectedAthleteId !== null || !!selectedAthleteName);
  const historyAthleteName = hasCoachSelection ? selectedAthleteName : user;
  const historyAthleteId = hasCoachSelection ? selectedAthleteId : userId;
  const historyAthleteKey = historyAthleteId ?? historyAthleteName;
  const focusStorageKey = useMemo(
    () => `strength-focus-state-${historyAthleteKey ?? "anonymous"}`,
    [historyAthleteKey],
  );
  const { poolMode, largeText } = preferences;

  useEffect(() => {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(preferenceStorageKey);
      if (!stored) return;
      try {
          const parsed = JSON.parse(stored);
          setPreferences((prev) => ({
              ...prev,
              ...(parsed ?? {}),
          }));
      } catch {
          return;
      }
  }, []);

  useEffect(() => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
  }, [preferenceStorageKey, preferences]);

  useEffect(() => {
      if (typeof document === "undefined") return;
      if (screenMode === "focus") {
        document.body.dataset.focusMode = "strength";
        return () => {
          if (document.body.dataset.focusMode === "strength") {
            delete document.body.dataset.focusMode;
          }
        };
      }
      if (document.body.dataset.focusMode === "strength") {
        delete document.body.dataset.focusMode;
      }
      return;
  }, [screenMode]);

  useEffect(() => {
      if (typeof window === "undefined") return;
      if (activeSession) return;
      const stored = window.localStorage.getItem(focusStorageKey);
      if (!stored) return;
      try {
          const parsed = JSON.parse(stored);
          const parsedMode = parsed?.screenMode === "focus" ? "focus" : parsed?.screenMode === "reader" ? "reader" : null;
          if (!parsedMode || !parsed?.session) return;
          setActiveSession(parsed.session);
          setActiveAssignment(parsed.assignment ?? null);
          setActiveRunId(typeof parsed.runId === "number" ? parsed.runId : null);
          setActiveRunLogs(Array.isArray(parsed.runLogs) ? parsed.runLogs : null);
          setActiveRunnerStep(Number.isFinite(parsed.runnerStep) ? parsed.runnerStep : 0);
          if (parsed.cycleType) {
            setCycleType(normalizeStrengthCycle(parsed.cycleType));
          }
          setScreenMode(parsedMode);
      } catch {
          return;
      }
  }, [activeSession, focusStorageKey]);

  useEffect(() => {
      if (typeof window === "undefined") return;
      const shouldPersist = screenMode === "focus" || screenMode === "reader";
      if (!shouldPersist || !activeSession) {
        window.localStorage.removeItem(focusStorageKey);
        return;
      }
      const payload = {
        screenMode,
        session: activeSession,
        assignment: activeAssignment,
        runId: activeRunId,
        runLogs: activeRunLogs,
        runnerStep: activeRunnerStep,
        cycleType,
      };
      window.localStorage.setItem(focusStorageKey, JSON.stringify(payload));
  }, [
      activeAssignment,
      activeRunId,
      activeRunLogs,
      activeRunnerStep,
      activeSession,
      cycleType,
      focusStorageKey,
      screenMode,
  ]);

  // Queries
  const { data: assignments } = useQuery({ 
      queryKey: ["assignments", user, "strength"], 
      queryFn: () => api.getAssignments(user!, userId, { assignmentType: "strength" }), 
      enabled: !!user 
  });
  const { data: strengthCatalog } = useQuery({
      queryKey: ["strength_catalog"],
      queryFn: () => api.getStrengthSessions(),
  });
  
  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.getExercises() });
  const { data: oneRMs } = useQuery({
      queryKey: ["1rm", user, userId],
      queryFn: () => api.get1RM({ athleteName: user, athleteId: userId }),
      enabled: !!user
  });
  const strengthHistoryQuery = useInfiniteQuery({
      queryKey: ["strength_history", historyAthleteKey, historyStatus, historyFrom, historyTo],
      queryFn: ({ pageParam = 0 }) =>
        api.getStrengthHistory(historyAthleteName!, {
          athleteId: historyAthleteId,
          limit: 10,
          offset: pageParam,
          order: "desc",
          status: historyStatus === "all" ? undefined : historyStatus,
          from: historyFrom || undefined,
          to: historyTo || undefined,
        }),
      enabled: !!historyAthleteName,
      getNextPageParam: (lastPage) => {
          const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
          return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
      },
      initialPageParam: 0
  });
  const historyRuns = strengthHistoryQuery.data?.pages.flatMap((page) => page.runs) ?? [];
  const inProgressRunQuery = useQuery({
      queryKey: ["strength_run_in_progress", historyAthleteKey],
      queryFn: () =>
          api.getStrengthHistory(historyAthleteName!, {
              limit: 1,
              offset: 0,
              order: "desc",
              status: "in_progress",
              athleteId: historyAthleteId,
          }),
      enabled: !!historyAthleteName,
  });
  const inProgressRun = inProgressRunQuery.data?.runs?.[0] ?? null;
  const inProgressRunCompleted =
    inProgressRun?.status === "completed" || (inProgressRun?.progress_pct ?? 0) >= 100;

  const startRun = useMutation({
      mutationFn: (data: any) => api.startStrengthRun(data),
      onSuccess: (data) => {
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
          toast({ title: "Erreur", description: "Impossible de démarrer la séance.", variant: "destructive" });
      },
  });

  const logStrengthSet = useMutation({
      mutationFn: (data: any) => api.logStrengthSet(data),
      onSuccess: (data) => {
          if (data?.one_rm_updated) {
              queryClient.invalidateQueries({ queryKey: ["1rm", user, userId] });
              toast({
                  title: "Nouveau 1RM détecté",
                  description: "Ton record vient d'être mis à jour.",
              });
          }
      },
      onError: () => {
          toast({
              title: "Erreur",
              description: "Impossible d'enregistrer une série.",
              variant: "destructive",
          });
      },
  });

  const updateRun = useMutation({
      mutationFn: (data: any) => api.updateStrengthRun(data),
      onSuccess: (_data, variables) => {
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
          queryClient.invalidateQueries({ queryKey: ["assignments", user, "strength"] }); // Update status
          queryClient.invalidateQueries({ queryKey: ["1rm", user, userId] });
          setActiveAssignment(null);
          setActiveRunId(null);
          setActiveSession(null);
          setActiveRunLogs(null);
          setScreenMode("list");
          toast({ title: "Séance sauvegardée", description: "Bravo pour l'effort !" });
      }
  });

  const startStrengthRun = useMutation({
      mutationFn: (data: any) => api.startStrengthRun(data),
      onError: () => {
          toast({
              title: "Erreur",
              description: "Impossible de mettre à jour la séance.",
              variant: "destructive",
          });
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

  // Filter strength assignments
  const strengthAssignments =
      assignments?.filter((assignment): assignment is StrengthAssignment => assignment.session_type === "strength") || [];
  const activeStrengthAssignments = strengthAssignments.filter((assignment) => assignment.status !== "completed");
  const inProgressAssignment = inProgressRun
      ? activeStrengthAssignments.find((assignment) => assignment.id === inProgressRun.assignment_id)
      : null;
  const canResumeInProgress = Boolean(inProgressAssignment?.items?.length) && !inProgressRunCompleted;
  const mergedAssignments: Array<StrengthAssignment & { session: StrengthSessionTemplate }> = activeStrengthAssignments.map(
      (assignment) => ({
        ...assignment,
        session: {
          id: assignment.session_id,
          title: assignment.title,
          description: assignment.description,
          cycle: normalizeStrengthCycle(assignment.cycle),
          items: assignment.items ?? [],
        },
      }),
  );
  const cycleOptions: Array<{ value: StrengthCycleType; label: string }> = [
      { value: "endurance", label: "Endurance" },
      { value: "hypertrophie", label: "Hypertrophie" },
      { value: "force", label: "Force" },
  ];
  const exerciseLookup = useMemo(() => {
      if (!exercises) return new Map<number, Exercise>();
      return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);
  const assignedDisplaySessions = mergedAssignments.map((assign) => {
      const sessionItems = resolveStrengthItems(assign.items ?? [], cycleType, exerciseLookup);
      return {
          key: `assignment-${assign.id}`,
          title: assign.title,
          description: assign.description,
          type: "assignment" as const,
          assignedDate: assign.assigned_date,
          session: {
              id: assign.session_id,
              title: assign.title,
              description: assign.description,
              cycle: normalizeStrengthCycle(assign.cycle),
              items: sessionItems,
          },
          assignment: assign,
          exerciseCount: sessionItems.length,
      };
  });
  const catalogDisplaySessions = (strengthCatalog ?? []).map((session) => {
      const sessionItems = resolveStrengthItems(session.items ?? [], cycleType, exerciseLookup);
      return {
          key: `catalog-${session.id}`,
          title: session.title,
          description: session.description,
          type: "catalog" as const,
          session: { ...session, items: sessionItems, cycle: cycleType },
          exerciseCount: sessionItems.length,
      };
  });
  const searchValue = searchQuery.trim().toLowerCase();
  const filteredDisplaySessions = [...assignedDisplaySessions, ...catalogDisplaySessions].filter((session) => {
      if (!searchValue) return true;
      return `${session.title} ${session.description}`.toLowerCase().includes(searchValue);
  });
  const activeFilteredItems = useMemo(() => {
      if (!activeSession) return [];
      return resolveStrengthItems(activeSession.items ?? [], cycleType, exerciseLookup);
  }, [activeSession, cycleType, exerciseLookup]);
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

  const clearActiveRunState = () => {
    resetStrengthRunState({
      setActiveSession,
      setActiveAssignment,
      setActiveRunId,
      setActiveRunLogs,
      setActiveRunnerStep,
      setScreenMode,
    });
  };

  const deleteStrengthRun = useMutation({
    mutationFn: (runId: number) => api.deleteStrengthRun(runId),
    onSuccess: (data) => {
      clearActiveRunState();
      if (historyAthleteKey) {
        queryClient.setQueryData(
          ["strength_run_in_progress", historyAthleteKey],
          buildInProgressRunCache(null),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["strength_run_in_progress", historyAthleteKey] });
      queryClient.invalidateQueries({ queryKey: ["strength_history"] });
      queryClient.invalidateQueries({ queryKey: ["assignments", user, "strength"] });
      const fallbackMessage =
        data?.source === "local_fallback"
          ? "Suppression locale : l'endpoint n'est pas disponible."
          : undefined;
      toast({
        title: "Séance supprimée",
        description: fallbackMessage,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la séance en cours.",
        variant: "destructive",
      });
    },
  });

  return (
    <div
      className={cn(
        "space-y-4 md:space-y-6",
        poolMode && "bg-slate-950 text-slate-50 contrast-125 [&_.text-muted-foreground]:text-slate-300",
        largeText && "text-lg leading-relaxed [&_.text-xs]:text-sm [&_.text-sm]:text-base",
      )}
    >
       {screenMode === "focus" && activeSession ? (
           exercises ? (
               <div className="animate-in fade-in">
                   <WorkoutRunner 
                 session={activeSession} 
                 exercises={exercises} 
                 oneRMs={oneRMs || []}
                 initialLogs={activeRunLogs}
                 initialStep={activeRunnerStep}
                 isFinishing={updateRun.isPending}
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
                         athleteName: user ?? null,
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
                         blockLogs.map((log: any, index: number) =>
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
                     updateRun.mutate({
                         assignment_id: activeAssignment?.id ?? null,
                         run_id: activeRunId,
                         session_id: activeAssignment?.session_id ?? activeSession?.id ?? null,
                         athlete_id: userId ?? null,
                         date: new Date().toISOString(),
                         progress_pct: 100,
                         status: "completed",
                         ...result,
                     });
                 }}
                   />
               </div>
           ) : (
               <div className="py-10 text-center text-muted-foreground">Chargement du focus...</div>
           )
       ) : (
       <>
       <div className="flex items-center justify-between">
            <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Musculation</h1>
            <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast({ title: "Info", description: "Le 1RM est calculé automatiquement." })}
                  className="text-muted-foreground"
                >
                    <Dumbbell className="mr-2 h-4 w-4"/> Info 1RM
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
           
           <TabsContent value="start" className="space-y-4 pt-4 md:space-y-6">
               {screenMode === "list" && (
                   <div className="space-y-4 md:space-y-6 animate-in fade-in">
                       <div className="flex items-center justify-between">
                           <div>
                               <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Séances</p>
                               <h2 className="text-2xl font-display font-bold uppercase text-primary">Musculation</h2>
                           </div>
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => setScreenMode("settings")}
                             className="rounded-full border border-muted/50 text-muted-foreground"
                             aria-label="Ouvrir les réglages"
                           >
                               <SlidersHorizontal className="h-4 w-4" />
                           </Button>
                       </div>

                       <Card className="border border-muted/60 shadow-sm">
                           <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_220px]">
                               <div className="space-y-2">
                                   <Label htmlFor="strength-search">Recherche</Label>
                                   <div className="relative">
                                       <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                       <Input
                                         id="strength-search"
                                         placeholder="Chercher une séance ou un objectif"
                                         className="h-11 rounded-full bg-muted/30 pl-11"
                                         value={searchQuery}
                                         onChange={(event) => setSearchQuery(event.target.value)}
                                       />
                                   </div>
                               </div>
                               <div className="space-y-2">
                                   <Label htmlFor="strength-cycle-select">Cycle</Label>
                                   <Select
                                       value={cycleType}
                                       onValueChange={(value) => setCycleType(normalizeStrengthCycle(value))}
                                   >
                                       <SelectTrigger id="strength-cycle-select" className="h-11 rounded-full bg-muted/30">
                                           <SelectValue placeholder="Sélectionner un cycle" />
                                       </SelectTrigger>
                                       <SelectContent>
                                           {cycleOptions.map((option) => (
                                               <SelectItem key={option.value} value={option.value}>
                                                   {option.label}
                                               </SelectItem>
                                           ))}
                                       </SelectContent>
                                   </Select>
                               </div>
                           </CardContent>
                       </Card>

                       {inProgressRun && (
                           <Card className="border-l-4 border-l-amber-500 bg-amber-50/40">
                               <CardHeader>
                                   <div className="flex items-center justify-between">
                                       <div>
                                           <Badge variant={inProgressRunCompleted ? "default" : "secondary"} className="mb-2">
                                             {inProgressRunCompleted ? "Séance complétée" : "Séance en cours"}
                                           </Badge>
                                           <CardTitle className="text-xl uppercase">
                                             {inProgressAssignment?.title ?? "Séance en cours"}
                                           </CardTitle>
                                           <CardDescription>
                                               Démarrée le {format(new Date(inProgressRun.started_at || new Date()), "dd/MM")}
                                           </CardDescription>
                                       </div>
                                       <div className="text-right text-sm font-mono font-bold text-muted-foreground">
                                           {Math.round(inProgressRun.progress_pct ?? 0)}%
                                       </div>
                                   </div>
                               </CardHeader>
                               <CardFooter>
                                   <div className="flex w-full flex-col gap-2 sm:flex-row">
                                     <Button
                                       className="w-full"
                                       disabled={!canResumeInProgress}
                                       onClick={() => {
                                         if (!inProgressAssignment) return;
                                         const sessionItems = inProgressAssignment.items ?? [];
                                         const cycle = normalizeStrengthCycle(
                                             inProgressAssignment.cycle ??
                                             sessionItems.find((item: any) => item.cycle_type)?.cycle_type,
                                         );
                                        const filteredItems = sessionItems.filter((item: any) => item.cycle_type === cycle);
                                        const items = orderStrengthItems(filteredItems.length ? filteredItems : sessionItems);
                                         setActiveAssignment(inProgressAssignment);
                                         setActiveSession({
                                             ...inProgressAssignment,
                                             title: inProgressAssignment.title,
                                             description: inProgressAssignment.description,
                                             cycle,
                                             items,
                                         });
                                         setActiveRunId(inProgressRun.id);
                                         setActiveRunLogs(inProgressRun.logs ?? []);
                                         setActiveRunnerStep(
                                             resolveNextStep(items, inProgressRun.logs ?? [], inProgressRun.progress_pct),
                                         );
                                         setScreenMode("focus");
                                       }}
                                     >
                                       {inProgressRunCompleted ? "Séance complétée" : "Reprendre la séance"}
                                     </Button>
                                     <Button
                                       variant="destructive"
                                       className="w-full"
                                       disabled={inProgressRunCompleted || deleteStrengthRun.isPending}
                                       onClick={() => {
                                         if (!inProgressRun) return;
                                         const confirmed = window.confirm(
                                           "Supprimer la séance en cours ? Cette action efface la progression.",
                                         );
                                         if (!confirmed) return;
                                         deleteStrengthRun.mutate(inProgressRun.id);
                                       }}
                                     >
                                       Supprimer la séance
                                     </Button>
                                   </div>
                               </CardFooter>
                           </Card>
                       )}

                       <div className="flex items-center justify-between">
                           <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                               <Calendar className="h-4 w-4 text-primary" /> Parcours des séances
                           </h3>
                           <Badge variant="outline">{filteredDisplaySessions.length} séances</Badge>
                       </div>

                       {filteredDisplaySessions.length > 0 ? (
                           <div className="grid gap-3 md:grid-cols-2">
                               {filteredDisplaySessions.map((session) => {
                                   const cycleLabel = cycleOptions.find((option) => option.value === cycleType)?.label ?? "Cycle";
                                   return (
                                       <Card
                                         key={session.key}
                                         className="border border-muted/60 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                         onClick={() => {
                                           if (session.type === "assignment") {
                                             startAssignment(session.assignment);
                                             return;
                                           }
                                           startCatalogSession(session.session);
                                         }}
                                       >
                                           <CardHeader className="pb-3">
                                               <div className="flex items-start justify-between gap-4">
                                                   <div className="space-y-2">
                                                       <div className="flex flex-wrap gap-2">
                                                           <Badge variant={session.type === "assignment" ? "default" : "secondary"}>
                                                               {session.type === "assignment" ? "Assignée" : "Catalogue"}
                                                           </Badge>
                                                           {session.type === "assignment" && session.assignedDate ? (
                                                               <Badge variant="outline">
                                                                   Prévu le {format(new Date(session.assignedDate), "dd/MM")}
                                                               </Badge>
                                                           ) : null}
                                                       </div>
                                                       <CardTitle className="text-lg uppercase">{session.title}</CardTitle>
                                                   </div>
                                                   <div className="flex h-9 w-9 items-center justify-center rounded-full border border-muted/60 text-muted-foreground">
                                                       <ChevronRight className="h-4 w-4" />
                                                   </div>
                                               </div>
                                               {session.description && (
                                                   <CardDescription className="line-clamp-2">
                                                       {session.description}
                                                   </CardDescription>
                                               )}
                                           </CardHeader>
                                           <CardContent className="flex flex-wrap gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                               <Badge variant="secondary" className="uppercase">
                                                   {session.exerciseCount} exercices
                                               </Badge>
                                               <Badge variant="outline">{cycleLabel}</Badge>
                                           </CardContent>
                                       </Card>
                                   );
                               })}
                           </div>
                       ) : (
                           <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                               <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                               <p>Aucune séance à afficher.</p>
                               <p className="text-sm mt-2">Essayez un autre mot-clé ou changez de cycle.</p>
                           </div>
                       )}
                   </div>
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

               {screenMode === "reader" && activeSession && (
                   <div className="space-y-4 md:space-y-6 animate-in fade-in">
                       <div className="flex flex-wrap items-center gap-3">
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => setScreenMode("list")}
                             className="gap-2"
                           >
                               <ChevronLeft className="h-4 w-4" />
                               Retour à la liste
                           </Button>
                           <Badge variant="outline">{cycleOptions.find((option) => option.value === cycleType)?.label}</Badge>
                           <Button onClick={handleLaunchFocus} className="ml-auto">
                               Focus
                           </Button>
                       </div>
                       <Card className="border-l-4 border-l-primary/70">
                           <CardHeader>
                               <div className="flex flex-wrap items-center gap-2">
                                   {activeAssignment && (
                                       <Badge variant="default">Assignée</Badge>
                                   )}
                                   {!activeAssignment && (
                                       <Badge variant="secondary">Catalogue</Badge>
                                   )}
                                   {activeAssignment?.assigned_date && (
                                       <Badge variant="outline">
                                           Prévue le {format(new Date(activeAssignment.assigned_date), "dd/MM")}
                                       </Badge>
                                   )}
                               </div>
                               <CardTitle className="text-2xl uppercase">{activeSession.title}</CardTitle>
                               <CardDescription>{activeSession.description}</CardDescription>
                           </CardHeader>
                           <CardContent className="space-y-4">
                               <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                   <Badge variant="secondary">{activeFilteredItems.length} exercices</Badge>
                                   <Badge variant="outline">{cycleOptions.find((option) => option.value === cycleType)?.label}</Badge>
                               </div>
                           </CardContent>
                           <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                               <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                   <span>Lecture complète</span>
                                   <span>•</span>
                                   <span>Focus pas-à-pas disponible</span>
                               </div>
                           </CardFooter>
                       </Card>

                       <div className="space-y-4">
                           {activeFilteredItems.map((item, index) => {
                               const exercise = exerciseLookup.get(item.exercise_id);
                               const percentValue = Number(item.percent_1rm);
                               const hasPercent = Number.isFinite(percentValue) && percentValue > 0;
                               const rm = hasPercent
                                   ? oneRMs?.find((entry: any) => entry.exercise_id === item.exercise_id)?.weight ?? 0
                                   : 0;
                               const targetWeight = hasPercent ? Math.round(rm * (percentValue / 100)) : 0;
                               const chargeLabel = hasPercent
                                   ? targetWeight > 0
                                       ? `${targetWeight} kg (${percentValue}% 1RM)`
                                       : `${percentValue}% 1RM`
                                   : "—";
                               const notes = item.notes?.trim();
                               return (
                                   <Card key={`${item.exercise_id}-${index}`} className="border-l-4 border-l-slate-300/60">
                                       <CardHeader className="pb-3">
                                           <div className="flex flex-wrap items-start justify-between gap-3">
                                               <div>
                                                   <Badge variant="outline" className="mb-2">
                                                       Bloc {index + 1}
                                                   </Badge>
                                                   <CardTitle className="text-lg uppercase">
                                                       {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                                                   </CardTitle>
                                                   <CardDescription>
                                                       {exercise?.exercise_type ? `Type : ${exercise.exercise_type}` : "Type : exercice"}
                                                   </CardDescription>
                                               </div>
                                               <Sheet>
                                                   <SheetTrigger asChild>
                                                       <Button variant="outline" size="sm">
                                                           Détails
                                                       </Button>
                                                   </SheetTrigger>
                                                   <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                                                       <SheetHeader>
                                                           <SheetTitle>
                                                               {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                                                           </SheetTitle>
                                                           <SheetDescription>
                                                               {exercise?.description ?? "Description indisponible pour cet exercice."}
                                                           </SheetDescription>
                                                       </SheetHeader>
                                                       <div className="mt-6 space-y-4 text-sm">
                                                           <div className="grid gap-3 sm:grid-cols-2">
                                                               <div className="rounded-md border bg-muted/30 p-3">
                                                                   <div className="text-[10px] uppercase text-muted-foreground font-semibold">Charge cible</div>
                                                                   <div className="text-base font-semibold">{chargeLabel}</div>
                                                               </div>
                                                               <div className="rounded-md border bg-muted/30 p-3">
                                                                   <div className="text-[10px] uppercase text-muted-foreground font-semibold">Repos</div>
                                                                   <div className="text-base font-semibold">
                                                                       {formatStrengthSeconds(item.rest_seconds)}
                                                                   </div>
                                                               </div>
                                                           </div>
                                                           <div className="rounded-md border bg-muted/30 p-3">
                                                               <div className="text-[10px] uppercase text-muted-foreground font-semibold">Notes coach</div>
                                                               <div className="text-sm text-muted-foreground">
                                                                   {notes || "Aucune note spécifique."}
                                                               </div>
                                                           </div>
                                                       </div>
                                                   </SheetContent>
                                               </Sheet>
                                           </div>
                                       </CardHeader>
                                       <CardContent className="grid gap-3 sm:grid-cols-4 text-sm">
                                           <div className="rounded-md border bg-muted/20 p-3">
                                               <div className="text-[10px] uppercase text-muted-foreground font-semibold">Séries</div>
                                               <div className="text-lg font-bold">{formatStrengthValue(item.sets)}</div>
                                           </div>
                                           <div className="rounded-md border bg-muted/20 p-3">
                                               <div className="text-[10px] uppercase text-muted-foreground font-semibold">Reps</div>
                                               <div className="text-lg font-bold">{formatStrengthValue(item.reps)}</div>
                                           </div>
                                           <div className="rounded-md border bg-muted/20 p-3">
                                               <div className="text-[10px] uppercase text-muted-foreground font-semibold">Repos</div>
                                               <div className="text-lg font-bold">
                                                   {formatStrengthSeconds(item.rest_seconds)}
                                               </div>
                                           </div>
                                           <div className="rounded-md border bg-muted/20 p-3">
                                               <div className="text-[10px] uppercase text-muted-foreground font-semibold">Charge cible</div>
                                               <div className="text-lg font-bold">{chargeLabel}</div>
                                           </div>
                                       </CardContent>
                                       <CardFooter className="flex flex-col gap-1 border-t text-sm text-muted-foreground">
                                           <span>Notes coach</span>
                                           <span>{notes || "Aucune note spécifique."}</span>
                                       </CardFooter>
                                   </Card>
                               );
                           })}
                           {activeFilteredItems.length === 0 && (
                               <div className="p-6 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                                   Aucun exercice disponible pour cette séance.
                               </div>
                           )}
                       </div>
                   </div>
               )}
           </TabsContent>
           
           <TabsContent value="history" className="space-y-4 pt-4">
               <div className="grid gap-3 md:grid-cols-3">
                   <div className="space-y-1">
                       <Label htmlFor="strength-history-status">Statut</Label>
                       <Select value={historyStatus} onValueChange={setHistoryStatus}>
                           <SelectTrigger id="strength-history-status">
                               <SelectValue placeholder="Tous" />
                           </SelectTrigger>
                           <SelectContent>
                               <SelectItem value="all">Tous</SelectItem>
                               <SelectItem value="in_progress">En cours</SelectItem>
                               <SelectItem value="completed">Terminé</SelectItem>
                               <SelectItem value="abandoned">Abandonné</SelectItem>
                           </SelectContent>
                       </Select>
                   </div>
                   <div className="space-y-1">
                       <Label htmlFor="strength-history-from">Du</Label>
                       <Input
                         id="strength-history-from"
                         type="date"
                         value={historyFrom}
                         onChange={(event) => setHistoryFrom(event.target.value)}
                       />
                   </div>
                   <div className="space-y-1">
                       <Label htmlFor="strength-history-to">Au</Label>
                       <Input
                         id="strength-history-to"
                         type="date"
                         value={historyTo}
                         onChange={(event) => setHistoryTo(event.target.value)}
                       />
                   </div>
               </div>
               {historyRuns.map((run: any) => (
                   <Card key={run.id} className="group hover:border-primary/50 transition-colors">
                       <CardHeader className="pb-2">
                           <div className="flex justify-between">
                                <CardTitle className="text-base font-bold uppercase">{format(new Date(run.started_at || run.date || run.created_at || new Date()), "dd MMM yyyy")}</CardTitle>
                                <div className="text-sm font-mono font-bold text-muted-foreground group-hover:text-primary">{run.duration ?? 0} min</div>
                           </div>
                           <div className="flex gap-2 text-xs font-bold text-muted-foreground">
                               <span>Difficulté {run.feeling ?? run.rpe ?? 0}/5</span>
                               <span>•</span>
                               <span>{run.logs?.length || 0} Séries</span>
                           </div>
                       </CardHeader>
                   </Card>
               ))}
               {historyRuns.length === 0 && <div className="text-center text-muted-foreground py-10">Aucun historique.</div>}
               {strengthHistoryQuery.hasNextPage && (
                   <Button
                     variant="outline"
                     size="sm"
                     className="w-full"
                     onClick={() => strengthHistoryQuery.fetchNextPage()}
                     disabled={strengthHistoryQuery.isFetchingNextPage}
                   >
                     {strengthHistoryQuery.isFetchingNextPage ? "Chargement..." : "Charger plus"}
                   </Button>
               )}
           </TabsContent>
       </Tabs>
       </>
       )}
    </div>
  );
}

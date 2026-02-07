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
import { ChevronLeft, ChevronRight, Dumbbell, Calendar, Search, SlidersHorizontal, Info, X, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WorkoutRunner, resolveNextStep } from "@/components/strength/WorkoutRunner";
import { BottomActionBar } from "@/components/shared/BottomActionBar";

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
        data?.source === "local"
          ? "Suppression locale : le serveur n'est pas disponible."
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
               <div className="space-y-4 py-10">
                 <div className="mx-auto h-8 w-48 rounded-lg bg-muted animate-pulse" />
                 <div className="mx-auto h-4 w-32 rounded-lg bg-muted animate-pulse" />
                 <div className="space-y-3 pt-4">
                   {[1, 2, 3].map((i) => (
                     <div key={i} className="h-20 w-full rounded-xl bg-muted animate-pulse" />
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
           
            <TabsContent value="start" className="space-y-5 pt-4">
                {screenMode === "list" && (
                    <div className="space-y-5 animate-in fade-in motion-reduce:animate-none">
                        {/* Session count */}
                        <p className="text-center text-sm text-muted-foreground py-1">
                            {filteredDisplaySessions.length} séance{filteredDisplaySessions.length > 1 ? "s" : ""} disponible{filteredDisplaySessions.length > 1 ? "s" : ""}
                        </p>

                        {/* Cycle selector - pill buttons */}
                        <div className="flex justify-center gap-2">
                            {cycleOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setCycleType(normalizeStrengthCycle(option.value))}
                                    className={cn(
                                        "px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95",
                                        cycleType === option.value
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {/* Search - minimal floating style */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Rechercher une séance..."
                                className="h-12 rounded-2xl bg-muted/30 pl-11 pr-4 border-0 shadow-sm focus-visible:ring-2"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                aria-label="Rechercher une séance"
                            />
                        </div>

                        {/* In-progress session - prominent card */}
                        {inProgressRun && (
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 p-5">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8" />
                                <div className="relative">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                            {inProgressRunCompleted ? "Complétée" : "En cours"}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold tracking-tight mb-1">
                                        {inProgressAssignment?.title ?? "Séance en cours"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Démarrée le {format(new Date(inProgressRun.started_at || new Date()), "dd MMMM", { locale: fr })}
                                    </p>
                                    
                                    {/* Progress bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                                            <span className="text-muted-foreground">Progression</span>
                                            <span className="text-primary">{Math.round(inProgressRun.progress_pct ?? 0)}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div 
                                                className="h-full rounded-full bg-primary transition-all duration-500"
                                                style={{ width: `${inProgressRun.progress_pct ?? 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 h-12 rounded-xl font-semibold"
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
                                            {inProgressRunCompleted ? "Voir le résumé" : "Reprendre"}
                                        </Button>
                                        {!inProgressRunCompleted && (
                                            <Button
                                                variant="outline"
                                                className="h-12 w-12 rounded-xl p-0"
                                                disabled={deleteStrengthRun.isPending}
                                                onClick={() => {
                                                    if (!inProgressRun) return;
                                                    const confirmed = window.confirm("Supprimer la séance en cours ?");
                                                    if (!confirmed) return;
                                                    deleteStrengthRun.mutate(inProgressRun.id);
                                                }}
                                                aria-label="Supprimer la séance"
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section header */}
                        {!inProgressRun && filteredDisplaySessions.length > 0 && (
                            <div className="flex items-center gap-2 pt-2">
                                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Choisir une séance
                                </span>
                            </div>
                        )}

                        {/* Sessions list - modern cards */}
                        {filteredDisplaySessions.length > 0 ? (
                            <div className="space-y-3">
                                {filteredDisplaySessions.map((session) => (
                                    <button
                                        key={session.key}
                                        type="button"
                                        className="group w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:shadow-md hover:border-primary/30"
                                        onClick={() => {
                                            if (session.type === "assignment") {
                                                startAssignment(session.assignment);
                                                return;
                                            }
                                            startCatalogSession(session.session);
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Icon */}
                                            <div className={cn(
                                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                                                session.type === "assignment" 
                                                    ? "bg-primary/10 text-primary" 
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                <Dumbbell className="h-5 w-5" />
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {session.type === "assignment" && (
                                                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                                            Assignée
                                                        </span>
                                                    )}
                                                    {session.type === "assignment" && session.assignedDate && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(session.assignedDate), "dd MMM", { locale: fr })}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-semibold tracking-tight truncate">
                                                    {session.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {session.exerciseCount} exercice{session.exerciseCount > 1 ? "s" : ""}
                                                    {session.description ? ` · ${session.description}` : ""}
                                                </p>
                                            </div>
                                            
                                            {/* Arrow */}
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                <Play className="h-4 w-4 ml-0.5" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <Dumbbell className="h-7 w-7 text-muted-foreground" />
                                </div>
                                <h3 className="font-semibold">Aucune séance</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Essayez un autre mot-clé ou changez de cycle.
                                </p>
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
                   <div className="space-y-5 animate-in fade-in motion-reduce:animate-none pb-40">
                       {/* Header compact avec retour */}
                       <div className="flex items-center gap-3">
                           <button
                             type="button"
                             onClick={() => setScreenMode("list")}
                             className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted active:scale-95"
                             aria-label="Retour"
                           >
                               <ChevronLeft className="h-5 w-5" />
                           </button>
                           <div className="flex-1 min-w-0">
                               <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                                   {cycleOptions.find((option) => option.value === cycleType)?.label}
                               </p>
                               <h1 className="text-xl font-bold tracking-tight truncate">{activeSession.title}</h1>
                           </div>
                       </div>

                       {/* Hero card avec infos clés */}
                       <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-5">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12" />
                           <div className="relative space-y-4">
                               {/* Badges */}
                               <div className="flex flex-wrap items-center gap-2">
                                   {activeAssignment && (
                                       <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase text-primary">
                                           <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                           Assignée
                                       </span>
                                   )}
                                   {!activeAssignment && (
                                       <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                                           Catalogue
                                       </span>
                                   )}
                                   {activeAssignment?.assigned_date && (
                                       <span className="text-xs text-muted-foreground">
                                           Prévue le {format(new Date(activeAssignment.assigned_date), "dd MMM", { locale: fr })}
                                       </span>
                                   )}
                               </div>

                               {/* Description */}
                               {activeSession.description && (
                                   <p className="text-sm text-muted-foreground leading-relaxed">
                                       {activeSession.description}
                                   </p>
                               )}

                               {/* Stats row */}
                               <div className="flex items-center gap-4">
                                   <div className="flex items-center gap-2">
                                       <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80">
                                           <Dumbbell className="h-4 w-4 text-primary" />
                                       </div>
                                       <div>
                                           <p className="text-lg font-bold leading-none">{activeFilteredItems.length}</p>
                                           <p className="text-[10px] uppercase text-muted-foreground font-semibold">Exercices</p>
                                       </div>
                                   </div>
                                   <div className="h-8 w-px bg-border" />
                                   <div className="flex items-center gap-2">
                                       <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80">
                                           <Calendar className="h-4 w-4 text-muted-foreground" />
                                       </div>
                                       <div>
                                           <p className="text-lg font-bold leading-none">{cycleOptions.find((option) => option.value === cycleType)?.label}</p>
                                           <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cycle</p>
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </div>

                       {/* Section header */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                           <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {activeFilteredItems.length} exercice{activeFilteredItems.length > 1 ? "s" : ""}
                           </span>
                           <div className="flex-1 h-px bg-border" />
                       </div>

                       {/* Liste compacte d'exercices - mobile first */}
                       <div className="space-y-2">
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
                                   : null;
                               const notes = item.notes?.trim();
                               const setsVal = formatStrengthValue(item.sets);
                               const repsVal = formatStrengthValue(item.reps);
                               const restVal = formatStrengthSeconds(item.rest_seconds);

                               return (
                                   <Sheet key={`${item.exercise_id}-${index}`}>
                                       <SheetTrigger asChild>
                                           <button
                                               type="button"
                                               className="w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-all active:scale-[0.98] hover:border-primary/50 hover:shadow-sm"
                                           >
                                               {/* Numéro */}
                                               <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                                   {index + 1}
                                               </div>

                                               {/* Titre exercice */}
                                               <div className="flex-1 min-w-0">
                                                   <p className="font-semibold text-sm truncate">
                                                       {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                                                   </p>
                                               </div>

                                               {/* Stats compactes: séries×reps | repos */}
                                               <div className="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground">
                                                   <span className="font-mono">{setsVal}×{repsVal}</span>
                                                   <span className="text-border">|</span>
                                                   <span className="font-mono">{restVal}</span>
                                                   <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                               </div>
                                           </button>
                                       </SheetTrigger>

                                       {/* Fiche détaillée exercice */}
                                       <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl pb-8">
                                           <SheetHeader className="text-left pb-4">
                                               <div className="flex items-start gap-3">
                                                   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                                       {index + 1}
                                                   </div>
                                                   <div className="flex-1 min-w-0">
                                                       <SheetTitle className="text-xl leading-tight">
                                                           {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                                                       </SheetTitle>
                                                       {exercise?.exercise_type && (
                                                           <p className="text-sm text-muted-foreground mt-0.5">{exercise.exercise_type}</p>
                                                       )}
                                                   </div>
                                               </div>
                                           </SheetHeader>

                                           <div className="space-y-4">
                                               {/* GIF illustration - compact et chargement optimisé */}
                                               {exercise?.illustration_gif && (
                                                   <div className="rounded-xl overflow-hidden bg-muted/20 border aspect-video flex items-center justify-center">
                                                       <img
                                                           src={exercise.illustration_gif}
                                                           alt={exercise.nom_exercice ?? "Exercice"}
                                                           className="w-full h-full max-h-36 object-contain"
                                                           loading="lazy"
                                                           decoding="async"
                                                       />
                                                   </div>
                                               )}

                                               {/* Description */}
                                               {exercise?.description && (
                                                   <div className="text-sm text-muted-foreground leading-relaxed">
                                                       {exercise.description}
                                                   </div>
                                               )}

                                               {/* Stats grid 2×2 */}
                                               <div className="grid grid-cols-2 gap-2">
                                                   <div className="rounded-xl bg-muted/40 p-3 text-center">
                                                       <p className="text-2xl font-bold leading-none">{setsVal}</p>
                                                       <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Séries</p>
                                                   </div>
                                                   <div className="rounded-xl bg-muted/40 p-3 text-center">
                                                       <p className="text-2xl font-bold leading-none">{repsVal}</p>
                                                       <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Reps</p>
                                                   </div>
                                                   <div className="rounded-xl bg-muted/40 p-3 text-center">
                                                       <p className="text-lg font-bold leading-none">{chargeLabel ?? "—"}</p>
                                                       <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Charge</p>
                                                   </div>
                                                   <div className="rounded-xl bg-muted/40 p-3 text-center">
                                                       <p className="text-lg font-bold leading-none">{restVal}</p>
                                                       <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Repos</p>
                                                   </div>
                                               </div>

                                               {/* Notes coach */}
                                               {notes && (
                                                   <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                                                       <div className="text-[10px] uppercase text-primary font-semibold mb-1">Notes coach</div>
                                                       <div className="text-sm text-foreground">{notes}</div>
                                                   </div>
                                               )}
                                           </div>
                                       </SheetContent>
                                   </Sheet>
                               );
                           })}
                           {activeFilteredItems.length === 0 && (
                               <div className="p-6 border-2 border-dashed rounded-xl text-center text-muted-foreground">
                                   Aucun exercice disponible pour cette séance.
                               </div>
                           )}
                       </div>

                       {/* Bottom action bar fixe - plus visible */}
                       <BottomActionBar>
                           <Button
                               className="flex-1 h-14 rounded-xl font-bold text-base bg-primary hover:bg-primary/90 shadow-lg"
                               onClick={handleLaunchFocus}
                           >
                               <Play className="h-5 w-5 mr-2" />
                               Lancer la séance
                           </Button>
                       </BottomActionBar>
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
                                <CardTitle className="text-base font-bold uppercase">{format(new Date(run.started_at || run.date || run.created_at || new Date()), "dd MMM yyyy", { locale: fr })}</CardTitle>
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

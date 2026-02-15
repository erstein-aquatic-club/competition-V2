import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, StrengthCycleType, StrengthSessionTemplate, Assignment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dumbbell, Search, Play, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerChildren, listItem } from "@/lib/animations";
import { useToast } from "@/hooks/use-toast";
import { resolveNextStep } from "@/components/strength/WorkoutRunner";
import { orderStrengthItems } from "@/components/strength/utils";
import { SaveState } from "@/components/shared/BottomActionBar";
import type { LocalStrengthRun } from "@/lib/types";

const normalizeStrengthCycle = (value?: string | null): StrengthCycleType => {
  if (value === "endurance" || value === "hypertrophie" || value === "force") {
    return value;
  }
  return "endurance";
};

interface SessionListProps {
  user: string | null;
  userId: number | null;
  athleteName: string | null;
  athleteId: number | null;
  athleteKey: number | string | null;
  cycleType: StrengthCycleType;
  searchQuery: string;
  isLoading: boolean;
  setSaveState: (state: SaveState) => void;
  onCycleChange: (cycle: StrengthCycleType) => void;
  onSearchChange: (query: string) => void;
  onStartAssignment: (assignment: Assignment) => void;
  onStartCatalog: (session: StrengthSessionTemplate) => void;
  onResumeInProgress: (params: {
    assignment: Assignment | null;
    session: StrengthSessionTemplate | null;
    runId: number;
    logs: any[];
    progressPct: number;
  }) => void;
}

type DisplaySession = {
  key: string;
  title: string;
  description: string | null;
  type: "assignment" | "catalog";
  assignedDate?: string;
  session: StrengthSessionTemplate;
  assignment?: Assignment;
  exerciseCount: number;
};

export function SessionList({
  user,
  userId,
  athleteName,
  athleteId,
  athleteKey,
  cycleType,
  searchQuery,
  isLoading,
  setSaveState,
  onCycleChange,
  onSearchChange,
  onStartAssignment,
  onStartCatalog,
  onResumeInProgress,
}: SessionListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<number | null>(null);

  const cycleOptions: Array<{ value: StrengthCycleType; label: string }> = [
    { value: "endurance", label: "Endurance" },
    { value: "hypertrophie", label: "Hypertrophie" },
    { value: "force", label: "Force" },
  ];

  // Queries
  const { data: assignments } = useQuery({
    queryKey: ["assignments", user, "strength"],
    queryFn: () => api.getAssignments(user!, userId, { assignmentType: "strength" }),
    enabled: !!user,
  });

  const { data: strengthCatalog } = useQuery({
    queryKey: ["strength_catalog"],
    queryFn: () => api.getStrengthSessions(),
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.getExercises(),
  });

  const inProgressRunQuery = useQuery({
    queryKey: ["strength_run_in_progress", athleteKey],
    queryFn: () =>
      api.getStrengthHistory(athleteName!, {
        limit: 1,
        offset: 0,
        order: "desc",
        status: "in_progress",
        athleteId: athleteId,
      }),
    enabled: !!athleteName,
  });

  const inProgressRun = inProgressRunQuery.data?.runs?.[0] ?? null;
  const inProgressRunCompleted =
    inProgressRun?.status === "completed" || (inProgressRun?.progress_pct ?? 0) >= 100;

  const deleteStrengthRun = useMutation({
    mutationFn: (runId: number) => api.deleteStrengthRun(runId),
    onMutate: () => {
      setSaveState("saving");
    },
    onSuccess: (data) => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      queryClient.invalidateQueries({ queryKey: ["strength_run_in_progress", athleteKey] });
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
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la séance en cours.",
        variant: "destructive",
      });
    },
  });

  const exerciseLookup = useMemo(() => {
    if (!exercises) return new Map();
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  // Filter strength assignments
  const strengthAssignments = useMemo(() => {
    return (
      assignments?.filter(
        (assignment): assignment is Assignment & { session_type: "strength" } =>
          assignment.session_type === "strength"
      ) || []
    );
  }, [assignments]);

  const activeStrengthAssignments = useMemo(() => {
    return strengthAssignments.filter((assignment) => assignment.status !== "completed");
  }, [strengthAssignments]);

  const inProgressAssignment = useMemo(() => {
    return inProgressRun
      ? activeStrengthAssignments.find((assignment) => assignment.id === inProgressRun.assignment_id) ?? null
      : null;
  }, [inProgressRun, activeStrengthAssignments]);

  const inProgressSession = useMemo(() => {
    return inProgressRun && !inProgressAssignment
      ? strengthCatalog?.find((s) => s.id === inProgressRun.session_id) ?? null
      : null;
  }, [inProgressRun, inProgressAssignment, strengthCatalog]);

  const canResumeInProgress =
    (Boolean(inProgressAssignment?.items?.length) || Boolean(inProgressSession?.items?.length)) &&
    !inProgressRunCompleted;

  // Build display sessions
  const assignedDisplaySessions: DisplaySession[] = useMemo(() => {
    return activeStrengthAssignments.map((assign) => {
      const items = (assign.items ?? []).filter((item): item is any =>
        'exercise_id' in item
      );
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
          items: items,
        },
        assignment: assign,
        exerciseCount: items.length,
      };
    });
  }, [activeStrengthAssignments]);

  const catalogDisplaySessions: DisplaySession[] = useMemo(() => {
    return (strengthCatalog ?? []).map((session) => ({
      key: `catalog-${session.id}`,
      title: session.title,
      description: session.description,
      type: "catalog" as const,
      session: { ...session, cycle: cycleType },
      exerciseCount: session.items?.length ?? 0,
    }));
  }, [strengthCatalog, cycleType]);

  const filteredDisplaySessions = useMemo(() => {
    const searchValue = searchQuery.trim().toLowerCase();
    const allSessions = [...assignedDisplaySessions, ...catalogDisplaySessions];
    if (!searchValue) return allSessions;
    return allSessions.filter((session) =>
      `${session.title} ${session.description}`.toLowerCase().includes(searchValue)
    );
  }, [assignedDisplaySessions, catalogDisplaySessions, searchQuery]);

  const handleSessionListKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      const navKeys = ["ArrowUp", "ArrowDown", "Enter"];
      if (!navKeys.includes(e.key)) return;

      e.preventDefault();

      if (e.key === "Enter") {
        const session = filteredDisplaySessions[currentIndex];
        if (session.type === "assignment" && session.assignment) {
          onStartAssignment(session.assignment);
        } else {
          onStartCatalog(session.session);
        }
        return;
      }

      let nextIndex = currentIndex;
      if (e.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
      if (e.key === "ArrowDown") nextIndex = Math.min(filteredDisplaySessions.length - 1, currentIndex + 1);

      setSelectedSessionIndex(nextIndex);

      // Focus the next session card
      setTimeout(() => {
        const cards = document.querySelectorAll('[data-session-card="true"]');
        if (cards[nextIndex]) {
          (cards[nextIndex] as HTMLElement).focus();
        }
      }, 0);
    },
    [filteredDisplaySessions, onStartAssignment, onStartCatalog]
  );

  if (isLoading) {
    return (
      <div className="space-y-5 pt-4">
        {/* Cycle selector skeleton */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-28 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
        {/* Search skeleton */}
        <div className="h-12 rounded-2xl bg-muted/30 animate-pulse" />
        {/* Session cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 shrink-0 rounded-xl bg-muted animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-10 w-10 shrink-0 rounded-full bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in motion-reduce:animate-none">
      {/* Session count */}
      <p className="text-center text-sm text-muted-foreground py-1">
        {filteredDisplaySessions.length} séance{filteredDisplaySessions.length > 1 ? "s" : ""}{" "}
        disponible{filteredDisplaySessions.length > 1 ? "s" : ""}
      </p>

      {/* Cycle selector - pill buttons */}
      <div className="flex justify-center gap-2">
        {cycleOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onCycleChange(normalizeStrengthCycle(option.value))}
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
      <p className="text-center text-[11px] text-muted-foreground">
        {cycleType === "endurance" && "Beaucoup de reps, charges légères"}
        {cycleType === "hypertrophie" && "Reps et charges modérées"}
        {cycleType === "force" && "Peu de reps, charges lourdes"}
      </p>

      {/* Search - minimal floating style */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Rechercher une séance..."
          className="h-12 rounded-2xl bg-muted/30 pl-11 pr-4 border-0 shadow-sm focus-visible:ring-2"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
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
              Démarrée le{" "}
              {format(new Date(inProgressRun.started_at || new Date()), "dd MMMM", { locale: fr })}
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
                variant="default"
                className="flex-1 h-12 rounded-xl font-semibold"
                disabled={!canResumeInProgress}
                onClick={() => {
                  const source = inProgressAssignment ?? inProgressSession;
                  if (!source) return;
                  const sessionItems = (inProgressAssignment?.items ?? inProgressSession?.items) ?? [];
                  const strengthItems = sessionItems.filter((item): item is any => 'exercise_id' in item);
                  const cycle = normalizeStrengthCycle(
                    (inProgressAssignment?.cycle ?? inProgressSession?.cycle) ??
                      strengthItems.find((item) => item.cycle_type)?.cycle_type
                  );
                  const filteredItems = strengthItems.filter((item) => item.cycle_type === cycle);
                  const items = orderStrengthItems(filteredItems.length ? filteredItems : strengthItems);

                  onResumeInProgress({
                    assignment: inProgressAssignment ?? null,
                    session: {
                      ...source,
                      title: source.title,
                      description: source.description ?? null,
                      cycle,
                      items,
                    },
                    runId: inProgressRun.id,
                    logs: inProgressRun.logs ?? [],
                    progressPct: inProgressRun.progress_pct ?? 0,
                  });
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
                    setPendingDeleteRunId(inProgressRun.id);
                    setDeleteConfirmOpen(true);
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
        <motion.div
          className="space-y-3 motion-reduce:animate-none"
          variants={staggerChildren}
          initial="hidden"
          animate="visible"
        >
          {filteredDisplaySessions.map((session, index) => {
            const isFocused =
              selectedSessionIndex === index || (selectedSessionIndex === null && index === 0);
            return (
              <motion.button
                key={session.key}
                type="button"
                tabIndex={isFocused ? 0 : -1}
                data-session-card="true"
                onKeyDown={(e) => handleSessionListKeyDown(e, index)}
                variants={listItem}
                className={cn(
                  "group w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:shadow-md hover:border-primary/30 focus:outline-none motion-reduce:animate-none",
                  isFocused && "ring-2 ring-primary"
                )}
                onClick={() => {
                  if (session.type === "assignment" && session.assignment) {
                    onStartAssignment(session.assignment);
                    return;
                  }
                  onStartCatalog(session.session);
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      session.type === "assignment"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
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
                    <h3 className="font-semibold tracking-tight truncate">{session.title}</h3>
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
              </motion.button>
            );
          })}
        </motion.div>
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les séries déjà enregistrées seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteRunId) deleteStrengthRun.mutate(pendingDeleteRunId);
                setDeleteConfirmOpen(false);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

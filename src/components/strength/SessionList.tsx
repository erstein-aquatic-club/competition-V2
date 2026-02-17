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
import { ChevronRight, Dumbbell, Search, X, Flame, Zap, Weight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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

const cycleConfig = [
  {
    value: "endurance" as StrengthCycleType,
    label: "Endurance",
    subtitle: "Léger",
    icon: Flame,
  },
  {
    value: "hypertrophie" as StrengthCycleType,
    label: "Hypertrophie",
    subtitle: "Modéré",
    icon: Zap,
  },
  {
    value: "force" as StrengthCycleType,
    label: "Force",
    subtitle: "Lourd",
    icon: Weight,
  },
] as const;

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 30 },
  },
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
  const [searchOpen, setSearchOpen] = useState(false);

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
      <div className="space-y-5 pt-2">
        {/* Cycle selector skeleton */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[60px] rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
        {/* Session cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
                <div className="h-3 w-2/5 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalSessions = filteredDisplaySessions.length;
  const showSearch = totalSessions > 4 || searchQuery.length > 0;

  return (
    <div className="space-y-5 animate-in fade-in motion-reduce:animate-none">
      {/* ── Cycle selector ── */}
      <div className="grid grid-cols-3 gap-2">
        {cycleConfig.map((option) => {
          const active = cycleType === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onCycleChange(normalizeStrengthCycle(option.value))}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-2xl px-2 py-3 transition-all active:scale-[0.96]",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}
            >
              <Icon className={cn("h-4 w-4 mb-0.5", active ? "text-primary-foreground" : "text-muted-foreground/60")} />
              <span className="text-[13px] font-bold leading-tight">{option.label}</span>
              <span className={cn(
                "text-[10px] leading-tight",
                active ? "text-primary-foreground/70" : "text-muted-foreground/50"
              )}>
                {option.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── In-progress session — hero card ── */}
      {inProgressRun && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground p-5 shadow-xl shadow-primary/20"
        >
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5 blur-2xl" />

          <div className="relative">
            {/* Status badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                {!inProgressRunCompleted && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                )}
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                {inProgressRunCompleted ? "Complétée" : "En cours"}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-display text-xl font-bold uppercase tracking-tight leading-tight mb-1">
              {inProgressAssignment?.title ?? inProgressSession?.title ?? "Séance en cours"}
            </h3>
            <p className="text-sm text-white/50 mb-4">
              Démarrée le{" "}
              {format(new Date(inProgressRun.started_at || new Date()), "dd MMMM", { locale: fr })}
            </p>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
                <span className="text-white/50">Progression</span>
                <span className="text-white">{Math.round(inProgressRun.progress_pct ?? 0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${inProgressRun.progress_pct ?? 0}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 h-11 rounded-xl bg-white text-primary font-bold text-sm hover:bg-white/90 shadow-none"
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
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
                  disabled={deleteStrengthRun.isPending}
                  onClick={() => {
                    if (!inProgressRun) return;
                    setPendingDeleteRunId(inProgressRun.id);
                    setDeleteConfirmOpen(true);
                  }}
                  aria-label="Supprimer la séance"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Search ── */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <Input
            placeholder="Rechercher une séance..."
            className="h-11 rounded-2xl bg-muted/30 pl-10 pr-4 border-0 text-sm focus-visible:ring-2 focus-visible:ring-primary/30"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Rechercher une séance"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition"
              onClick={() => onSearchChange("")}
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Section header ── */}
      {totalSessions > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {totalSessions} séance{totalSessions > 1 ? "s" : ""}
          </span>
          <div className="flex-1 h-px bg-border/50" />
        </div>
      )}

      {/* ── Sessions list ── */}
      {totalSessions > 0 ? (
        <motion.div
          className="space-y-2.5 motion-reduce:animate-none"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {filteredDisplaySessions.map((session, index) => {
            const isFocused =
              selectedSessionIndex === index || (selectedSessionIndex === null && index === 0);
            const isAssignment = session.type === "assignment";
            return (
              <motion.button
                key={session.key}
                type="button"
                tabIndex={isFocused ? 0 : -1}
                data-session-card="true"
                onKeyDown={(e) => handleSessionListKeyDown(e, index)}
                variants={cardVariant}
                className={cn(
                  "group w-full rounded-2xl bg-card text-left transition-all active:scale-[0.98] hover:shadow-md focus:outline-none motion-reduce:animate-none",
                  isAssignment
                    ? "shadow-sm ring-1 ring-primary/10"
                    : "shadow-sm",
                  isFocused && "ring-2 ring-primary/40"
                )}
                onClick={() => {
                  if (isAssignment && session.assignment) {
                    onStartAssignment(session.assignment);
                    return;
                  }
                  onStartCatalog(session.session);
                }}
              >
                <div className="flex items-center gap-3.5 p-3.5">
                  {/* Exercise count badge */}
                  <div className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isAssignment
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/60 text-muted-foreground"
                  )}>
                    <span className={cn(
                      "font-display text-lg font-bold",
                      isAssignment && "text-primary"
                    )}>
                      {session.exerciseCount}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-display font-bold text-[15px] uppercase tracking-tight truncate leading-tight">
                        {session.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      {isAssignment && (
                        <>
                          <span className="inline-flex items-center rounded-md bg-primary/8 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-primary">
                            Coach
                          </span>
                          <span className="text-border">·</span>
                        </>
                      )}
                      <span>{session.exerciseCount} exercice{session.exerciseCount > 1 ? "s" : ""}</span>
                      {isAssignment && session.assignedDate && (
                        <>
                          <span className="text-border">·</span>
                          <span>{format(new Date(session.assignedDate), "dd MMM", { locale: fr })}</span>
                        </>
                      )}
                      {!isAssignment && session.description && (
                        <>
                          <span className="text-border">·</span>
                          <span className="truncate">{session.description}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-primary/60" />
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      ) : (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40">
            <Dumbbell className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <h3 className="font-display font-bold text-sm uppercase tracking-tight">Aucune séance trouvée</h3>
          <p className="text-[13px] text-muted-foreground/60 mt-1.5 max-w-[240px] mx-auto">
            Changez de cycle ou modifiez votre recherche pour trouver une séance.
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

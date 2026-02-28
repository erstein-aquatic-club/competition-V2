import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Interview,
  InterviewStatus,
  InterviewCoachInput,
  Objective,
  TrainingWeek,
  TrainingWeekInput,
  SwimmerPerformance,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  Send,
  Clock,
  MessageSquare,
  User,
  GraduationCap,
  Trophy,
  Target,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import {
  eventLabel,
  formatTime,
  findBestPerformance,
  computeProgress,
  STROKE_COLORS,
  strokeFromCode,
} from "@/lib/objectiveHelpers";
import { weekTypeColor, weekTypeTextColor } from "@/lib/weekTypeColor";

// ── Types ───────────────────────────────────────────────────────

interface Props {
  athleteId: number;
  athleteName: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

const STATUS_CONFIG: Record<InterviewStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  draft_athlete: {
    label: "En attente nageur",
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  draft_coach: {
    label: "Préparation coach",
    variant: "secondary",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  sent: {
    label: "Envoyé",
    variant: "secondary",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  signed: {
    label: "Signé",
    variant: "secondary",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
};

function getStatusBadge(status: InterviewStatus) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={`text-[10px] px-1.5 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

async function fetchAuthUidForUser(userId: number): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_auth_uid_for_user", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[interviews-tab] Failed to resolve auth UUID:", error.message);
    return null;
  }
  return data as string | null;
}

// ── Section Cards ───────────────────────────────────────────────

const AthleteSection = ({ label, text }: { label: string; text?: string | null }) => (
  <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-1">
    <div className="flex items-center gap-1.5">
      <User className="h-3.5 w-3.5 text-blue-500" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
    <p className="text-sm whitespace-pre-wrap">
      {text?.trim() || <span className="italic text-muted-foreground">Non renseigné</span>}
    </p>
  </div>
);

const CoachSectionReadOnly = ({ label, text }: { label: string; text?: string | null }) => (
  <div className="border-l-4 border-amber-400 rounded-r-lg bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1">
    <div className="flex items-center gap-1.5">
      <GraduationCap className="h-3.5 w-3.5 text-amber-500" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
    <p className="text-sm whitespace-pre-wrap">
      {text?.trim() || <span className="italic text-muted-foreground">Non renseigné</span>}
    </p>
  </div>
);

const CoachSectionEditable = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
}) => (
  <div className="border-l-4 border-amber-400 rounded-r-lg bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5">
    <div className="flex items-center gap-1.5">
      <GraduationCap className="h-3.5 w-3.5 text-amber-500" />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
    <Textarea
      className="bg-white dark:bg-background"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={rows}
    />
  </div>
);

const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 pt-3">
    <div className="h-px flex-1 bg-border" />
    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    <div className="h-px flex-1 bg-border" />
  </div>
);

// ── Objective Row (with best perf + delta) ──────────────────────

const ObjectiveRow = ({ objective, performances = [] }: { objective: Objective; performances?: SwimmerPerformance[] }) => {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;
  const stroke = hasChrono ? strokeFromCode(objective.event_code!) : null;
  const borderColor = stroke ? STROKE_COLORS[stroke] ?? "" : "";

  const bestPerf = hasChrono
    ? findBestPerformance(performances, objective.event_code!, objective.pool_length)
    : null;

  let delta: number | null = null;
  let progressPct: number | null = null;
  if (bestPerf && objective.target_time_seconds != null && objective.event_code) {
    delta = bestPerf.time - objective.target_time_seconds;
    progressPct = computeProgress(bestPerf.time, objective.target_time_seconds, objective.event_code);
  }

  return (
    <div className={`rounded-lg border bg-card p-2.5 text-sm space-y-1 ${hasChrono ? `border-l-4 ${borderColor}` : ""}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">{hasChrono ? eventLabel(objective.event_code!) : ""}</span>
        {objective.pool_length && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {objective.pool_length}m
          </Badge>
        )}
        {objective.target_time_seconds != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
            {formatTime(objective.target_time_seconds)}
          </Badge>
        )}
      </div>
      {hasText && (
        <p className="text-muted-foreground line-clamp-2 pl-5">{objective.text}</p>
      )}
      {bestPerf && (
        <div className="flex items-center gap-2 pl-5 text-xs text-muted-foreground flex-wrap">
          <span>
            Actuel : <span className="font-mono">{formatTime(bestPerf.time)}</span>
          </span>
          {bestPerf.date && (
            <span className="text-muted-foreground/60">({formatDate(bestPerf.date)})</span>
          )}
          {delta != null && (
            <span className={delta <= 0 ? "text-emerald-600 font-medium" : "text-amber-600"}>
              {delta <= 0 ? "Objectif atteint !" : `+${delta.toFixed(2)}s`}
            </span>
          )}
        </div>
      )}
      {!bestPerf && hasChrono && objective.target_time_seconds != null && (
        <p className="text-[10px] text-muted-foreground italic pl-5">
          Pas encore de temps enregistré
        </p>
      )}
    </div>
  );
};

const CollapsiblePreviousCommitments = ({
  prevInterview,
  commitmentReview,
}: {
  prevInterview: Interview;
  commitmentReview?: string | null;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Rappel engagements précédents
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
            {formatDate(prevInterview.date)}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-b-xl border border-t-0 bg-muted/30 px-3 pb-3 space-y-2">
          {prevInterview.athlete_commitments && (
            <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/50 dark:bg-blue-950/20 p-2">
              <p className="text-[10px] font-semibold text-muted-foreground">Engagements nageur</p>
              <p className="text-xs whitespace-pre-wrap">{prevInterview.athlete_commitments}</p>
            </div>
          )}
          {prevInterview.coach_actions && (
            <div className="border-l-4 border-amber-400 rounded-r-lg bg-amber-50/50 dark:bg-amber-950/20 p-2">
              <p className="text-[10px] font-semibold text-muted-foreground">Actions coach</p>
              <p className="text-xs whitespace-pre-wrap">{prevInterview.coach_actions}</p>
            </div>
          )}
          {commitmentReview && (
            <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/80 dark:bg-blue-950/30 p-2">
              <p className="text-[10px] font-semibold text-muted-foreground">Bilan du nageur</p>
              <p className="text-xs whitespace-pre-wrap">{commitmentReview}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ── Inline Planning Section ─────────────────────────────────────

const InlinePlanning = ({
  athleteId,
  interviewDate,
}: {
  athleteId: number;
  interviewDate: string;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Competitions + assigned
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  const { data: assignedIds = [] } = useQuery({
    queryKey: ["my-competition-ids", athleteId],
    queryFn: () => api.getMyCompetitionIds(athleteId),
  });

  // Find next assigned competition after interview date
  const nextCompetition = useMemo(() => {
    const assignedSet = new Set(assignedIds);
    const upcoming = competitions
      .filter((c) => assignedSet.has(c.id) && c.date >= interviewDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }, [competitions, assignedIds, interviewDate]);

  // Training cycles for this athlete
  const { data: cycles = [] } = useQuery({
    queryKey: ["training-cycles", "athlete", athleteId],
    queryFn: () => api.getTrainingCycles({ athleteId }),
  });

  // Find matching cycle (covers interview date to competition)
  const matchingCycle = useMemo(() => {
    if (!nextCompetition) return null;
    return cycles.find(
      (c) =>
        c.end_competition_id === nextCompetition.id ||
        (c.end_competition_date && c.end_competition_date >= interviewDate),
    ) ?? null;
  }, [cycles, nextCompetition, interviewDate]);

  // Weeks for matching cycle
  const { data: weeks = [] } = useQuery({
    queryKey: ["training-weeks", matchingCycle?.id],
    queryFn: () => api.getTrainingWeeks(matchingCycle!.id),
    enabled: !!matchingCycle,
  });

  // Week editing
  const [editingMonday, setEditingMonday] = useState<string | null>(null);
  const [editWeekType, setEditWeekType] = useState("");

  const existingWeekTypes = useMemo(() => {
    const types = new Set<string>();
    weeks.forEach((w) => { if (w.week_type) types.add(w.week_type); });
    return Array.from(types).sort();
  }, [weeks]);

  const weeksByStart = useMemo(() => {
    const map = new Map<string, TrainingWeek>();
    weeks.forEach((w) => map.set(w.week_start, w));
    return map;
  }, [weeks]);

  // Timeline mondays
  const timelineMondays = useMemo(() => {
    if (!nextCompetition) return [];
    const startDate = interviewDate;
    const endDate = nextCompetition.date;
    return getMondays(startDate, endDate);
  }, [nextCompetition, interviewDate]);

  const daysToComp = nextCompetition ? daysBetween(new Date().toISOString().split("T")[0], nextCompetition.date) : null;

  // Create cycle mutation
  const createCycleMutation = useMutation({
    mutationFn: async () => {
      if (!nextCompetition) throw new Error("Pas de compétition");
      // Find a start competition (closest before interview date, or use interviewDate as anchor)
      const startComps = competitions
        .filter((c) => c.date <= interviewDate)
        .sort((a, b) => b.date.localeCompare(a.date));
      const startComp = startComps[0] ?? nextCompetition;

      const cycle = await api.createTrainingCycle({
        athlete_id: athleteId,
        group_id: null,
        start_competition_id: startComp.id,
        end_competition_id: nextCompetition.id,
        name: `Préparation ${nextCompetition.name}`,
      });
      // Auto-generate weeks
      const mondays = getMondays(interviewDate, nextCompetition.date);
      if (mondays.length > 0) {
        await api.bulkUpsertTrainingWeeks(
          mondays.map((m) => ({ cycle_id: cycle.id, week_start: m })),
        );
      }
      return cycle;
    },
    onSuccess: () => {
      toast({ title: "Planification créée" });
      void queryClient.invalidateQueries({ queryKey: ["training-cycles"] });
      void queryClient.invalidateQueries({ queryKey: ["training-weeks"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Upsert week mutation
  const upsertWeekMutation = useMutation({
    mutationFn: (input: TrainingWeekInput) => api.upsertTrainingWeek(input),
    onSuccess: () => {
      setEditingMonday(null);
      void queryClient.invalidateQueries({ queryKey: ["training-weeks", matchingCycle?.id] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  if (!nextCompetition) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground italic">
          Aucune compétition assignée à venir — planification non disponible.
        </p>
      </div>
    );
  }

  // No cycle yet — offer to create
  if (!matchingCycle) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{nextCompetition.name}</span>
          <span className="text-xs text-muted-foreground">({formatDate(nextCompetition.date)})</span>
          {daysToComp != null && (
            <Badge variant="secondary" className="text-[10px]">J-{daysToComp}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => createCycleMutation.mutate()}
          disabled={createCycleMutation.isPending}
        >
          {createCycleMutation.isPending ? "Création..." : "Créer la planification"}
        </Button>
      </div>
    );
  }

  // Show timeline
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-medium">{nextCompetition.name}</span>
        <span className="text-xs text-muted-foreground">({formatDate(nextCompetition.date)})</span>
        {daysToComp != null && (
          <Badge variant="secondary" className="text-[10px]">J-{daysToComp}</Badge>
        )}
      </div>

      <div className="relative ml-2 border-l-2 border-border pl-3 space-y-1">
        {timelineMondays.map((monday, idx) => {
          const week = weeksByStart.get(monday);
          const isCurrent = isCurrentWeek(monday);
          const isEditing = editingMonday === monday;
          const sunday = getSunday(monday);
          const datalistId = `inline-week-${monday}`;

          if (isEditing) {
            return (
              <div
                key={monday}
                className={`rounded-lg border bg-card p-2 space-y-1.5 ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                <div className="text-xs text-muted-foreground">
                  Sem. {idx + 1} ({fmtShort(monday)} - {fmtShort(sunday)})
                </div>
                <Input
                  className="h-7 text-sm"
                  placeholder="Foncier, Techni., Affûtage..."
                  list={datalistId}
                  value={editWeekType}
                  onChange={(e) => setEditWeekType(e.target.value)}
                />
                <datalist id={datalistId}>
                  {existingWeekTypes.map((t) => <option key={t} value={t} />)}
                </datalist>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setEditingMonday(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      if (!matchingCycle) return;
                      upsertWeekMutation.mutate({
                        cycle_id: matchingCycle.id,
                        week_start: monday,
                        week_type: editWeekType.trim() || null,
                      });
                    }}
                    disabled={upsertWeekMutation.isPending}
                  >
                    OK
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <button
              key={monday}
              type="button"
              className={`w-full text-left rounded-lg px-2 py-1.5 flex items-center gap-2 text-xs transition-colors hover:bg-muted/50 ${
                isCurrent ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
              onClick={() => {
                setEditingMonday(monday);
                setEditWeekType(week?.week_type ?? "");
              }}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  isCurrent ? "bg-primary" : week?.week_type ? "bg-muted-foreground/40" : "bg-muted-foreground/20"
                }`}
              />
              <span className="text-muted-foreground whitespace-nowrap">
                Sem. {idx + 1}
              </span>
              <span className="text-muted-foreground/60 whitespace-nowrap">
                {fmtShort(monday)} - {fmtShort(sunday)}
              </span>
              {week?.week_type && (
                <Badge
                  className="text-[10px] px-1.5 py-0 border-0 ml-auto"
                  style={{
                    backgroundColor: weekTypeColor(week.week_type),
                    color: weekTypeTextColor(week.week_type),
                  }}
                >
                  {week.week_type}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Final competition marker */}
      <div className="flex items-center gap-2 ml-2 pl-3 text-xs">
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-semibold">{nextCompetition.name}</span>
      </div>
    </div>
  );
};

// ── Coach Interview Card ────────────────────────────────────────

const CoachInterviewCard = ({
  interview,
  athleteId,
  objectives,
  performances,
}: {
  interview: Interview;
  athleteId: number;
  objectives: Objective[];
  performances: SwimmerPerformance[];
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(interview.status !== "signed");

  // Coach form state — per-section comments
  const [coachCommentSuccesses, setCoachCommentSuccesses] = useState(interview.coach_comment_successes ?? "");
  const [coachCommentDifficulties, setCoachCommentDifficulties] = useState(interview.coach_comment_difficulties ?? "");
  const [coachCommentGoals, setCoachCommentGoals] = useState(interview.coach_comment_goals ?? "");
  // Legacy fields (kept for backward compat with old interviews)
  const coachReview = interview.coach_review ?? "";
  const coachObjectives = interview.coach_objectives ?? "";
  const [coachActions, setCoachActions] = useState(interview.coach_actions ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const savingRef = useRef(false);

  // Previous interview
  const { data: prevInterview } = useQuery({
    queryKey: ["previous-interview", athleteId, interview.date, interview.id],
    queryFn: () => api.getPreviousInterview(athleteId, interview.date, interview.id),
    enabled: !!interview.date,
  });

  // ── Mutations ──
  const buildCoachInput = useCallback((): InterviewCoachInput => ({
    coach_comment_successes: coachCommentSuccesses.trim() || null,
    coach_comment_difficulties: coachCommentDifficulties.trim() || null,
    coach_comment_goals: coachCommentGoals.trim() || null,
    coach_review: coachReview.trim() || null,
    coach_objectives: coachObjectives.trim() || null,
    coach_actions: coachActions.trim() || null,
  }), [
    coachActions,
    coachCommentDifficulties,
    coachCommentGoals,
    coachCommentSuccesses,
    coachObjectives,
    coachReview,
  ]);

  const hasDraftChanges = useCallback(() => {
    const next = buildCoachInput();
    return (
      (interview.coach_comment_successes ?? null) !== next.coach_comment_successes ||
      (interview.coach_comment_difficulties ?? null) !== next.coach_comment_difficulties ||
      (interview.coach_comment_goals ?? null) !== next.coach_comment_goals ||
      (interview.coach_review ?? null) !== next.coach_review ||
      (interview.coach_objectives ?? null) !== next.coach_objectives ||
      (interview.coach_actions ?? null) !== next.coach_actions
    );
  }, [buildCoachInput, interview]);

  const saveMutation = useMutation({
    mutationFn: (input: InterviewCoachInput) => api.updateInterviewCoachSections(interview.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.updateInterviewCoachSections(interview.id, buildCoachInput());
      return api.sendInterviewToAthlete(interview.id);
    },
    onSuccess: () => {
      toast({ title: "Entretien envoyé au nageur" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteInterview(interview.id),
    onSuccess: () => {
      toast({ title: "Entretien supprimé" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const isPending = saveMutation.isPending || sendMutation.isPending || deleteMutation.isPending;
  const status = interview.status;
  const borderClass = status === "draft_athlete"
    ? "border-amber-300 dark:border-amber-700 border-l-4"
    : status === "draft_coach"
      ? "border-blue-300 dark:border-blue-700 border-l-4"
      : status === "sent"
        ? "border-emerald-300 dark:border-emerald-700 border-l-4"
        : "";

  const handleAutoSave = useCallback(() => {
    if (status !== "draft_coach" || savingRef.current || isPending || !hasDraftChanges()) return;
    savingRef.current = true;
    saveMutation.mutate(buildCoachInput());
    window.setTimeout(() => {
      savingRef.current = false;
    }, 500);
  }, [buildCoachInput, hasDraftChanges, isPending, saveMutation, status]);

  return (
    <>
      <div className={`rounded-xl border bg-card shadow-sm ${borderClass}`}>
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold">{formatDate(interview.date)}</span>
            {getStatusBadge(status)}
            {status === "signed" && interview.signed_at && (
              <span className="text-xs text-muted-foreground">
                le {formatDate(interview.signed_at.slice(0, 10))}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-5">
            {status === "draft_athlete" && (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-6 text-center space-y-2">
                <Clock className="h-8 w-8 mx-auto text-amber-500" />
                <p className="text-sm font-medium">En attente de la préparation du nageur</p>
                <p className="text-xs text-muted-foreground">
                  Le contenu n&apos;est pas encore visible. Le nageur doit d&apos;abord remplir ses sections.
                </p>
              </div>
            )}

            {status === "draft_coach" && (
              <>
                {prevInterview && (
                  <CollapsiblePreviousCommitments
                    prevInterview={prevInterview}
                    commitmentReview={interview.athlete_commitment_review}
                  />
                )}

                <SectionDivider label="Réussites" />
                <AthleteSection label="Nageur" text={interview.athlete_successes} />
                <CoachSectionEditable
                  label="Coach"
                  value={coachCommentSuccesses}
                  onChange={setCoachCommentSuccesses}
                  onBlur={handleAutoSave}
                  placeholder="Votre commentaire sur les réussites..."
                />

                <SectionDivider label="Difficultés" />
                <AthleteSection label="Nageur" text={interview.athlete_difficulties} />
                <CoachSectionEditable
                  label="Coach"
                  value={coachCommentDifficulties}
                  onChange={setCoachCommentDifficulties}
                  onBlur={handleAutoSave}
                  placeholder="Votre commentaire sur les difficultés..."
                />

                <SectionDivider label="Objectifs" />
                {objectives.length > 0 && (
                  <div className="space-y-1.5">
                    {objectives.map((obj) => (
                      <ObjectiveRow key={obj.id} objective={obj} performances={performances} />
                    ))}
                  </div>
                )}
                <AthleteSection label="Nageur" text={interview.athlete_goals} />
                <CoachSectionEditable
                  label="Coach"
                  value={coachCommentGoals}
                  onChange={setCoachCommentGoals}
                  onBlur={handleAutoSave}
                  placeholder="Objectifs complémentaires, commentaires..."
                />

                <SectionDivider label="Planification" />
                <InlinePlanning athleteId={athleteId} interviewDate={interview.date} />

                <SectionDivider label="Engagements & Actions" />
                <div className="rounded-xl bg-card border shadow-sm p-4 space-y-3">
                  <AthleteSection label="Engagements du nageur" text={interview.athlete_commitments} />
                  <CoachSectionEditable
                    label="Actions du coach"
                    value={coachActions}
                    onChange={setCoachActions}
                    onBlur={handleAutoSave}
                    placeholder="Actions concrètes, points de suivi..."
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  {saveMutation.isPending ? "Sauvegarde..." : "Sauvegarde automatique a la sortie d'un champ."}
                </div>
              </>
            )}

            {(status === "sent" || status === "signed") && (
              <>
                {prevInterview && (
                  <CollapsiblePreviousCommitments
                    prevInterview={prevInterview}
                    commitmentReview={interview.athlete_commitment_review}
                  />
                )}

                <SectionDivider label="Réussites" />
                <AthleteSection label="Nageur" text={interview.athlete_successes} />
                <CoachSectionReadOnly label="Coach" text={interview.coach_comment_successes || interview.coach_review} />

                <SectionDivider label="Difficultés" />
                <AthleteSection label="Nageur" text={interview.athlete_difficulties} />
                <CoachSectionReadOnly label="Coach" text={interview.coach_comment_difficulties} />

                <SectionDivider label="Objectifs" />
                {objectives.length > 0 && (
                  <div className="space-y-1.5">
                    {objectives.map((obj) => (
                      <ObjectiveRow key={obj.id} objective={obj} performances={performances} />
                    ))}
                  </div>
                )}
                <AthleteSection label="Nageur" text={interview.athlete_goals} />
                <CoachSectionReadOnly label="Coach" text={interview.coach_comment_goals || interview.coach_objectives} />

                <SectionDivider label="Planification" />
                <InlinePlanning athleteId={athleteId} interviewDate={interview.date} />

                <SectionDivider label="Engagements & Actions" />
                <div className="rounded-xl bg-card border shadow-sm p-4 space-y-3">
                  <AthleteSection label="Engagements du nageur" text={interview.athlete_commitments} />
                  <CoachSectionReadOnly label="Actions du coach" text={interview.coach_actions} />
                </div>
              </>
            )}

            <div className="space-y-2 pt-2 border-t">
              {status === "draft_coach" && (
                <Button
                  className="w-full"
                  onClick={() => setShowSendConfirm(true)}
                  disabled={isPending}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Envoyer au nageur
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'entretien</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'entretien du {interview.date ? formatDate(interview.date) : ""} sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send confirmation */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer au nageur</AlertDialogTitle>
            <AlertDialogDescription>
              L'entretien sera envoyé au nageur pour consultation. Les sections coach seront enregistrées automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                sendMutation.mutate();
                setShowSendConfirm(false);
              }}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Envoyer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ── Main Component ──────────────────────────────────────────────

const SwimmerInterviewsTab = ({ athleteId, athleteName }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resolve auth UUID (for objective context)
  const { data: athleteAuthId } = useQuery({
    queryKey: ["auth-uid", athleteId],
    queryFn: () => fetchAuthUidForUser(athleteId),
    enabled: !!athleteId,
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ["objectives", athleteAuthId],
    queryFn: () => api.getObjectives(athleteAuthId!),
    enabled: !!athleteAuthId,
  });

  const { data: athleteProfile } = useQuery({
    queryKey: ["athlete-profile", athleteId],
    queryFn: () => api.getProfile({ userId: athleteId }),
    enabled: !!athleteId,
  });
  const athleteIuf = athleteProfile?.ffn_iuf ?? null;

  const perfFromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 360);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: performances = [] } = useQuery({
    queryKey: ["swimmer-performances-recent", athleteIuf],
    queryFn: () => api.getSwimmerPerformances({ iuf: athleteIuf!, fromDate: perfFromDate }),
    enabled: !!athleteIuf,
  });

  // Interviews
  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["interviews", athleteId],
    queryFn: () => api.getInterviews(athleteId),
    enabled: !!athleteId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () =>
      api.createInterview({ athlete_id: athleteId }),
    onSuccess: () => {
      toast({ title: "Entretien créé" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-3 animate-pulse motion-reduce:animate-none"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="ml-auto h-5 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (interviews.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          Aucun entretien pour {athleteName}.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {createMutation.isPending ? "Création..." : "Nouvel entretien"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Entretiens</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {interviews.length}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {createMutation.isPending ? "Création..." : "Nouvel entretien"}
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {interviews.map((interview) => (
          <CoachInterviewCard
            key={interview.id}
            interview={interview}
            athleteId={athleteId}
            objectives={objectives}
            performances={performances}
          />
        ))}
      </div>
    </div>
  );
};

export default SwimmerInterviewsTab;

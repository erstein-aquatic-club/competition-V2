import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Interview,
  InterviewStatus,
  InterviewCoachInput,
  Objective,
  TrainingCycle,
  TrainingWeek,
  Competition,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Plus, Trash2, Send, Clock, CheckCircle2, FileText, MessageSquare } from "lucide-react";
import { eventLabel, formatTime } from "@/lib/objectiveHelpers";

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

const STATUS_CONFIG: Record<InterviewStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  draft_athlete: {
    label: "En attente nageur",
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  draft_coach: {
    label: "Preparation coach",
    variant: "secondary",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  sent: {
    label: "Envoye",
    variant: "secondary",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  signed: {
    label: "Signe",
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

function getPreviewText(interview: Interview): string | null {
  const sections = [
    interview.athlete_successes,
    interview.athlete_difficulties,
    interview.athlete_goals,
    interview.athlete_commitments,
    interview.coach_review,
    interview.coach_objectives,
    interview.coach_actions,
  ];
  for (const text of sections) {
    if (text && text.trim()) return text.trim();
  }
  return null;
}

/** Fetch the auth UUID for a public.users integer ID via RPC. */
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

// ── Read-only Section Card ──────────────────────────────────────

const ReadOnlySection = ({ label, text }: { label: string; text?: string | null }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
      {text?.trim() || <span className="text-muted-foreground italic">Non renseigne</span>}
    </div>
  </div>
);

// ── Contextual Accordion ────────────────────────────────────────

const ContextPanel = ({
  athleteId,
  athleteAuthId,
  interview,
}: {
  athleteId: number;
  athleteAuthId: string | null;
  interview: Interview;
}) => {
  // Objectives
  const { data: objectives = [] } = useQuery({
    queryKey: ["objectives", athleteAuthId],
    queryFn: () => api.getObjectives(athleteAuthId!),
    enabled: !!athleteAuthId,
  });

  // Training cycles
  const { data: cycles = [] } = useQuery({
    queryKey: ["training-cycles", "athlete", athleteId],
    queryFn: () => api.getTrainingCycles({ athleteId }),
  });

  // Current cycle weeks (if interview has a cycle linked, use it; otherwise first available)
  const currentCycleId = interview.current_cycle_id ?? (cycles.length > 0 ? cycles[0].id : null);
  const currentCycle = cycles.find((c) => c.id === currentCycleId) ?? null;

  const { data: weeks = [] } = useQuery({
    queryKey: ["training-weeks", currentCycleId],
    queryFn: () => api.getTrainingWeeks(currentCycleId!),
    enabled: !!currentCycleId,
  });

  // Find current week
  const currentWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const w of weeks) {
      const monday = new Date(w.week_start + "T00:00:00");
      const sunday = new Date(w.week_start + "T00:00:00");
      sunday.setDate(sunday.getDate() + 6);
      if (today >= monday && today <= sunday) return w;
    }
    return null;
  }, [weeks]);

  // Competitions + assigned
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  const { data: assignedIds = [] } = useQuery({
    queryKey: ["my-competition-ids", athleteId],
    queryFn: () => api.getMyCompetitionIds(athleteId),
  });

  // Upcoming assigned competitions
  const upcomingCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const assignedSet = new Set(assignedIds);
    return competitions
      .filter((c) => assignedSet.has(c.id) && new Date(c.date + "T00:00:00") >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [competitions, assignedIds]);

  return (
    <Accordion type="multiple" className="mt-4">
      <AccordionItem value="objectives">
        <AccordionTrigger className="text-sm py-3">
          Objectifs ({objectives.length})
        </AccordionTrigger>
        <AccordionContent>
          {objectives.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun objectif defini.</p>
          ) : (
            <div className="space-y-2">
              {objectives.map((obj) => (
                <ObjectiveRow key={obj.id} objective={obj} />
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="planning">
        <AccordionTrigger className="text-sm py-3">Planification</AccordionTrigger>
        <AccordionContent>
          {currentCycle ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{currentCycle.name}</p>
              {currentWeek ? (
                <p className="text-xs text-muted-foreground">
                  Semaine en cours : {currentWeek.week_type ?? "Non defini"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Pas de semaine en cours.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucun cycle de planification.</p>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="competitions">
        <AccordionTrigger className="text-sm py-3">
          Competitions ({upcomingCompetitions.length})
        </AccordionTrigger>
        <AccordionContent>
          {upcomingCompetitions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune competition assignee a venir.</p>
          ) : (
            <div className="space-y-1.5">
              {upcomingCompetitions.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                </div>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const ObjectiveRow = ({ objective }: { objective: Objective }) => {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;

  return (
    <div className="rounded-lg border bg-card p-2.5 text-sm space-y-0.5">
      {hasChrono && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{eventLabel(objective.event_code!)}</span>
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
      )}
      {hasText && (
        <p className="text-muted-foreground line-clamp-2">{objective.text}</p>
      )}
    </div>
  );
};

// ── Interview Detail Sheet ──────────────────────────────────────

const InterviewDetailSheet = ({
  open,
  onOpenChange,
  interview,
  athleteId,
  athleteAuthId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: Interview | null;
  athleteId: number;
  athleteAuthId: string | null;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [coachReview, setCoachReview] = useState("");
  const [coachObjectives, setCoachObjectives] = useState("");
  const [coachActions, setCoachActions] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  // Sync form state when sheet opens with a draft_coach interview
  const [lastLoadedId, setLastLoadedId] = useState<string | null>(null);
  if (open && interview && interview.id !== lastLoadedId) {
    setCoachReview(interview.coach_review ?? "");
    setCoachObjectives(interview.coach_objectives ?? "");
    setCoachActions(interview.coach_actions ?? "");
    setLastLoadedId(interview.id);
  }
  if (!open && lastLoadedId !== null) {
    // Reset tracking when sheet closes (will re-sync on next open)
    setLastLoadedId(null);
  }

  // ── Mutations ──

  const saveMutation = useMutation({
    mutationFn: (input: InterviewCoachInput) =>
      api.updateInterviewCoachSections(interview!.id, input),
    onSuccess: () => {
      toast({ title: "Sections coach enregistrees" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      // Save coach sections first, then send
      await api.updateInterviewCoachSections(interview!.id, {
        coach_review: coachReview.trim() || null,
        coach_objectives: coachObjectives.trim() || null,
        coach_actions: coachActions.trim() || null,
      });
      return api.sendInterviewToAthlete(interview!.id);
    },
    onSuccess: () => {
      toast({ title: "Entretien envoye au nageur" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteInterview(interview!.id),
    onSuccess: () => {
      toast({ title: "Entretien supprime" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      coach_review: coachReview.trim() || null,
      coach_objectives: coachObjectives.trim() || null,
      coach_actions: coachActions.trim() || null,
    });
  };

  const isPending = saveMutation.isPending || sendMutation.isPending || deleteMutation.isPending;

  if (!interview) return null;

  const status = interview.status;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              <span>Entretien du {formatDate(interview.date)}</span>
              {getStatusBadge(status)}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* ── draft_athlete: waiting for athlete ── */}
            {status === "draft_athlete" && (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-6 text-center space-y-2">
                <Clock className="h-8 w-8 mx-auto text-amber-500" />
                <p className="text-sm font-medium">En attente de la preparation du nageur</p>
                <p className="text-xs text-muted-foreground">
                  Le contenu n'est pas encore visible. Le nageur doit d'abord remplir ses sections.
                </p>
              </div>
            )}

            {/* ── draft_coach: coach editing phase ── */}
            {status === "draft_coach" && (
              <>
                {/* Athlete sections (read-only) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Preparation du nageur
                  </h3>
                  <ReadOnlySection label="Reussites" text={interview.athlete_successes} />
                  <ReadOnlySection label="Difficultes" text={interview.athlete_difficulties} />
                  <ReadOnlySection label="Objectifs personnels" text={interview.athlete_goals} />
                  <ReadOnlySection label="Engagements" text={interview.athlete_commitments} />
                </div>

                {/* Coach sections (editable) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Sections coach
                  </h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Commentaires du coach</Label>
                    <Textarea
                      placeholder="Votre analyse, points positifs, axes d'amelioration..."
                      value={coachReview}
                      onChange={(e) => setCoachReview(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Objectifs ajoutes</Label>
                    <Textarea
                      placeholder="Objectifs complementaires pour le nageur..."
                      value={coachObjectives}
                      onChange={(e) => setCoachObjectives(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Actions a suivre</Label>
                    <Textarea
                      placeholder="Actions concretes, points de suivi..."
                      value={coachActions}
                      onChange={(e) => setCoachActions(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Context panel */}
                <ContextPanel
                  athleteId={athleteId}
                  athleteAuthId={athleteAuthId}
                  interview={interview}
                />
              </>
            )}

            {/* ── sent / signed: read-only full view ── */}
            {(status === "sent" || status === "signed") && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Preparation du nageur
                  </h3>
                  <ReadOnlySection label="Reussites" text={interview.athlete_successes} />
                  <ReadOnlySection label="Difficultes" text={interview.athlete_difficulties} />
                  <ReadOnlySection label="Objectifs personnels" text={interview.athlete_goals} />
                  <ReadOnlySection label="Engagements" text={interview.athlete_commitments} />
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Sections coach
                  </h3>
                  <ReadOnlySection label="Commentaires du coach" text={interview.coach_review} />
                  <ReadOnlySection label="Objectifs ajoutes" text={interview.coach_objectives} />
                  <ReadOnlySection label="Actions a suivre" text={interview.coach_actions} />
                </div>

                {status === "signed" && interview.signed_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Signe le {formatDate(interview.signed_at.slice(0, 10))}</span>
                  </div>
                )}
              </>
            )}

            {/* ── Footer actions ── */}
            <div className="space-y-2 pt-2 border-t">
              {status === "draft_coach" && (
                <>
                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={isPending}
                  >
                    {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    className="w-full"
                    variant="default"
                    onClick={() => setShowSendConfirm(true)}
                    disabled={isPending}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Envoyer au nageur
                  </Button>
                </>
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
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'entretien</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. L'entretien du {interview.date ? formatDate(interview.date) : ""} sera supprime definitivement.
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
              L'entretien sera envoye au nageur pour consultation. Les sections coach seront enregistrees automatiquement.
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

// ── Interview Card ──────────────────────────────────────────────

const InterviewCard = ({
  interview,
  onClick,
}: {
  interview: Interview;
  onClick: () => void;
}) => {
  const preview = getPreviewText(interview);

  return (
    <button
      type="button"
      className="w-full text-left rounded-xl border bg-card p-3 space-y-1.5 transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">{formatDate(interview.date)}</span>
        {getStatusBadge(interview.status)}
      </div>
      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>
      )}
    </button>
  );
};

// ── Main Component ──────────────────────────────────────────────

const SwimmerInterviewsTab = ({ athleteId, athleteName }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Resolve auth UUID (for objectives context panel)
  const { data: athleteAuthId } = useQuery({
    queryKey: ["auth-uid", athleteId],
    queryFn: () => fetchAuthUidForUser(athleteId),
    enabled: !!athleteId,
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
    onSuccess: (newInterview) => {
      toast({ title: "Entretien cree" });
      void queryClient.invalidateQueries({ queryKey: ["interviews", athleteId] });
      setSelectedInterview(newInterview);
      setSheetOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenInterview = (interview: Interview) => {
    setSelectedInterview(interview);
    setSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedInterview(null);
  };

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
          {createMutation.isPending ? "Creation..." : "Nouvel entretien"}
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
          {createMutation.isPending ? "Creation..." : "Nouvel entretien"}
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {interviews.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            onClick={() => handleOpenInterview(interview)}
          />
        ))}
      </div>

      {/* Detail sheet */}
      <InterviewDetailSheet
        open={sheetOpen}
        onOpenChange={handleSheetChange}
        interview={selectedInterview}
        athleteId={athleteId}
        athleteAuthId={athleteAuthId ?? null}
      />
    </div>
  );
};

export default SwimmerInterviewsTab;

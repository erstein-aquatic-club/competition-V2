import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Interview, InterviewAthleteInput, Objective } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  eventLabel,
  formatTime,
  STROKE_COLORS,
  strokeFromCode,
} from "@/lib/objectiveHelpers";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Target,
  User,
  GraduationCap,
} from "lucide-react";

type Props = { onBack: () => void };

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AthleteInterviewsSection({ onBack }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["my-interviews"],
    queryFn: () => api.getMyInterviews(),
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ["athlete-objectives"],
    queryFn: () => api.getAthleteObjectives(),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["my-interviews"] }),
    [queryClient],
  );

  const saveMut = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: InterviewAthleteInput;
    }) => api.updateInterviewAthleteSections(id, input),
    onSuccess: () => {
      toast({ title: "Sauvegarde" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      }),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => api.submitInterviewToCoach(id),
    onSuccess: () => {
      toast({ title: "Envoye au coach" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      }),
  });

  const signMut = useMutation({
    mutationFn: (id: string) => api.signInterview(id),
    onSuccess: () => {
      toast({ title: "Entretien signe" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Retour
        </Button>
        <h2 className="text-2xl font-display font-semibold uppercase italic text-primary">
          Mes entretiens
        </h2>
        <p className="text-sm text-muted-foreground">
          Entretiens individuels avec le coach
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-4 animate-pulse motion-reduce:animate-none"
            >
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && interviews.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aucun entretien en cours. Votre coach initiera les entretiens.
          </p>
        </div>
      )}

      {/* Interview cards */}
      {!isLoading &&
        interviews.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            objectives={objectives}
            onSave={(id, input) => saveMut.mutate({ id, input })}
            onSubmit={(id) => {
              if (
                window.confirm(
                  "Envoyer votre preparation au coach ? Vous ne pourrez plus la modifier.",
                )
              ) {
                submitMut.mutate(id);
              }
            }}
            onSign={(id) => {
              if (
                window.confirm("Confirmer la signature de cet entretien ?")
              ) {
                signMut.mutate(id);
              }
            }}
            isSaving={saveMut.isPending}
            isSubmitting={submitMut.isPending}
            isSigning={signMut.isPending}
          />
        ))}
    </div>
  );
}

// ── Interview Card ──

function InterviewCard({
  interview,
  objectives,
  onSave,
  onSubmit,
  onSign,
  isSaving,
  isSubmitting,
  isSigning,
}: {
  interview: Interview;
  objectives: Objective[];
  onSave: (id: string, input: InterviewAthleteInput) => void;
  onSubmit: (id: string) => void;
  onSign: (id: string) => void;
  isSaving: boolean;
  isSubmitting: boolean;
  isSigning: boolean;
}) {
  const isDraft = interview.status === "draft_athlete";
  const isDraftCoach = interview.status === "draft_coach";
  const isSent = interview.status === "sent";
  const isSigned = interview.status === "signed";

  // Signed cards collapsed by default, others expanded
  const [expanded, setExpanded] = useState(!isSigned);

  // Local form state for draft editing
  const [successes, setSuccesses] = useState(
    interview.athlete_successes ?? "",
  );
  const [difficulties, setDifficulties] = useState(
    interview.athlete_difficulties ?? "",
  );
  const [goals, setGoals] = useState(interview.athlete_goals ?? "");
  const [commitments, setCommitments] = useState(
    interview.athlete_commitments ?? "",
  );
  const [commitmentReview, setCommitmentReview] = useState(
    interview.athlete_commitment_review ?? "",
  );

  // Previous interview for commitment follow-up
  const { data: prevInterview } = useQuery({
    queryKey: ["my-previous-interview", interview.date],
    queryFn: async () => {
      // Use the athlete's own ID from auth context
      const { data: { user } } = await (await import("@/lib/supabase")).supabase.auth.getUser();
      const appUserId = (user?.app_metadata as any)?.app_user_id;
      if (!appUserId) return null;
      return api.getPreviousInterview(appUserId, interview.date);
    },
    enabled: isDraft || isSent || isSigned || isDraftCoach,
  });

  // Track which interview we're saving to avoid cross-card conflicts
  const savingRef = useRef(false);

  const handleBlur = useCallback(() => {
    if (savingRef.current || !isDraft) return;
    savingRef.current = true;
    onSave(interview.id, {
      athlete_successes: successes || null,
      athlete_difficulties: difficulties || null,
      athlete_goals: goals || null,
      athlete_commitments: commitments || null,
      athlete_commitment_review: commitmentReview || null,
    });
    setTimeout(() => {
      savingRef.current = false;
    }, 500);
  }, [interview.id, successes, difficulties, goals, commitments, commitmentReview, onSave, isDraft]);

  // Status badge
  const statusBadge = isDraft ? (
    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700">
      <Clock className="h-3 w-3 mr-1" />
      A preparer
    </Badge>
  ) : isDraftCoach ? (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700">
      <Clock className="h-3 w-3 mr-1" />
      En preparation
    </Badge>
  ) : isSent ? (
    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      A signer
    </Badge>
  ) : (
    <Badge variant="secondary">Signe</Badge>
  );

  // Card border highlight for actionable items
  const borderClass = isDraft
    ? "border-amber-300 dark:border-amber-700 border-l-4"
    : isDraftCoach
      ? "border-blue-300 dark:border-blue-700 border-l-4"
      : isSent
        ? "border-emerald-300 dark:border-emerald-700 border-l-4"
        : "";

  return (
    <div className={`rounded-xl border bg-card shadow-sm ${borderClass}`}>
      {/* Card header — always visible, toggles expand */}
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold">
            {formatDate(interview.date)}
          </span>
          {statusBadge}
          {isSigned && interview.signed_at && (
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

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* ── Draft athlete: editable textareas ── */}
          {isDraft && (
            <>
              {/* Commitment review from previous interview */}
              {prevInterview && (prevInterview.athlete_commitments || prevInterview.coach_actions) && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Bilan des engagements precedents
                  </p>
                  {prevInterview.athlete_commitments && (
                    <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/50 dark:bg-blue-950/20 p-2 space-y-0.5">
                      <p className="text-[10px] font-semibold text-muted-foreground">Mes engagements</p>
                      <p className="text-xs whitespace-pre-wrap">{prevInterview.athlete_commitments}</p>
                    </div>
                  )}
                  {prevInterview.coach_actions && (
                    <div className="border-l-4 border-amber-400 rounded-r-lg bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-0.5">
                      <p className="text-[10px] font-semibold text-muted-foreground">Actions du coach</p>
                      <p className="text-xs whitespace-pre-wrap">{prevInterview.coach_actions}</p>
                    </div>
                  )}
                  <div className="space-y-1 pt-1">
                    <Label htmlFor={`commitment-review-${interview.id}`} className="text-xs">
                      Comment avez-vous tenu vos engagements ?
                    </Label>
                    <Textarea
                      id={`commitment-review-${interview.id}`}
                      placeholder="Mon bilan sur les engagements pris..."
                      value={commitmentReview}
                      onChange={(e) => setCommitmentReview(e.target.value)}
                      onBlur={handleBlur}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`successes-${interview.id}`}>
                  Mes reussites
                </Label>
                <Textarea
                  id={`successes-${interview.id}`}
                  placeholder="Ce dont je suis fier/fiere cette saison..."
                  value={successes}
                  onChange={(e) => setSuccesses(e.target.value)}
                  onBlur={handleBlur}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`difficulties-${interview.id}`}>
                  Mes difficultes
                </Label>
                <Textarea
                  id={`difficulties-${interview.id}`}
                  placeholder="Les points que je souhaite ameliorer..."
                  value={difficulties}
                  onChange={(e) => setDifficulties(e.target.value)}
                  onBlur={handleBlur}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Mes objectifs</Label>
                {objectives.length > 0 && (
                  <div className="space-y-1.5">
                    {objectives.map((obj) => (
                      <ObjectiveRow key={obj.id} objective={obj} />
                    ))}
                  </div>
                )}
                <Textarea
                  id={`goals-${interview.id}`}
                  placeholder="Objectifs supplementaires ou commentaires..."
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  onBlur={handleBlur}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`commitments-${interview.id}`}>
                  Mes engagements
                </Label>
                <Textarea
                  id={`commitments-${interview.id}`}
                  placeholder="Ce que je m'engage a faire..."
                  value={commitments}
                  onChange={(e) => setCommitments(e.target.value)}
                  onBlur={handleBlur}
                  rows={3}
                />
              </div>
              {isSaving && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  Sauvegarde...
                </p>
              )}
              <Button
                className="w-full gap-2"
                onClick={() => onSubmit(interview.id)}
                disabled={isSubmitting}
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Envoi..." : "Envoyer au coach"}
              </Button>
            </>
          )}

          {/* ── Draft coach: waiting state ── */}
          {isDraftCoach && (
            <div className="rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 p-6 text-center space-y-2">
              <Clock className="h-8 w-8 mx-auto text-blue-500" />
              <p className="text-sm font-medium">Entretien envoye au coach</p>
              <p className="text-xs text-muted-foreground">
                Votre coach prepare l'entretien. Vous recevrez le compte-rendu complet apres l'entretien en presentiel.
              </p>
              {interview.submitted_at && (
                <p className="text-xs text-muted-foreground">
                  Envoye le {formatDate(interview.submitted_at.slice(0, 10))}
                </p>
              )}
            </div>
          )}

          {/* ── Sent / Signed: conversational read-only layout ── */}
          {(isSent || isSigned) && (
            <>
              {/* Previous commitments summary */}
              {prevInterview && (prevInterview.athlete_commitments || prevInterview.coach_actions) && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Bilan des engagements precedents
                  </p>
                  {prevInterview.athlete_commitments && (
                    <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/50 dark:bg-blue-950/20 p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">Engagements</p>
                      <p className="text-xs whitespace-pre-wrap">{prevInterview.athlete_commitments}</p>
                    </div>
                  )}
                  {prevInterview.coach_actions && (
                    <div className="border-l-4 border-amber-400 rounded-r-lg bg-amber-50/50 dark:bg-amber-950/20 p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">Actions coach</p>
                      <p className="text-xs whitespace-pre-wrap">{prevInterview.coach_actions}</p>
                    </div>
                  )}
                  {interview.athlete_commitment_review && (
                    <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/80 dark:bg-blue-950/30 p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">Mon bilan</p>
                      <p className="text-xs whitespace-pre-wrap">{interview.athlete_commitment_review}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Conversational sections */}
              <ConversationalSection
                label="Reussites"
                athleteText={interview.athlete_successes}
                coachText={interview.coach_comment_successes || interview.coach_review}
              />
              <ConversationalSection
                label="Difficultes"
                athleteText={interview.athlete_difficulties}
                coachText={interview.coach_comment_difficulties}
              />
              <div className="space-y-2">
                <SectionLabel label="Objectifs" />
                {objectives.length > 0 && (
                  <div className="space-y-1.5">
                    {objectives.map((obj) => (
                      <ObjectiveRow key={obj.id} objective={obj} />
                    ))}
                  </div>
                )}
                <AthleteBlock text={interview.athlete_goals} />
                <CoachBlock text={interview.coach_comment_goals || interview.coach_objectives} />
              </div>

              {/* Engagements & Actions */}
              <div className="rounded-xl bg-card border shadow-sm p-3 space-y-2">
                <SectionLabel label="Engagements & Actions" />
                <AthleteBlock text={interview.athlete_commitments} label="Mes engagements" />
                <CoachBlock text={interview.coach_actions} label="Actions du coach" />
              </div>

              {/* Sign button for sent interviews */}
              {isSent && (
                <Button
                  className="w-full gap-2"
                  onClick={() => onSign(interview.id)}
                  disabled={isSigning}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSigning ? "Signature..." : "Signer l'entretien"}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Conversational section (athlete + coach read-only) ──

function ConversationalSection({
  label,
  athleteText,
  coachText,
}: {
  label: string;
  athleteText?: string | null;
  coachText?: string | null;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel label={label} />
      <AthleteBlock text={athleteText} />
      <CoachBlock text={coachText} />
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function AthleteBlock({ text, label }: { text?: string | null; label?: string }) {
  return (
    <div className="border-l-4 border-blue-400 rounded-r-lg bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-0.5">
      <div className="flex items-center gap-1.5">
        <User className="h-3 w-3 text-blue-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label ?? "Nageur"}
        </p>
      </div>
      <p className="text-sm whitespace-pre-wrap">
        {text?.trim() || <span className="italic text-muted-foreground">Non renseigne</span>}
      </p>
    </div>
  );
}

function CoachBlock({ text, label }: { text?: string | null; label?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="border-l-4 border-amber-400 rounded-r-lg bg-amber-50/50 dark:bg-amber-950/20 p-2.5 space-y-0.5">
      <div className="flex items-center gap-1.5">
        <GraduationCap className="h-3 w-3 text-amber-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label ?? "Coach"}
        </p>
      </div>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

// ── Objective row (compact card) ──

function ObjectiveRow({ objective }: { objective: Objective }) {
  const stroke = objective.event_code ? strokeFromCode(objective.event_code) : null;
  const borderColor = stroke ? STROKE_COLORS[stroke] ?? "" : "";

  return (
    <div className={`flex items-center gap-2 rounded-lg border bg-card p-2 text-sm ${borderColor ? `border-l-4 ${borderColor}` : ""}`}>
      <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        {objective.event_code && (
          <span className="font-medium">{eventLabel(objective.event_code)}</span>
        )}
        {objective.event_code && objective.pool_length && (
          <span className="text-muted-foreground"> ({objective.pool_length}m)</span>
        )}
        {objective.target_time_seconds != null && (
          <span className="ml-1 font-mono text-xs text-primary">
            {formatTime(objective.target_time_seconds)}
          </span>
        )}
        {objective.text && (
          <span className={objective.event_code ? " ml-1 text-muted-foreground" : ""}>
            {objective.text}
          </span>
        )}
      </div>
      {objective.competition_name && (
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {objective.competition_name}
        </Badge>
      )}
    </div>
  );
}

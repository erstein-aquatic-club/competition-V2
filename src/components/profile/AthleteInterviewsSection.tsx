import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Interview, InterviewAthleteInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
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
      toast({ title: "Sauvegardé" });
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
      toast({ title: "Envoyé au coach" });
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
      toast({ title: "Entretien signé" });
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
            onSave={(id, input) => saveMut.mutate({ id, input })}
            onSubmit={(id) => {
              if (
                window.confirm(
                  "Envoyer votre préparation au coach ? Vous ne pourrez plus la modifier.",
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
  onSave,
  onSubmit,
  onSign,
  isSaving,
  isSubmitting,
  isSigning,
}: {
  interview: Interview;
  onSave: (id: string, input: InterviewAthleteInput) => void;
  onSubmit: (id: string) => void;
  onSign: (id: string) => void;
  isSaving: boolean;
  isSubmitting: boolean;
  isSigning: boolean;
}) {
  const isDraft = interview.status === "draft_athlete";
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

  // Track which interview we're saving to avoid cross-card conflicts
  const savingRef = useRef(false);

  const handleBlur = useCallback(() => {
    if (savingRef.current) return;
    savingRef.current = true;
    onSave(interview.id, {
      athlete_successes: successes || null,
      athlete_difficulties: difficulties || null,
      athlete_goals: goals || null,
      athlete_commitments: commitments || null,
    });
    // Reset after short delay to prevent double-save
    setTimeout(() => {
      savingRef.current = false;
    }, 500);
  }, [interview.id, successes, difficulties, goals, commitments, onSave]);

  // Status badge
  const statusBadge = isDraft ? (
    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700">
      <Clock className="h-3 w-3 mr-1" />
      A preparer
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
                <Label htmlFor={`goals-${interview.id}`}>Mes objectifs</Label>
                <Textarea
                  id={`goals-${interview.id}`}
                  placeholder="Ce que je veux atteindre..."
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

          {/* ── Sent / Signed: read-only sections ── */}
          {(isSent || isSigned) && (
            <>
              {/* Athlete sections */}
              <ReadOnlySection
                label="Mes reussites"
                value={interview.athlete_successes}
              />
              <ReadOnlySection
                label="Mes difficultes"
                value={interview.athlete_difficulties}
              />
              <ReadOnlySection
                label="Mes objectifs"
                value={interview.athlete_goals}
              />
              <ReadOnlySection
                label="Mes engagements"
                value={interview.athlete_commitments}
              />

              {/* Coach sections */}
              <ReadOnlySection
                label="Commentaires du coach"
                value={interview.coach_review}
              />
              <ReadOnlySection
                label="Objectifs ajoutes"
                value={interview.coach_objectives}
              />
              <ReadOnlySection
                label="Actions a suivre"
                value={interview.coach_actions}
              />

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

// ── Read-only section helper ──

function ReadOnlySection({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm whitespace-pre-wrap">
        {value || (
          <span className="italic text-muted-foreground">Non renseigne</span>
        )}
      </p>
    </div>
  );
}

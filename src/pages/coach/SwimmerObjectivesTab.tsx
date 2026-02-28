import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Objective, ObjectiveInput, Competition } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Plus, Target, Trash2 } from "lucide-react";
import {
  FFN_EVENTS,
  eventLabel,
  formatTime,
  parseTime,
  STROKE_COLORS,
  strokeFromCode,
  findBestPerformance,
  daysUntil,
  computeProgress,
  progressBarColor,
} from "@/lib/objectiveHelpers";
import type { SwimmerPerformance } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────

interface Props {
  athleteId: number;    // public.users.id (integer)
  athleteName: string;
}

type ObjectiveType = "chrono" | "texte" | "both";

/** Fetch the auth UUID for a public.users integer ID via RPC. */
async function fetchAuthUidForUser(userId: number): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_auth_uid_for_user", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[objectives-tab] Failed to resolve auth UUID:", error.message);
    return null;
  }
  return data as string | null;
}

// ── Objective Form Sheet ────────────────────────────────────────

type ObjectiveFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective?: Objective | null;
  athleteName: string;
  athleteAuthId: string;
  competitions: Competition[];
};

const ObjectiveFormSheet = ({
  open,
  onOpenChange,
  objective,
  athleteName,
  athleteAuthId,
  competitions,
}: ObjectiveFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!objective;

  const [objType, setObjType] = useState<ObjectiveType>("chrono");
  const [eventCode, setEventCode] = useState("");
  const [poolLength, setPoolLength] = useState("25");
  const [targetTime, setTargetTime] = useState("");
  const [text, setText] = useState("");
  const [competitionId, setCompetitionId] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-fill form when sheet opens
  useEffect(() => {
    if (!open) return;
    if (objective) {
      const hasChrono = !!objective.event_code;
      const hasText = !!objective.text;
      setObjType(hasChrono && hasText ? "both" : hasText ? "texte" : "chrono");
      setEventCode(objective.event_code ?? "");
      setPoolLength(String(objective.pool_length ?? 25));
      setTargetTime(
        objective.target_time_seconds != null
          ? formatTime(objective.target_time_seconds)
          : "",
      );
      setText(objective.text ?? "");
      setCompetitionId(objective.competition_id ?? "");
    } else {
      setObjType("chrono");
      setEventCode("");
      setPoolLength("25");
      setTargetTime("");
      setText("");
      setCompetitionId("");
    }
  }, [open, objective]);

  const createMutation = useMutation({
    mutationFn: (input: ObjectiveInput) => api.createObjective(input),
    onSuccess: () => {
      toast({ title: "Objectif créé" });
      void queryClient.invalidateQueries({ queryKey: ["objectives", athleteAuthId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: Partial<ObjectiveInput>) =>
      api.updateObjective(objective!.id, input),
    onSuccess: () => {
      toast({ title: "Objectif mis à jour" });
      void queryClient.invalidateQueries({ queryKey: ["objectives", athleteAuthId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteObjective(objective!.id),
    onSuccess: () => {
      toast({ title: "Objectif supprimé" });
      void queryClient.invalidateQueries({ queryKey: ["objectives", athleteAuthId] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const showChrono = objType === "chrono" || objType === "both";
  const showText = objType === "texte" || objType === "both";

  const handleSubmit = () => {
    if (showChrono && !eventCode) {
      toast({
        title: "Épreuve requise",
        description: "Veuillez sélectionner une épreuve.",
        variant: "destructive",
      });
      return;
    }
    if (showChrono && targetTime) {
      const parsed = parseTime(targetTime);
      if (parsed === null) {
        toast({
          title: "Format invalide",
          description: "Le temps doit être au format m:ss:cc (ex: 1:05:30)",
          variant: "destructive",
        });
        return;
      }
    }
    if (showText && !text.trim()) {
      toast({
        title: "Texte requis",
        description: "Veuillez saisir un objectif texte.",
        variant: "destructive",
      });
      return;
    }

    const input: ObjectiveInput = {
      athlete_id: athleteAuthId,
      competition_id: competitionId && competitionId !== "none" ? competitionId : null,
      event_code: showChrono ? eventCode : null,
      pool_length: showChrono ? Number(poolLength) : null,
      target_time_seconds: showChrono && targetTime ? parseTime(targetTime) : null,
      text: showText ? text.trim() : null,
    };

    if (isEdit) {
      updateMutation.mutate(input);
    } else {
      createMutation.mutate(input);
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  // Filter upcoming competitions for linking
  const upcomingCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return competitions.filter(
      (c) => new Date(c.date + "T00:00:00").getTime() >= today.getTime(),
    );
  }, [competitions]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {isEdit ? "Modifier l'objectif" : "Nouvel objectif"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {/* Athlete (read-only) */}
            <div className="space-y-2">
              <Label>Nageur</Label>
              <p className="text-sm font-medium">{athleteName}</p>
            </div>

            {/* Type toggle */}
            <div className="space-y-2">
              <Label>Type d'objectif</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={objType}
                onValueChange={(val) => {
                  if (val) setObjType(val as ObjectiveType);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="chrono" className="text-xs">
                  Chrono
                </ToggleGroupItem>
                <ToggleGroupItem value="texte" className="text-xs">
                  Texte
                </ToggleGroupItem>
                <ToggleGroupItem value="both" className="text-xs">
                  Les deux
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Chrono fields */}
            {showChrono && (
              <>
                <div className="space-y-2">
                  <Label>Épreuve *</Label>
                  <Select value={eventCode} onValueChange={setEventCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une épreuve" />
                    </SelectTrigger>
                    <SelectContent>
                      {FFN_EVENTS.map((code) => (
                        <SelectItem key={code} value={code}>
                          {eventLabel(code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Bassin</Label>
                  <Select value={poolLength} onValueChange={setPoolLength}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25m</SelectItem>
                      <SelectItem value="50">50m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Temps cible (min:sec:centièmes)</Label>
                  <Input
                    placeholder="Ex : 1:05:30"
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Text field */}
            {showText && (
              <div className="space-y-2">
                <Label>Objectif texte *</Label>
                <Textarea
                  placeholder="Ex : Améliorer la coulée de dos"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Competition link */}
            <div className="space-y-2">
              <Label>Lier à une compétition</Label>
              <Select
                value={competitionId}
                onValueChange={setCompetitionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {upcomingCompetitions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending
                  ? "Enregistrement..."
                  : isEdit
                    ? "Enregistrer"
                    : "Créer"}
              </Button>

              {isEdit && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                >
                  Supprimer cet objectif
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'objectif</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'objectif sera supprimé
              définitivement.
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
    </>
  );
};

// ── Compact Objective Card (same design as interview view) ──

function formatDate(d: string) {
  const p = d.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return d;
}

type ObjectiveCardProps = {
  objective: Objective;
  performances: SwimmerPerformance[];
  onEdit: (obj: Objective) => void;
};

const ObjectiveCard = ({ objective, performances, onEdit }: ObjectiveCardProps) => {
  const stroke = objective.event_code ? strokeFromCode(objective.event_code) : null;
  const borderColor = stroke ? STROKE_COLORS[stroke] ?? "" : "";

  const bestPerf = objective.event_code
    ? findBestPerformance(performances, objective.event_code, objective.pool_length)
    : null;

  let delta: number | null = null;
  let progressPct: number | null = null;
  if (bestPerf && objective.target_time_seconds != null && objective.event_code) {
    delta = bestPerf.time - objective.target_time_seconds;
    progressPct = computeProgress(bestPerf.time, objective.target_time_seconds, objective.event_code);
  }

  const hasCompetition = !!objective.competition_name;
  const leftDays = objective.competition_date ? daysUntil(objective.competition_date) : null;

  return (
    <button
      type="button"
      className={`w-full text-left rounded-lg border bg-card p-3 text-sm space-y-1.5 transition-colors hover:bg-muted/50 ${borderColor ? `border-l-4 ${borderColor}` : ""}`}
      onClick={() => onEdit(objective)}
    >
      {/* Row 1: event info */}
      <div className="flex items-center gap-2 flex-wrap">
        <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          {objective.event_code && (
            <span className="font-medium">{eventLabel(objective.event_code)}</span>
          )}
          {objective.event_code && objective.pool_length && (
            <span className="text-muted-foreground">({objective.pool_length}m)</span>
          )}
          {objective.target_time_seconds != null && (
            <span className="font-mono text-xs text-primary">
              {formatTime(objective.target_time_seconds)}
            </span>
          )}
        </div>
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      </div>

      {/* Text objective */}
      {objective.text && (
        <p className="text-muted-foreground text-xs pl-5 line-clamp-2">{objective.text}</p>
      )}

      {/* Best performance line */}
      {objective.event_code && bestPerf && (
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
      {objective.event_code && !bestPerf && (
        <p className="text-[10px] text-muted-foreground italic pl-5">
          Pas encore de temps enregistré
        </p>
      )}

      {/* Progress bar */}
      {progressPct != null && (
        <div className="pl-5 pr-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor(progressPct)}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Competition countdown */}
      {hasCompetition && (
        <div className="pl-5">
          <Badge
            variant="outline"
            className="border-orange-300 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0"
          >
            {objective.competition_name}
            {leftDays != null && leftDays > 0 && (
              <span className="ml-1 font-bold">J-{leftDays}</span>
            )}
          </Badge>
        </div>
      )}
    </button>
  );
};

// ── Main Component ──────────────────────────────────────────────

const SwimmerObjectivesTab = ({ athleteId, athleteName }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);

  // Resolve the auth UUID for the athlete
  const { data: athleteAuthId, isLoading: authIdLoading } = useQuery({
    queryKey: ["auth-uid", athleteId],
    queryFn: () => fetchAuthUidForUser(athleteId),
    enabled: !!athleteId,
  });

  // Competitions query
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  // Objectives query
  const { data: objectives = [], isLoading: objectivesLoading } = useQuery({
    queryKey: ["objectives", athleteAuthId],
    queryFn: () => api.getObjectives(athleteAuthId!),
    enabled: !!athleteAuthId,
  });

  // Fetch athlete IUF for performance lookup
  const { data: athleteProfile } = useQuery({
    queryKey: ["profile", athleteId],
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

  const handleCreate = () => {
    setEditingObj(null);
    setShowForm(true);
  };

  const handleEdit = (obj: Objective) => {
    setEditingObj(obj);
    setShowForm(true);
  };

  const isLoading = authIdLoading;
  const showObjectivesList = !!athleteAuthId && !authIdLoading;

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!athleteAuthId}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter un objectif
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-3 animate-pulse motion-reduce:animate-none"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="ml-auto h-5 w-12 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Objectives loading */}
      {showObjectivesList && objectivesLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-3 animate-pulse motion-reduce:animate-none"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="ml-auto h-5 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showObjectivesList && !objectivesLoading && objectives.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <Target className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aucun objectif défini pour {athleteName}.
          </p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Créer le premier objectif
          </Button>
        </div>
      )}

      {/* Objectives list */}
      {showObjectivesList && !objectivesLoading && objectives.length > 0 && (
        <div className="space-y-2">
          {objectives.map((obj) => (
            <ObjectiveCard key={obj.id} objective={obj} performances={performances} onEdit={handleEdit} />
          ))}
          <p className="text-[10px] text-muted-foreground/60 italic text-center pt-1">
            Les temps « Actuel » correspondent à la meilleure performance des 360 derniers jours sur l'épreuve.
          </p>
        </div>
      )}

      {/* Form sheet */}
      {athleteAuthId && (
        <ObjectiveFormSheet
          open={showForm}
          onOpenChange={setShowForm}
          objective={editingObj}
          athleteName={athleteName}
          athleteAuthId={athleteAuthId}
          competitions={competitions}
        />
      )}
    </div>
  );
};

export default SwimmerObjectivesTab;

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Objective, ObjectiveInput } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { ArrowLeft, Plus, Target, Trash2 } from "lucide-react";
import {
  FFN_EVENTS,
  eventLabel,
  formatTime,
  parseTime,
  STROKE_COLORS,
  strokeFromCode,
  findBestTime,
  daysUntil,
} from "@/lib/objectiveHelpers";

type Props = { onBack: () => void };
type ObjectiveType = "chrono" | "texte" | "both";

export default function SwimmerObjectivesView({ onBack }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Objective | null>(null);

  // Get current auth user UUID
  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const authUid = authUser?.id ?? null;

  // Get objectives for current athlete
  const { data: objectives = [], isLoading } = useQuery({
    queryKey: ["athlete-objectives"],
    queryFn: () => api.getAthleteObjectives(),
    enabled: !!authUid,
    refetchInterval: 30_000,
  });

  // Get swim records for progress gauge
  const { userId } = useAuth();
  const { data: swimRecordsData } = useQuery({
    queryKey: ["swim-records", userId],
    queryFn: () => api.getSwimRecords({ athleteId: userId }),
    enabled: !!userId,
  });
  const swimRecords = swimRecordsData?.records ?? [];

  // Split into coach vs personal
  const coachObjectives = useMemo(
    () => objectives.filter((o) => o.created_by !== authUid),
    [objectives, authUid],
  );
  const personalObjectives = useMemo(
    () => objectives.filter((o) => o.created_by === authUid),
    [objectives, authUid],
  );

  // ── Form state ──
  const [objType, setObjType] = useState<ObjectiveType>("chrono");
  const [eventCode, setEventCode] = useState("");
  const [poolLength, setPoolLength] = useState("25");
  const [targetTime, setTargetTime] = useState("");
  const [text, setText] = useState("");

  const resetForm = () => {
    setObjType("chrono");
    setEventCode("");
    setPoolLength("25");
    setTargetTime("");
    setText("");
  };

  const openCreate = () => {
    setEditingObj(null);
    resetForm();
    setShowForm(true);
  };

  const openEdit = (obj: Objective) => {
    setEditingObj(obj);
    const hasChrono = !!obj.event_code;
    const hasText = !!obj.text;
    setObjType(hasChrono && hasText ? "both" : hasText ? "texte" : "chrono");
    setEventCode(obj.event_code ?? "");
    setPoolLength(String(obj.pool_length ?? 25));
    setTargetTime(
      obj.target_time_seconds != null
        ? formatTime(obj.target_time_seconds)
        : "",
    );
    setText(obj.text ?? "");
    setShowForm(true);
  };

  // ── Mutations ──
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["athlete-objectives"] });

  const createMut = useMutation({
    mutationFn: (input: ObjectiveInput) => api.createObjective(input),
    onSuccess: () => {
      toast({ title: "Objectif créé" });
      invalidate();
      setShowForm(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (input: Partial<ObjectiveInput>) =>
      api.updateObjective(editingObj!.id, input),
    onSuccess: () => {
      toast({ title: "Objectif mis à jour" });
      invalidate();
      setShowForm(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteObjective(id),
    onSuccess: () => {
      toast({ title: "Objectif supprimé" });
      invalidate();
      setDeleteTarget(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const showChrono = objType === "chrono" || objType === "both";
  const showText = objType === "texte" || objType === "both";
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    if (showChrono && !eventCode) {
      toast({ title: "Épreuve requise", variant: "destructive" });
      return;
    }
    if (showChrono && targetTime && parseTime(targetTime) === null) {
      toast({
        title: "Format invalide",
        description: "Format : m:ss:cc (ex: 1:05:30)",
        variant: "destructive",
      });
      return;
    }
    if (showText && !text.trim()) {
      toast({ title: "Texte requis", variant: "destructive" });
      return;
    }
    if (!authUid) return;

    const input: ObjectiveInput = {
      athlete_id: authUid,
      event_code: showChrono ? eventCode : null,
      pool_length: showChrono ? Number(poolLength) : null,
      target_time_seconds:
        showChrono && targetTime ? parseTime(targetTime) : null,
      text: showText ? text.trim() : null,
    };

    if (editingObj) {
      updateMut.mutate(input);
    } else {
      createMut.mutate(input);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-semibold uppercase italic text-primary">
              Mon plan
            </h2>
            <p className="text-sm text-muted-foreground">
              Mes objectifs d'entraînement
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-3 animate-pulse motion-reduce:animate-none"
            >
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && objectives.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <Target className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aucun objectif pour le moment.
          </p>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter un objectif
          </Button>
        </div>
      )}

      {/* Coach objectives (read-only) */}
      {coachObjectives.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Objectifs du coach
          </h3>
          {coachObjectives.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              isPersonal={false}
              bestTime={obj.event_code ? findBestTime(swimRecords, obj.event_code, obj.pool_length) : null}
            />
          ))}
        </div>
      )}

      {/* Personal objectives (editable) */}
      {personalObjectives.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Mes objectifs personnels
          </h3>
          {personalObjectives.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              isPersonal={true}
              bestTime={obj.event_code ? findBestTime(swimRecords, obj.event_code, obj.pool_length) : null}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Bottom sheet form */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingObj ? "Modifier l'objectif" : "Nouvel objectif"}
            </SheetTitle>
            <SheetDescription>
              {editingObj
                ? "Modifiez votre objectif personnel."
                : "Ajoutez un objectif personnel."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {/* Type toggle */}
            <div className="space-y-2">
              <Label>Type d'objectif</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={objType}
                onValueChange={(v) => {
                  if (v) setObjType(v as ObjectiveType);
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

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending
                ? "Enregistrement..."
                : editingObj
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
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
                if (deleteTarget) deleteMut.mutate(deleteTarget.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Unified Objective Card with visual gauge ──

function ObjectiveCard({
  objective,
  isPersonal,
  bestTime,
  onEdit,
  onDelete,
}: {
  objective: Objective;
  isPersonal: boolean;
  bestTime: number | null;
  onEdit?: (obj: Objective) => void;
  onDelete?: (obj: Objective) => void;
}) {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;
  const stroke = hasChrono ? strokeFromCode(objective.event_code!) : null;
  const borderColor = stroke ? STROKE_COLORS[stroke] ?? "" : "";
  const hasTarget = objective.target_time_seconds != null;
  const hasCompetition = !!objective.competition_name;
  const leftDays = objective.competition_date ? daysUntil(objective.competition_date) : null;

  // Progress calculation: how close is current best to target
  let progressPct: number | null = null;
  if (hasTarget && bestTime != null && objective.target_time_seconds != null) {
    const target = objective.target_time_seconds;
    if (bestTime <= target) {
      progressPct = 100;
    } else {
      const baseline = target * 1.2; // 20% slower as baseline
      if (bestTime >= baseline) {
        progressPct = 5; // minimum visible bar
      } else {
        progressPct = Math.round(((baseline - bestTime) / (baseline - target)) * 100);
      }
    }
  }

  return (
    <div
      className={[
        "rounded-xl border bg-card p-4 space-y-3",
        hasChrono ? `border-l-4 ${borderColor}` : "",
      ].join(" ")}
    >
      {/* Top row: event info + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isPersonal && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Coach
          </Badge>
        )}
        {hasChrono && (
          <>
            <span className="text-sm font-semibold">
              {eventLabel(objective.event_code!)}
            </span>
            {objective.pool_length && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {objective.pool_length}m
              </Badge>
            )}
          </>
        )}
        {isPersonal && onEdit && onDelete && (
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => onEdit(objective)}
              className="text-xs text-primary hover:underline"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => onDelete(objective)}
              className="text-muted-foreground hover:text-destructive p-0.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chrono: large target time + progress bar */}
      {hasChrono && hasTarget && (
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            {bestTime != null ? (
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{formatTime(bestTime)}</span>
                <span className="ml-1">actuel</span>
              </div>
            ) : (
              <div />
            )}
            <div className="text-right">
              <div className="text-2xl font-mono font-bold tracking-tight text-primary">
                {formatTime(objective.target_time_seconds!)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                objectif
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {progressPct != null && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-500",
                    progressPct >= 100 ? "bg-emerald-500" : "bg-primary",
                  ].join(" ")}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground text-right">
                {progressPct >= 100
                  ? "Objectif atteint !"
                  : `+${(bestTime! - objective.target_time_seconds!).toFixed(1)}s`}
              </div>
            </div>
          )}

          {/* No record fallback */}
          {bestTime == null && (
            <p className="text-[10px] text-muted-foreground italic">
              Pas encore de temps enregistré pour cette épreuve
            </p>
          )}
        </div>
      )}

      {/* Text objective */}
      {hasText && (
        <p className="text-sm text-muted-foreground">{objective.text}</p>
      )}

      {/* Competition countdown */}
      {hasCompetition && (
        <Badge
          variant="outline"
          className="border-orange-300 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0"
        >
          {objective.competition_name}
          {leftDays != null && leftDays > 0 && (
            <span className="ml-1 font-bold">J-{leftDays}</span>
          )}
        </Badge>
      )}
    </div>
  );
}

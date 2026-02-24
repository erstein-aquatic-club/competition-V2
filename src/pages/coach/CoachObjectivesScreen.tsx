import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Objective, ObjectiveInput, Competition } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import CoachSectionHeader from "./CoachSectionHeader";
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
import { Plus, Target } from "lucide-react";
import { FFN_EVENTS, eventLabel, formatTime, parseTime } from "@/lib/objectiveHelpers";

/** Fetch the auth UUID for a public.users integer ID via RPC. */
async function fetchAuthUidForUser(userId: number): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_auth_uid_for_user", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[objectives] Failed to resolve auth UUID:", error.message);
    return null;
  }
  return data as string | null;
}

// ── Types ───────────────────────────────────────────────────────

type Props = {
  onBack: () => void;
  athletes: Array<{
    id: number | null;
    display_name: string;
    group_label?: string | null;
  }>;
  athletesLoading: boolean;
};

type ObjectiveType = "chrono" | "texte" | "both";

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

  // Reset form when opening
  const handleOpenChange = (next: boolean) => {
    if (next) {
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
    }
    onOpenChange(next);
  };

  const createMutation = useMutation({
    mutationFn: (input: ObjectiveInput) => api.createObjective(input),
    onSuccess: () => {
      toast({ title: "Objectif cree" });
      void queryClient.invalidateQueries({ queryKey: ["objectives"] });
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
      toast({ title: "Objectif mis a jour" });
      void queryClient.invalidateQueries({ queryKey: ["objectives"] });
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
      toast({ title: "Objectif supprime" });
      void queryClient.invalidateQueries({ queryKey: ["objectives"] });
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
        title: "Epreuve requise",
        description: "Veuillez selectionner une epreuve.",
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
      <Sheet open={open} onOpenChange={handleOpenChange}>
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
                  <Label>Epreuve *</Label>
                  <Select value={eventCode} onValueChange={setEventCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une epreuve" />
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
                  placeholder="Ex : Ameliorer la coulée de dos"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Competition link */}
            <div className="space-y-2">
              <Label>Lier a une competition</Label>
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
                    : "Creer"}
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
              Cette action est irreversible. L'objectif sera supprime
              definitivement.
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

// ── Objective Card ──────────────────────────────────────────────

type ObjectiveCardProps = {
  objective: Objective;
  onEdit: (obj: Objective) => void;
};

const ObjectiveCard = ({ objective, onEdit }: ObjectiveCardProps) => {
  const hasChrono = !!objective.event_code;
  const hasText = !!objective.text;

  return (
    <button
      type="button"
      className="w-full text-left rounded-xl border bg-card p-3 space-y-1.5 transition-colors hover:bg-muted/50"
      onClick={() => onEdit(objective)}
    >
      {hasChrono && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">
            {eventLabel(objective.event_code!)}
          </span>
          {objective.pool_length && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {objective.pool_length}m
            </Badge>
          )}
          {objective.target_time_seconds != null && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-mono"
            >
              {formatTime(objective.target_time_seconds)}
            </Badge>
          )}
        </div>
      )}
      {hasText && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {objective.text}
        </p>
      )}
      {objective.competition_name && (
        <Badge
          variant="outline"
          className="border-orange-300 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0"
        >
          {objective.competition_name}
        </Badge>
      )}
    </button>
  );
};

// ── Main Component ──────────────────────────────────────────────

const CoachObjectivesScreen = ({
  onBack,
  athletes,
  athletesLoading,
}: Props) => {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);

  // Find the selected athlete object
  const selectedAthlete = useMemo(() => {
    if (!selectedUserId) return null;
    return athletes.find((a) => a.id != null && String(a.id) === selectedUserId) ?? null;
  }, [athletes, selectedUserId]);

  // Resolve the auth UUID for the selected athlete
  const { data: selectedAthleteAuthId, isLoading: authIdLoading } = useQuery({
    queryKey: ["auth-uid", selectedUserId],
    queryFn: () => fetchAuthUidForUser(Number(selectedUserId)),
    enabled: !!selectedUserId,
  });

  // Competitions query
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.getCompetitions(),
  });

  // Objectives query
  const { data: objectives = [], isLoading: objectivesLoading } = useQuery({
    queryKey: ["objectives", selectedAthleteAuthId],
    queryFn: () => api.getObjectives(selectedAthleteAuthId!),
    enabled: !!selectedAthleteAuthId,
  });

  // Group athletes by group_label for the select
  const groupedAthletes = useMemo(() => {
    const valid = athletes.filter((a) => a.id != null);
    const map = new Map<string, typeof valid>();
    for (const a of valid) {
      const label = a.group_label || "Sans groupe";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(a);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [athletes]);

  const handleCreate = () => {
    if (!selectedAthleteAuthId) {
      toast({
        title: "Nageur requis",
        description: "Veuillez selectionner un nageur.",
        variant: "destructive",
      });
      return;
    }
    setEditingObj(null);
    setShowForm(true);
  };

  const handleEdit = (obj: Objective) => {
    setEditingObj(obj);
    setShowForm(true);
  };

  const isLoading = athletesLoading || (!!selectedUserId && authIdLoading);
  const showObjectivesList = !!selectedAthleteAuthId && !authIdLoading;

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Objectifs"
        description="Definissez des objectifs chrono ou texte pour chaque nageur."
        onBack={onBack}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreate}
            disabled={!selectedAthleteAuthId}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter
          </Button>
        }
      />

      {/* Athlete selector */}
      <div className="space-y-2">
        <Label>Nageur</Label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Selectionner un nageur" />
          </SelectTrigger>
          <SelectContent>
            {groupedAthletes.map(([groupLabel, groupAthletes]) => (
              <div key={groupLabel}>
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabel}
                </div>
                {groupAthletes.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <div className="flex items-center gap-2">
                      <span>{a.display_name}</span>
                      {a.group_label && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {a.group_label}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content area */}
      {!selectedUserId && (
        <div className="text-center py-12 space-y-3">
          <Target className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Selectionnez un nageur pour voir et gerer ses objectifs.
          </p>
        </div>
      )}

      {isLoading && selectedUserId && (
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

      {showObjectivesList && !objectivesLoading && objectives.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <Target className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Aucun objectif defini pour {selectedAthlete?.display_name}.
          </p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Creer le premier objectif
          </Button>
        </div>
      )}

      {showObjectivesList && !objectivesLoading && objectives.length > 0 && (
        <div className="space-y-2">
          {objectives.map((obj) => (
            <ObjectiveCard key={obj.id} objective={obj} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Form sheet */}
      {selectedAthleteAuthId && selectedAthlete && (
        <ObjectiveFormSheet
          open={showForm}
          onOpenChange={setShowForm}
          objective={editingObj}
          athleteName={selectedAthlete.display_name}
          athleteAuthId={selectedAthleteAuthId}
          competitions={competitions}
        />
      )}
    </div>
  );
};

export default CoachObjectivesScreen;

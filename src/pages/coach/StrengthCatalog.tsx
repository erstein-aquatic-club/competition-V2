
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Exercise, StrengthCycleType, StrengthSessionItem, StrengthSessionTemplate } from "@/lib/api";
import type { StrengthSessionInput } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Filter, Edit2, GripVertical, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ExerciseDraft = Omit<Exercise, "id"> & {
  id?: number;
  description?: string | null;
  illustration_gif?: string | null;
};

const cycleTabs = [
  { key: "endurance", label: "Endurance", fieldSuffix: "endurance" },
  { key: "hypertrophie", label: "Hypertrophie", fieldSuffix: "hypertrophie" },
  { key: "force", label: "Force", fieldSuffix: "force" },
] as const;

const normalizeStrengthCycle = (value?: string | null): StrengthCycleType => {
  if (value === "endurance" || value === "hypertrophie" || value === "force") {
    return value;
  }
  return "endurance";
};

const ExerciseCycleTabs = ({
  exercise,
  onChange,
  disabled = false,
}: {
  exercise: ExerciseDraft;
  onChange: (updates: Partial<ExerciseDraft>) => void;
  disabled?: boolean;
}) => (
  <Tabs defaultValue="endurance" className="w-full">
    <TabsList className="grid w-full grid-cols-3">
      {cycleTabs.map((tab) => (
        <TabsTrigger key={tab.key} value={tab.key}>
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {cycleTabs.map((tab) => {
      const pctField = `pct_1rm_${tab.fieldSuffix}` as keyof ExerciseDraft;
      const seriesField = `Nb_series_${tab.fieldSuffix}` as keyof ExerciseDraft;
      const repsField = `Nb_reps_${tab.fieldSuffix}` as keyof ExerciseDraft;
      const recupField = `recup_${tab.fieldSuffix}` as keyof ExerciseDraft;
      const recupExField = `recup_exercices_${tab.fieldSuffix}` as keyof ExerciseDraft;
      return (
        <TabsContent
          key={tab.key}
          value={tab.key}
          className={`space-y-3 rounded-lg border p-3 ${disabled ? "opacity-60" : ""}`}
        >
          <p className="text-sm font-semibold">{tab.label}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>% 1RM</Label>
              <Input
                type="number"
                value={exercise[pctField] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ [pctField]: e.target.value === "" ? null : Number(e.target.value) } as Partial<ExerciseDraft>)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nb séries</Label>
              <Input
                type="number"
                value={exercise[seriesField] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ [seriesField]: e.target.value === "" ? null : Number(e.target.value) } as Partial<ExerciseDraft>)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nb reps</Label>
              <Input
                type="number"
                value={exercise[repsField] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ [repsField]: e.target.value === "" ? null : Number(e.target.value) } as Partial<ExerciseDraft>)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Récup. séries (s)</Label>
              <Input
                type="number"
                value={exercise[recupField] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ [recupField]: e.target.value === "" ? null : Number(e.target.value) } as Partial<ExerciseDraft>)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Récup. exercices (s)</Label>
              <Input
                type="number"
                value={exercise[recupExField] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ [recupExField]: e.target.value === "" ? null : Number(e.target.value) } as Partial<ExerciseDraft>)
                }
              />
            </div>
          </div>
        </TabsContent>
      );
    })}
  </Tabs>
);

const defaultExerciseValues = {
  pct_1rm_endurance: 60,
  pct_1rm_hypertrophie: 75,
  pct_1rm_force: 85,
  Nb_series_endurance: 4,
  Nb_series_hypertrophie: 3,
  Nb_series_force: 3,
  Nb_reps_endurance: 16,
  Nb_reps_hypertrophie: 8,
  Nb_reps_force: 3,
  recup_endurance: 120,
  recup_hypertrophie: 200,
  recup_force: 300,
  recup_exercices_endurance: 300,
  recup_exercices_hypertrophie: 400,
  recup_exercices_force: 500,
};

const resolveExerciseNumber = (value?: number | null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const createStrengthItemFromExercise = (
  exercise: Exercise,
  cycle: StrengthCycleType,
  orderIndex: number,
  existing?: StrengthSessionItem,
): StrengthSessionItem => {
  const cycleSuffix = cycle === "force" ? "force" : cycle === "hypertrophie" ? "hypertrophie" : "endurance";
  const setsField = `Nb_series_${cycleSuffix}` as const;
  const repsField = `Nb_reps_${cycleSuffix}` as const;
  const percentField = `pct_1rm_${cycleSuffix}` as const;
  const restField = `recup_${cycleSuffix}` as const;
  return {
    exercise_id: exercise.id,
    order_index: orderIndex,
    sets: resolveExerciseNumber(exercise[setsField]),
    reps: resolveExerciseNumber(exercise[repsField]),
    rest_seconds: resolveExerciseNumber(exercise[restField]),
    percent_1rm: resolveExerciseNumber(exercise[percentField]),
    cycle_type: cycle,
    notes: existing?.notes ?? "",
  };
};

const createDefaultExercise = (): ExerciseDraft => ({
  nom_exercice: "",
  description: null,
  illustration_gif: null,
  exercise_type: "strength",
  warmup_reps: null,
  warmup_duration: null,
  ...defaultExerciseValues,
});

const WarmupFields = ({
  exercise,
  warmupMode,
  onChange,
  onWarmupModeChange,
  idPrefix,
}: {
  exercise: ExerciseDraft;
  warmupMode: "reps" | "duration";
  onChange: (updates: Partial<ExerciseDraft>) => void;
  onWarmupModeChange: (mode: "reps" | "duration") => void;
  idPrefix: string;
}) => {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-semibold">Paramètres d’échauffement</p>
      <RadioGroup
        value={warmupMode}
        onValueChange={(value) => {
          const mode = value === "duration" ? "duration" : "reps";
          onWarmupModeChange(mode);
          if (value === "duration") {
            onChange({
              warmup_reps: null,
              warmup_duration: exercise.warmup_duration ?? 0,
            });
          } else {
            onChange({
              warmup_duration: null,
              warmup_reps: exercise.warmup_reps ?? 0,
            });
          }
        }}
        className="grid gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="reps" id={`${idPrefix}-warmup-reps`} />
          <Label htmlFor={`${idPrefix}-warmup-reps`}>Nombre de répétitions</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="duration" id={`${idPrefix}-warmup-duration`} />
          <Label htmlFor={`${idPrefix}-warmup-duration`}>Durée (secondes)</Label>
        </div>
      </RadioGroup>
      {warmupMode === "duration" ? (
        <div className="space-y-2">
          <Label>Durée (s)</Label>
          <Input
            type="number"
            value={exercise.warmup_duration ?? ""}
            onChange={(e) =>
              onChange({
                warmup_duration: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Nombre de répétitions</Label>
          <Input
            type="number"
            value={exercise.warmup_reps ?? ""}
            onChange={(e) =>
              onChange({
                warmup_reps: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      )}
    </div>
  );
};

export default function StrengthCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [exerciseFilter, setExerciseFilter] = useState<"all" | "strength" | "warmup">("all");
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [exerciseEditOpen, setExerciseEditOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseDraft | null>(null);
  const [detailSession, setDetailSession] = useState<StrengthSessionTemplate | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<StrengthSessionTemplate | null>(null);
  const [pendingDeleteExercise, setPendingDeleteExercise] = useState<Exercise | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [newWarmupMode, setNewWarmupMode] = useState<"reps" | "duration">("reps");
  const [editWarmupMode, setEditWarmupMode] = useState<"reps" | "duration">("reps");
  
  // New Session State
  const [newSession, setNewSession] = useState<{
    title: string;
    description: string;
    cycle: StrengthCycleType;
    items: StrengthSessionItem[];
  }>({
    title: "",
    description: "",
    cycle: "endurance",
    items: [],
  });
  const [newExercise, setNewExercise] = useState<ExerciseDraft>({
    ...createDefaultExercise(),
  });

  useEffect(() => {
    if (editingExercise) {
      setEditWarmupMode(editingExercise.warmup_duration != null ? "duration" : "reps");
    }
  }, [editingExercise]);

  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.getExercises() });
  const { data: sessions } = useQuery({ queryKey: ["strength_catalog"], queryFn: () => api.getStrengthSessions() });
  const exerciseById = useMemo(
    () => new Map((exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises],
  );

  const createExercise = useMutation({
      mutationFn: (data: Omit<Exercise, "id">) => api.createExercise(data),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["exercises"] });
          setExerciseDialogOpen(false);
          toast({ title: "Exercice ajouté" });
      },
  });

  const createSession = useMutation({
      mutationFn: (data: StrengthSessionInput) => api.createStrengthSession(data),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
          setIsCreating(false);
          setNewSession({ title: "", description: "", cycle: "endurance", items: [] });
          toast({ title: "Séance créée avec succès" });
      }
  });

  const updateExercise = useMutation({
      mutationFn: (data: Exercise) => api.updateExercise(data),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["exercises"] });
          queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
          setExerciseEditOpen(false);
          setEditingExercise(null);
          toast({ title: "Exercice mis à jour" });
      },
  });

  const deleteExercise = useMutation({
      mutationFn: (exerciseId: number) => api.deleteExercise(exerciseId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["exercises"] });
        queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
        setPendingDeleteExercise(null);
        toast({ title: "Exercice supprimé" });
      },
  });

  const deleteSession = useMutation({
      mutationFn: (sessionId: number) => api.deleteStrengthSession(sessionId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
        setPendingDeleteSession(null);
        toast({ title: "Séance supprimée" });
      },
  });

  const updateSession = useMutation({
      mutationFn: (data: StrengthSessionInput) => api.updateStrengthSession(data),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["strength_catalog"] });
          setIsCreating(false);
          setEditingSessionId(null);
          setNewSession({ title: "", description: "", cycle: "endurance", items: [] });
          toast({ title: "Séance mise à jour" });
      }
  });

  const persistOrder = useMutation({
      mutationFn: (session: StrengthSessionTemplate) => api.persistStrengthSessionOrder(session),
  });

  const resetSessionForm = () => {
      setIsCreating(false);
      setEditingSessionId(null);
      setNewSession({ title: "", description: "", cycle: "endurance", items: [] });
  };

  const startEditSession = (session: StrengthSessionTemplate) => {
      setEditingSessionId(session.id);
      setNewSession({
          title: session.title ?? "",
          description: session.description ?? "",
          cycle: normalizeStrengthCycle(session.cycle),
          items: session.items?.map((item) => ({
              exercise_id: item.exercise_id,
              order_index: item.order_index ?? 0,
              sets: item.sets,
              reps: item.reps,
              rest_seconds: item.rest_seconds,
              percent_1rm: item.percent_1rm,
              cycle_type: item.cycle_type,
              notes: item.notes ?? "",
          })) ?? [],
      });
      setIsCreating(true);
  };

  const startEditExercise = (exercise: Exercise) => {
      setEditingExercise(exercise);
      setExerciseEditOpen(true);
  };

  const handleSaveSession = () => {
      const sessionPayload = { ...newSession, items: updateOrderIndexes(newSession.items) };
      if (editingSessionId) {
          updateSession.mutate({ ...sessionPayload, id: editingSessionId });
      } else {
          createSession.mutate(sessionPayload);
      }
  };

  const updateOrderIndexes = (items: StrengthSessionItem[]) =>
      items.map((item, index) => ({ ...item, order_index: index }));

  const addItem = () => {
      const fallbackExercise = exercises?.[0];
      setNewSession(prev => ({
          ...prev,
          items: [
            ...prev.items,
            fallbackExercise
              ? createStrengthItemFromExercise(fallbackExercise, prev.cycle, prev.items.length)
              : {
                  exercise_id: 1,
                  order_index: prev.items.length,
                  sets: 0,
                  reps: 0,
                  rest_seconds: 0,
                  percent_1rm: 0,
                },
          ]
      }));
  };

  const updateItem = (index: number, field: string, value: string | number | null) => {
      const items = [...newSession.items];
      if (field === "exercise_id") {
        const exercise = exercises?.find((entry) => entry.id === value);
        if (exercise) {
          items[index] = createStrengthItemFromExercise(
            exercise,
            newSession.cycle,
            items[index].order_index ?? index,
            items[index],
          );
        } else {
          items[index] = { ...items[index], exercise_id: Number(value) };
        }
      } else {
        items[index] = { ...items[index], [field]: value };
      }
      setNewSession({ ...newSession, items });
  };

  const removeItem = (index: number) => {
      const items = updateOrderIndexes(newSession.items.filter((_, i) => i !== index));
      setNewSession({ ...newSession, items });
  };

  const reorderItems = (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const items = [...newSession.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      const updatedItems = updateOrderIndexes(items);
      setNewSession({ ...newSession, items: updatedItems });
      if (editingSessionId) {
        persistOrder.mutate({
          id: editingSessionId,
          title: newSession.title,
          description: newSession.description,
          cycle: newSession.cycle,
          items: updatedItems,
        });
      }
  };

  const selectedExerciseIds = new Set(newSession.items.map((item) => item.exercise_id));
  const filteredExercises =
      exercises?.filter((exercise) => {
          if (exerciseFilter === "all") return true;
          if (selectedExerciseIds.has(exercise.id)) return true;
          return exercise.exercise_type === exerciseFilter;
      }) ?? [];

  const exerciseEditDialog = (
      <Dialog open={exerciseEditOpen} onOpenChange={setExerciseEditOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto pb-safe">
              <DialogHeader>
                  <DialogTitle>Modifier l’exercice</DialogTitle>
              </DialogHeader>
              {editingExercise && (
                <div className="space-y-4">
                  {editingExercise.exercise_type === "warmup" ? (
                      <WarmupFields
                        exercise={editingExercise}
                        warmupMode={editWarmupMode}
                        onChange={(updates) =>
                          setEditingExercise((prev) => (prev ? { ...prev, ...updates } : prev))
                        }
                        onWarmupModeChange={setEditWarmupMode}
                        idPrefix="edit"
                      />
                    ) : null}
                    <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input
                          value={editingExercise.nom_exercice}
                          onChange={(e) =>
                            setEditingExercise({ ...editingExercise, nom_exercice: e.target.value })
                          }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={editingExercise.description ?? ""}
                          onChange={(e) =>
                            setEditingExercise({
                              ...editingExercise,
                              description: e.target.value === "" ? null : e.target.value,
                            })
                          }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Illustration (GIF)</Label>
                        <Input
                          value={editingExercise.illustration_gif ?? ""}
                          onChange={(e) =>
                            setEditingExercise({
                              ...editingExercise,
                              illustration_gif: e.target.value === "" ? null : e.target.value,
                            })
                          }
                          placeholder="https://..."
                        />
                    </div>
                    {editingExercise.exercise_type !== "warmup" ? (
                      <ExerciseCycleTabs
                        exercise={editingExercise}
                        onChange={(updates) =>
                          setEditingExercise((prev) => (prev ? { ...prev, ...updates } : prev))
                        }
                      />
                    ) : null}
                    <div className="flex items-center gap-2">
                        <Checkbox
                          id="warmup-flag-edit"
                          checked={editingExercise.exercise_type === "warmup"}
                          onCheckedChange={(checked) =>
                            setEditingExercise({
                              ...editingExercise,
                              exercise_type: checked === true ? "warmup" : "strength",
                            })
                          }
                        />
                        <Label htmlFor="warmup-flag-edit">Exercice d’échauffement (warmup)</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setExerciseEditOpen(false);
                            setEditingExercise(null);
                          }}
                        >
                          Annuler
                        </Button>
                        <Button
                          onClick={() => {
                            if (!editingExercise?.id) return;
                            updateExercise.mutate(editingExercise as Exercise);
                          }}
                          disabled={!editingExercise.nom_exercice.trim()}
                        >
                            <Save className="mr-2 h-4 w-4"/> Enregistrer
                        </Button>
                    </div>
                </div>
              )}
          </DialogContent>
      </Dialog>
  );

  const exerciseCreateDialog = (
      <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto pb-safe">
                <DialogHeader>
                    <DialogTitle>Créer un exercice</DialogTitle>
                </DialogHeader>
              <div className="space-y-4">
                  {newExercise.exercise_type === "warmup" ? (
                    <WarmupFields
                      exercise={newExercise}
                      warmupMode={newWarmupMode}
                      onChange={(updates) => setNewExercise((prev) => ({ ...prev, ...updates }))}
                      onWarmupModeChange={setNewWarmupMode}
                      idPrefix="create"
                    />
                  ) : null}
                  <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={newExercise.nom_exercice}
                        onChange={(e) => setNewExercise({ ...newExercise, nom_exercice: e.target.value })}
                        placeholder="ex: Rotations Élastique"
                      />
                  </div>
                  <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newExercise.description ?? ""}
                        onChange={(e) =>
                          setNewExercise({
                            ...newExercise,
                            description: e.target.value === "" ? null : e.target.value,
                          })
                        }
                        placeholder="Détails, consignes..."
                      />
                  </div>
                  <div className="space-y-2">
                      <Label>Illustration (GIF)</Label>
                      <Input
                        value={newExercise.illustration_gif ?? ""}
                        onChange={(e) =>
                          setNewExercise({
                            ...newExercise,
                            illustration_gif: e.target.value === "" ? null : e.target.value,
                          })
                        }
                        placeholder="https://..."
                      />
                  </div>
                  {newExercise.exercise_type !== "warmup" ? (
                    <ExerciseCycleTabs
                      exercise={newExercise}
                      onChange={(updates) => setNewExercise((prev) => ({ ...prev, ...updates }))}
                    />
                  ) : null}
                  <div className="flex items-center gap-2">
                      <Checkbox
                        id="warmup-flag"
                        checked={newExercise.exercise_type === "warmup"}
                        onCheckedChange={(checked) =>
                          setNewExercise({
                            ...newExercise,
                            exercise_type: checked === true ? "warmup" : "strength",
                          })
                        }
                      />
                      <Label htmlFor="warmup-flag">Exercice d’échauffement (warmup)</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setExerciseDialogOpen(false)}>Annuler</Button>
                      <Button
                        onClick={() => createExercise.mutate(newExercise)}
                        disabled={!newExercise.nom_exercice.trim()}
                      >
                          <Save className="mr-2 h-4 w-4"/> Enregistrer
                      </Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
  );

  const detailsDialog = (
      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setDetailSession(null);
          }
        }}
      >
          <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Détails de la séance</DialogTitle>
              </DialogHeader>
              {detailSession && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">{detailSession.title}</p>
                    <p className="text-sm text-muted-foreground">{detailSession.description || "—"}</p>
                    <p className="text-sm text-muted-foreground">Cycle : {detailSession.cycle}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Exercices</p>
                    <div className="space-y-2">
                      {(detailSession.items ?? [])
                        .slice()
                        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                        .map((item, index) => {
                          const exercise = exerciseById.get(item.exercise_id);
                          return (
                            <div key={`${item.exercise_id}-${index}`} className="rounded-md border px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {index + 1}. {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {exercise?.exercise_type === "warmup" || item.category === "warmup"
                                    ? "Échauffement"
                                    : "Travail"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.sets} séries • {item.reps} reps • {item.percent_1rm}% 1RM • {item.rest_seconds}s
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
          </DialogContent>
      </Dialog>
  );

  const deleteSessionDialog = (
    <AlertDialog
      open={Boolean(pendingDeleteSession)}
      onOpenChange={(open) => {
        if (!open) {
          setPendingDeleteSession(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la séance ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive. La séance "{pendingDeleteSession?.title}" sera supprimée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingDeleteSession?.id) {
                deleteSession.mutate(pendingDeleteSession.id);
              }
            }}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const deleteExerciseDialog = (
    <AlertDialog
      open={Boolean(pendingDeleteExercise)}
      onOpenChange={(open) => {
        if (!open) {
          setPendingDeleteExercise(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer l’exercice ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive. L’exercice "{pendingDeleteExercise?.nom_exercice}" sera supprimé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingDeleteExercise?.id) {
                deleteExercise.mutate(pendingDeleteExercise.id);
              }
            }}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isCreating) {
      return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
              {exerciseCreateDialog}
              {exerciseEditDialog}
              {detailsDialog}
              {deleteSessionDialog}
              {deleteExerciseDialog}
              <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold uppercase">
                    {editingSessionId ? "Modifier Séance Muscu" : "Nouvelle Séance Muscu"}
                  </h2>
                  <div className="flex gap-2">
                      <Button variant="outline" onClick={resetSessionForm}>Annuler</Button>
                      <Button onClick={handleSaveSession}>
                        <Save className="mr-2 h-4 w-4"/> Enregistrer
                      </Button>
                  </div>
              </div>

              <Card>
                  <CardHeader>
                      <CardTitle>Informations Générales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label>Titre</Label>
                              <Input value={newSession.title} onChange={e => setNewSession({...newSession, title: e.target.value})} placeholder="ex: Full Body A" />
                          </div>
                          <div className="space-y-2">
                              <Label>Cycle</Label>
                              <Select
                                value={newSession.cycle}
                                onValueChange={(value) =>
                                  setNewSession({ ...newSession, cycle: normalizeStrengthCycle(value) })
                                }
                              >
                                  <SelectTrigger><SelectValue/></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="endurance">Endurance</SelectItem>
                                      <SelectItem value="hypertrophie">Hypertrophie</SelectItem>
                                      <SelectItem value="force">Force</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea value={newSession.description} onChange={e => setNewSession({...newSession, description: e.target.value})} />
                      </div>
                  </CardContent>
              </Card>

              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <h3 className="font-bold">Exercices</h3>
                      <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setExerciseDialogOpen(true)}>
                              <Plus className="mr-2 h-4 w-4"/> Nouvel exercice
                          </Button>
                          <Button size="sm" onClick={addItem}><Plus className="mr-2 h-4 w-4"/> Ajouter</Button>
                      </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr] items-end">
                      <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                              <Filter className="h-4 w-4" /> Filtre exercices
                          </Label>
                          <Select value={exerciseFilter} onValueChange={(value: "all" | "strength" | "warmup") => setExerciseFilter(value)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">Tous</SelectItem>
                                  <SelectItem value="strength">Séries de travail</SelectItem>
                                  <SelectItem value="warmup">Échauffement</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <p className="text-sm text-muted-foreground">
                          Les exercices marqués warmup sont affichés dans les séances avec le badge « Échauffement ».
                      </p>
                  </div>
                  
                  {newSession.items.map((item, index) => (
                      <Card
                        key={`${item.exercise_id}-${index}`}
                        className={cn(
                          "relative transition-all",
                          dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && "ring-2 ring-primary bg-accent/30",
                        )}
                        onDragOver={(event) => event.preventDefault()}
                        onDragEnter={() => setDragOverIndex(index)}
                        onDragLeave={() => setDragOverIndex((prev) => (prev === index ? null : prev))}
                        onDrop={() => {
                          if (draggingIndex === null) return;
                          reorderItems(draggingIndex, index);
                          setDraggingIndex(null);
                          setDragOverIndex(null);
                        }}
                      >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 text-destructive"
                            onClick={() => removeItem(index)}
                            aria-label="Supprimer l'exercice"
                          >
                              <Trash2 className="h-4 w-4" />
                          </Button>
                          <CardContent className="pt-6 grid md:grid-cols-12 gap-4 items-end">
                               <div className="md:col-span-1 flex items-center justify-center">
                                 <button
                                   type="button"
                                   className="cursor-grab rounded-md border p-1 text-muted-foreground hover:text-foreground"
                                   draggable
                                   onDragStart={() => setDraggingIndex(index)}
                                   onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }}
                                   aria-label="Réordonner"
                                 >
                                   <GripVertical className="h-4 w-4" />
                                 </button>
                               </div>
                               <div className="md:col-span-3 space-y-2">
                                   <Label>Exercice</Label>
                                   <Select value={item.exercise_id.toString()} onValueChange={v => updateItem(index, 'exercise_id', parseInt(v))}>
                                      <SelectTrigger><SelectValue/></SelectTrigger>
                                      <SelectContent>
                                          {filteredExercises.length ? (
                                            filteredExercises.map((exercise) => (
                                              <SelectItem key={exercise.id} value={exercise.id.toString()}>
                                                {exercise.nom_exercice}
                                                {exercise.exercise_type === "warmup" ? " • Échauffement" : ""}
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem value="no-exercise" disabled>
                                              Aucun exercice disponible
                                            </SelectItem>
                                          )}
                                      </SelectContent>
                                   </Select>
                               </div>
                               <div className="md:col-span-2 space-y-2">
                                   <Label>Séries</Label>
                                   <Input
                                     type="number"
                                     value={item.sets === 0 ? "" : item.sets}
                                     onChange={(e) =>
                                       updateItem(
                                         index,
                                         "sets",
                                         e.target.value === "" ? 0 : Number(e.target.value),
                                       )
                                     }
                                   />
                               </div>
                               <div className="md:col-span-2 space-y-2">
                                   <Label>Reps</Label>
                                   <Input
                                     type="number"
                                     value={item.reps === 0 ? "" : item.reps}
                                     onChange={(e) =>
                                       updateItem(
                                         index,
                                         "reps",
                                         e.target.value === "" ? 0 : Number(e.target.value),
                                       )
                                     }
                                   />
                               </div>
                               <div className="md:col-span-2 space-y-2">
                                   <Label>% 1RM</Label>
                                   <Input
                                     type="number"
                                     value={item.percent_1rm === 0 ? "" : item.percent_1rm}
                                     onChange={(e) =>
                                       updateItem(
                                         index,
                                         "percent_1rm",
                                         e.target.value === "" ? 0 : Number(e.target.value),
                                       )
                                     }
                                   />
                               </div>
                               <div className="md:col-span-2 space-y-2">
                                   <Label>Repos (s)</Label>
                                   <Input
                                     type="number"
                                     value={item.rest_seconds === 0 ? "" : item.rest_seconds}
                                     onChange={(e) =>
                                       updateItem(
                                         index,
                                         "rest_seconds",
                                         e.target.value === "" ? 0 : Number(e.target.value),
                                       )
                                     }
                                   />
                               </div>
                          </CardContent>
                      </Card>
                  ))}
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-4">
       {exerciseCreateDialog}
       {exerciseEditDialog}
       {detailsDialog}
       {deleteSessionDialog}
       {deleteExerciseDialog}
       <div className="flex justify-between items-center">
           <h3 className="font-bold text-lg">Catalogue Séances Musculation</h3>
           <Button
             onClick={() => {
               setEditingSessionId(null);
               setNewSession({ title: "", description: "", cycle: "endurance", items: [] });
               setIsCreating(true);
             }}
           >
             <Plus className="mr-2 h-4 w-4"/> Créer
           </Button>
       </div>
       
       <div className="grid gap-4 md:grid-cols-2">
           {sessions?.map(session => (
               <Card key={session.id}>
                   <CardHeader>
                       <CardTitle>{session.title}</CardTitle>
                       <CardDescription>{session.items?.length || 0} exercices • {session.cycle}</CardDescription>
                   </CardHeader>
                   <CardContent>
                       <div className="flex items-center gap-2">
                           <Button
                             variant="outline"
                             size="icon"
                             aria-label="Voir détails"
                             onClick={() => {
                               setDetailSession(session);
                               setDetailDialogOpen(true);
                             }}
                           >
                             <Eye className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="secondary"
                             size="icon"
                             aria-label="Modifier"
                             onClick={() => startEditSession(session)}
                           >
                             <Edit2 className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="destructive"
                             size="icon"
                             aria-label="Supprimer"
                             onClick={() => setPendingDeleteSession(session)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                       </div>
                   </CardContent>
               </Card>
           ))}
       </div>

       <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Catalogue Exercices</h3>
            <Button variant="outline" onClick={() => setExerciseDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter un exercice
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {exercises?.map((exercise) => (
              <Card key={exercise.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {exercise.illustration_gif ? (
                      <img
                        src={exercise.illustration_gif}
                        alt={`Illustration ${exercise.nom_exercice}`}
                        className="h-14 w-14 rounded-md object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                    <div>
                      <p className="font-semibold">{exercise.nom_exercice}</p>
                      <p className="text-sm text-muted-foreground">
                        {exercise.exercise_type === "warmup" ? "Échauffement" : "Séries de travail"}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Modifier"
                      onClick={() => startEditExercise(exercise)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Supprimer"
                      onClick={() => setPendingDeleteExercise(exercise)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
       </div>
   </div>
  );
}

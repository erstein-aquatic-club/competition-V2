import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Assignment, SwimSessionItem, SwimSessionTemplate } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getEquipmentIconUrl } from "@/components/swim/EquipmentPill";
import { intensityTone } from "@/components/swim/IntensityDots";
import { IntensityDotsSelector } from "@/components/swim/IntensityDotsSelector";
import { SwimSessionConsultation } from "@/components/swim/SwimSessionConsultation";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  ChevronLeft,
  GripVertical,
  Layers,
  Pencil,
  Play,
  Plus,
  Route,
  Save,
  Search,
  Timer,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useAuth } from "@/lib/auth";
import { formatSwimSessionDefaultTitle } from "@/lib/date";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";
import { cn } from "@/lib/utils";

interface SwimExercise {
  repetitions: number | null;
  distance: number | null;
  rest: number | null;
  stroke: string;
  strokeType: string;
  intensity: string;
  modalities: string;
  equipment: string[];
}

interface SwimBlock {
  title: string;
  repetitions: number | null;
  description: string;
  modalities: string;
  equipment: string[];
  exercises: SwimExercise[];
}

interface SwimSessionDraft {
  id: number | null;
  name: string;
  description: string;
  estimatedDuration: number;
  blocks: SwimBlock[];
}

const legacyIntensityMap: Record<string, string> = {
  souple: "V0",
  facile: "V0",
  relache: "V0",
  "relâché": "V0",
};

const intensityScale = ["V0", "V1", "V2", "V3", "Max"] as const;

const normalizeIntensityValue = (value?: string | null) => {
  if (!value) return "V0";
  const trimmed = value.trim();
  if (!trimmed) return "V0";
  const lower = trimmed.toLowerCase();
  if (legacyIntensityMap[lower]) {
    return legacyIntensityMap[lower];
  }
  const upper = trimmed.toUpperCase();
  if (upper === "MAX") return "Max";
  if (upper.startsWith("V")) {
    const levelValue = Number.parseInt(upper.slice(1), 10);
    if (Number.isFinite(levelValue) && levelValue >= 4) {
      return "Max";
    }
    if (intensityScale.includes(upper as (typeof intensityScale)[number])) {
      return upper;
    }
  }
  return trimmed;
};

const formatIntensityLabel = (value: string) => (value === "Max" ? "MAX" : value);

const buildItemsFromBlocks = (blocks: SwimBlock[]): SwimSessionItem[] => {
  let orderIndex = 0;
  return blocks.flatMap((block, blockIndex) =>
    block.exercises.map((exercise, exerciseIndex) => {
      const rawPayload = {
        block_title: block.title,
        block_description: block.description || null,
        block_order: blockIndex,
        block_repetitions: block.repetitions ?? null,
        block_modalities: block.modalities || null,
        block_equipment: block.equipment ?? [],
        exercise_repetitions: exercise.repetitions ?? null,
        exercise_rest: exercise.rest ?? null,
        exercise_stroke: exercise.stroke || null,
        exercise_stroke_type: exercise.strokeType || null,
        exercise_intensity: exercise.intensity ? normalizeIntensityValue(exercise.intensity) : null,
        exercise_modalities: exercise.modalities || null,
        exercise_equipment: exercise.equipment ?? [],
        exercise_order: exerciseIndex,
      };
      const exerciseLabel =
        exercise.repetitions && exercise.distance
          ? `${exercise.repetitions}x${exercise.distance}m`
          : exercise.distance
            ? `${exercise.distance}m`
            : null;
      return {
        ordre: orderIndex++,
        label: exerciseLabel,
        distance: exercise.distance ?? null,
        duration: null,
        intensity: exercise.intensity ? normalizeIntensityValue(exercise.intensity) : null,
        notes: exercise.modalities || null,
        raw_payload: rawPayload,
      } as SwimSessionItem;
    }),
  );
};

const buildBlocksFromItems = (items: SwimSessionItem[] = []): SwimBlock[] => {
  const blocksMap = new Map<string, SwimBlock & { order: number; exerciseOrder: Map<number, SwimExercise> }>();
  items.forEach((item) => {
    const payload = (item.raw_payload as Record<string, any>) ?? {};
    const blockTitle = payload.block_title || payload.section || "Bloc";
    const blockOrder = Number(payload.block_order ?? 0);
    const blockKey = `${blockOrder}-${blockTitle}`;
    const blockEquipmentRaw = payload.block_equipment ?? payload.equipment ?? [];
    const blockEquipment = (Array.isArray(blockEquipmentRaw) ? blockEquipmentRaw : String(blockEquipmentRaw).split(","))
      .map((entry) => String(entry))
      .map((entry) => normalizeEquipmentValue(entry))
      .filter(Boolean);
    if (!blocksMap.has(blockKey)) {
      blocksMap.set(blockKey, {
        title: blockTitle,
        repetitions: payload.block_repetitions ?? null,
        description: payload.block_description ?? "",
        modalities: payload.block_modalities ?? payload.modalities ?? "",
        equipment: blockEquipment,
        exercises: [],
        order: Number.isFinite(blockOrder) ? blockOrder : 0,
        exerciseOrder: new Map<number, SwimExercise>(),
      });
    }
    const block = blocksMap.get(blockKey)!;
    const exerciseOrder = Number(payload.exercise_order ?? item.ordre ?? block.exercises.length);
    const normalizedIntensity = normalizeIntensityValue(payload.exercise_intensity ?? item.intensity ?? "V1");
    block.exerciseOrder.set(exerciseOrder, {
      repetitions: payload.exercise_repetitions ?? null,
      distance: item.distance ?? null,
      rest: payload.exercise_rest ?? null,
      stroke: payload.exercise_stroke ?? payload.stroke ?? "crawl",
      strokeType: payload.exercise_stroke_type ?? payload.stroke_type ?? "nc",
      intensity: normalizedIntensity,
      modalities: payload.exercise_modalities ?? item.notes ?? "",
      equipment: Array.isArray(payload.exercise_equipment)
        ? payload.exercise_equipment.map((entry: string) => normalizeEquipmentValue(entry))
        : [],
    });
  });

  return Array.from(blocksMap.values())
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      title: block.title,
      repetitions: block.repetitions,
      description: block.description,
      modalities: block.modalities,
      equipment: block.equipment,
      exercises: Array.from(block.exerciseOrder.entries())
        .sort(([a], [b]) => a - b)
        .map(([, exercise]) => exercise),
    }));
};

const trimPreview = (value: string) => {
  if (!value) {
    return "";
  }
  return value.length > 48 ? `${value.slice(0, 45).trim()}…` : value;
};

const normalizeEquipmentValue = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("plaquette")) return "plaquettes";
  if (trimmed.startsWith("palm")) return "palmes";
  if (trimmed.startsWith("tuba")) return "tuba";
  if (trimmed.startsWith("pull")) return "pull";
  if (trimmed.startsWith("elas")) return "elastique";
  return trimmed;
};

const countBlocks = (items: SwimSessionItem[] = []) => {
  const keys = new Set(
    items.map((item) => {
      const raw = item.raw_payload as Record<string, any> | null;
      return raw?.block_title || raw?.section || "Bloc";
    }),
  );
  return keys.size;
};

const getSessionMetrics = (session: SwimSessionTemplate) => {
  const totalDistance = calculateSwimTotalDistance(session.items ?? []);
  const hasDuration = session.items?.some((item) => item.duration != null) ?? false;
  const totalDuration = hasDuration
    ? session.items?.reduce((sum, item) => sum + (item.duration ?? 0), 0) ?? 0
    : null;
  const blockCount = countBlocks(session.items ?? []);
  return { totalDistance, totalDuration, blockCount };
};

const ARCHIVED_SWIM_SESSIONS_KEY = "swim_catalog_archived_ids";

export const canDeleteSwimCatalog = (sessionId: number, assignments: Assignment[] | null) => {
  if (assignments === null) return false;
  return !assignments.some(
    (assignment) => assignment.session_type === "swim" && assignment.session_id === sessionId,
  );
};

export default function SwimCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId, role } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  useBeforeUnload(isCreating);
  const [selectedSession, setSelectedSession] = useState<SwimSessionTemplate | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<SwimSessionTemplate | null>(null);
  const [pendingArchiveSession, setPendingArchiveSession] = useState<SwimSessionTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [coachView, setCoachView] = useState<"compact" | "detailed">("compact");
  const [archivedSessionIds, setArchivedSessionIds] = useState<Set<number>>(new Set());

  const createEmptySession = (): SwimSessionDraft => ({
    id: null,
    name: formatSwimSessionDefaultTitle(new Date()),
    description: "",
    estimatedDuration: 0,
    blocks: [],
  });

  const [newSession, setNewSession] = useState<SwimSessionDraft>(createEmptySession);

  const { data: sessions } = useQuery({ queryKey: ["swim_catalog"], queryFn: () => api.getSwimCatalog() });
  const { data: assignments } = useQuery({
    queryKey: ["coach-assignments"],
    queryFn: () => api.getAssignmentsForCoach(),
    enabled: role === "coach" || role === "admin",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ARCHIVED_SWIM_SESSIONS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setArchivedSessionIds(
          new Set(parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value))),
        );
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      ARCHIVED_SWIM_SESSIONS_KEY,
      JSON.stringify(Array.from(archivedSessionIds.values())),
    );
  }, [archivedSessionIds]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions ?? [];
    return (sessions ?? []).filter((session) => session.name.toLowerCase().includes(q));
  }, [sessions, searchQuery]);
  const visibleSessions = filteredSessions.filter((session) => !archivedSessionIds.has(session.id));

  const createSession = useMutation({
    mutationFn: (data: any) => api.createSwimSession(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["swim_catalog"] });
      setIsCreating(false);
      setNewSession(createEmptySession());
      toast({
        title: variables?.id ? "Séance natation mise à jour" : "Séance natation créée",
      });
    },
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: number) => api.deleteSwimSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swim_catalog"] });
      setPendingDeleteSession(null);
      toast({ title: "Séance supprimée" });
    },
    onError: () => {
      toast({
        title: "Suppression impossible",
        description: "Cette séance est utilisée dans une assignation.",
        variant: "destructive",
      });
    },
  });

  const addBlock = () => {
    setNewSession((prev) => ({
      ...prev,
      blocks: [
        ...prev.blocks,
        {
          title: "Nouveau bloc",
          repetitions: 1,
          description: "",
          modalities: "",
          equipment: [],
          exercises: [
            {
              repetitions: 4,
              distance: 50,
              rest: null,
              stroke: "crawl",
              strokeType: "nc",
              intensity: "V2",
              modalities: "",
              equipment: [],
            },
          ],
        },
      ],
    }));
  };

  const updateBlock = (index: number, field: keyof SwimBlock, value: string | number | null | string[]) => {
    const blocks = [...newSession.blocks];
    blocks[index] = { ...blocks[index], [field]: value };
    setNewSession({ ...newSession, blocks });
  };

  const removeBlock = (index: number) => {
    const blocks = newSession.blocks.filter((_, i) => i !== index);
    setNewSession({ ...newSession, blocks });
  };

  const moveBlock = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= newSession.blocks.length) return;
    const blocks = [...newSession.blocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    setNewSession({ ...newSession, blocks });
  };

  const addExercise = (blockIndex: number) => {
    const blocks = [...newSession.blocks];
    blocks[blockIndex].exercises.push({
      repetitions: 4,
      distance: 50,
      rest: null,
      stroke: "crawl",
      strokeType: "nc",
      intensity: "V2",
      modalities: "",
      equipment: [],
    });
    setNewSession({ ...newSession, blocks });
  };

  const updateExercise = (
    blockIndex: number,
    exerciseIndex: number,
    field: keyof SwimExercise,
    value: string | number | null | string[],
  ) => {
    const blocks = [...newSession.blocks];
    const exercises = [...blocks[blockIndex].exercises];
    exercises[exerciseIndex] = { ...exercises[exerciseIndex], [field]: value } as SwimExercise;
    blocks[blockIndex] = { ...blocks[blockIndex], exercises };
    setNewSession({ ...newSession, blocks });
  };

  const removeExercise = (blockIndex: number, exerciseIndex: number) => {
    const blocks = [...newSession.blocks];
    blocks[blockIndex].exercises = blocks[blockIndex].exercises.filter((_, idx) => idx !== exerciseIndex);
    setNewSession({ ...newSession, blocks });
  };

  const equipmentOptions = [
    { value: "palmes", label: "Palmes" },
    { value: "tuba", label: "Tuba" },
    { value: "plaquettes", label: "Plaquettes" },
    { value: "pull", label: "Pull" },
    { value: "elastique", label: "Élastique" },
  ];
  const strokeOptions = [
    { value: "pap", label: "Papillon" },
    { value: "dos", label: "Dos" },
    { value: "brasse", label: "Brasse" },
    { value: "crawl", label: "Crawl" },
    { value: "4n", label: "4 nages" },
    { value: "spe", label: "Spé" },
  ];
  const strokeTypeOptions = [
    { value: "nc", label: "NC" },
    { value: "educ", label: "Educ" },
    { value: "jambes", label: "Jambes" },
  ];
  const strokeLabels = strokeOptions.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});
  const strokeTypeLabels = strokeTypeOptions.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});
  const isEditing = Boolean(newSession.id);
  const totalDistance = useMemo(
    () => calculateSwimTotalDistance(buildItemsFromBlocks(newSession.blocks)),
    [newSession.blocks],
  );

  const swimTypeTone: Record<string, string> = {
    nc: "bg-sky-100 text-sky-900 ring-sky-200",
    educ: "bg-violet-100 text-violet-900 ring-violet-200",
    jambes: "bg-teal-100 text-teal-900 ring-teal-200",
  };

  const intensityTextTone: Record<string, string> = {
    V0: "text-emerald-800",
    V1: "text-lime-800",
    V2: "text-yellow-800",
    V3: "text-orange-800",
    Max: "text-red-900",
  };

  const intensityRingTone: Record<string, string> = {
    V0: "ring-emerald-200",
    V1: "ring-lime-200",
    V2: "ring-yellow-200",
    V3: "ring-orange-200",
    Max: "ring-red-300",
  };

  if (isCreating) {
    return (
      <div className="animate-in slide-in-from-bottom-4 motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewSession(createEmptySession());
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Retour"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-base font-semibold">Édition</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedSession({
                  id: newSession.id ?? Date.now(),
                  name: newSession.name,
                  description: newSession.description,
                  created_by: userId ?? null,
                  items: buildItemsFromBlocks(newSession.blocks),
                })
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Aperçu nageur"
              title="Aperçu nageur"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!newSession.name.trim()) {
                  toast({
                    title: "Titre requis",
                    description: "Ajoutez un nom de séance avant d'enregistrer.",
                    variant: "destructive",
                  });
                  return;
                }
                createSession.mutate({
                  id: newSession.id ?? undefined,
                  name: newSession.name,
                  description: newSession.description,
                  estimated_duration: newSession.estimatedDuration || null,
                  items: buildItemsFromBlocks(newSession.blocks),
                  created_by: userId,
                });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Save className="h-4 w-4" /> Sauver
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <Card className="rounded-2xl border-border">
            <div className="space-y-3 p-4">
              <div className="text-sm font-semibold">Infos séance</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground">Nom</div>
                  <div className="mt-1">
                    <Input
                      value={newSession.name}
                      onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                      placeholder="Nom de la séance"
                      className="rounded-2xl"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Durée estimée (min)</div>
                  <div className="mt-1">
                    <Input
                      type="number"
                      min={0}
                      value={newSession.estimatedDuration || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          estimatedDuration: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      placeholder="55"
                      className="rounded-2xl"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Distance totale</div>
                  <div className="mt-1 rounded-2xl border border-border bg-muted px-3 py-2 text-sm font-semibold">
                    {totalDistance}m
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Vue coach</div>
            <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCoachView("compact")}
                className={cn(
                  "rounded-full px-3 py-1",
                  coachView === "compact" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Condensé
              </button>
              <button
                type="button"
                onClick={() => setCoachView("detailed")}
                className={cn(
                  "rounded-full px-3 py-1",
                  coachView === "detailed" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Détail
              </button>
            </div>
          </div>

          {coachView === "compact" ? (
            <Card className="rounded-2xl border-border">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Plan (ultra compact)</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Manipule les blocs vite. Passe en “Détail” pour éditer.
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addBlock}
                    className="h-9 rounded-full px-3 text-xs"
                  >
                    <Plus className="h-4 w-4" /> Bloc
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {newSession.blocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="rounded-2xl border border-border bg-card px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                              🔁 {block.repetitions ?? 1}x
                            </span>
                            <div className="truncate text-xs font-semibold">
                              {block.title ? block.title : `Bloc ${blockIndex + 1}`}
                            </div>
                            <div className="text-[11px] text-muted-foreground">· {block.exercises.length} ex</div>
                          </div>

                          <div className="mt-1 flex flex-wrap gap-1">
                            {block.exercises.slice(0, 4).map((exercise, exerciseIndex) => {
                              const normalizedIntensity = normalizeIntensityValue(exercise.intensity);
                              const strokeTypeLabel =
                                strokeTypeLabels[exercise.strokeType] ?? exercise.strokeType;
                              return (
                                <span
                                  key={`${blockIndex}-${exerciseIndex}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                                  title={exercise.modalities ? trimPreview(exercise.modalities) : ""}
                                >
                                  {exercise.repetitions && exercise.distance ? `${exercise.repetitions}x` : ""}
                                  {exercise.distance ? `${exercise.distance}m` : "—"}
                                  <span
                                    className={cn(
                                      "ml-1 inline-flex items-center rounded-full px-2 py-0.5 ring-1",
                                      swimTypeTone[exercise.strokeType] ?? "bg-muted text-muted-foreground ring-border",
                                    )}
                                  >
                                    {strokeTypeLabel}
                                  </span>
                                  <span
                                    className={cn(
                                      "ml-1 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 ring-1",
                                      intensityRingTone[normalizedIntensity],
                                      intensityTextTone[normalizedIntensity],
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        intensityTone[normalizedIntensity] ?? "bg-slate-300",
                                      )}
                                    />
                                    {formatIntensityLabel(normalizedIntensity)}
                                  </span>
                                </span>
                              );
                            })}
                            {block.exercises.length > 4 ? (
                              <span className="text-[11px] text-muted-foreground">
                                +{block.exercises.length - 4}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveBlock(blockIndex, "up")}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                            aria-label="Monter"
                            title="Monter"
                            disabled={blockIndex === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(blockIndex, "down")}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                            aria-label="Descendre"
                            title="Descendre"
                            disabled={blockIndex === newSession.blocks.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(blockIndex)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                            aria-label="Supprimer bloc"
                            title="Supprimer bloc"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!newSession.blocks.length ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
                      Aucun bloc. Ajoute un bloc pour commencer.
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Édition détaillée</div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addBlock}
                  className="h-9 rounded-full px-3 text-xs"
                >
                  <Plus className="h-4 w-4" /> Ajouter bloc
                </Button>
              </div>

              <div className="space-y-4">
                {newSession.blocks.map((block, blockIndex) => (
                  <Card key={blockIndex} className="rounded-2xl border-border">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground">Titre bloc</div>
                            <Input
                              value={block.title}
                              onChange={(e) => updateBlock(blockIndex, "title", e.target.value)}
                              placeholder={`Bloc ${blockIndex + 1}`}
                              className="rounded-2xl"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveBlock(blockIndex, "up")}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                            aria-label="Monter"
                            title="Monter"
                            disabled={blockIndex === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(blockIndex, "down")}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                            aria-label="Descendre"
                            title="Descendre"
                            disabled={blockIndex === newSession.blocks.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(blockIndex)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                            aria-label="Supprimer bloc"
                            title="Supprimer bloc"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Répétitions du bloc</div>
                          <div className="mt-1">
                            <Input
                              type="number"
                              min={1}
                              value={block.repetitions ?? ""}
                              onChange={(e) =>
                                updateBlock(
                                  blockIndex,
                                  "repetitions",
                                  e.target.value === "" ? null : Number(e.target.value),
                                )
                              }
                              placeholder="1"
                              className="rounded-2xl"
                            />
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => addExercise(blockIndex)}
                            className="h-9 rounded-full px-3 text-xs"
                          >
                            <Plus className="h-4 w-4" /> Exercice
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {block.exercises.map((exercise, exerciseIndex) => {
                          const normalizedIntensity = normalizeIntensityValue(exercise.intensity);
                          const modalitesText = exercise.modalities ?? "";
                          return (
                            <div key={exerciseIndex} className="rounded-2xl border border-border bg-card p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="grid flex-1 grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-[11px] font-semibold text-muted-foreground">Répétitions</div>
                                    <div className="mt-1">
                                      <Input
                                        type="number"
                                        min={1}
                                        value={exercise.repetitions ?? ""}
                                        onChange={(e) =>
                                          updateExercise(
                                            blockIndex,
                                            exerciseIndex,
                                            "repetitions",
                                            e.target.value === "" ? null : Number(e.target.value),
                                          )
                                        }
                                        className="rounded-2xl"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-semibold text-muted-foreground">Distance (m)</div>
                                    <div className="mt-1">
                                      <Input
                                        type="number"
                                        min={0}
                                        value={exercise.distance ?? ""}
                                        onChange={(e) =>
                                          updateExercise(
                                            blockIndex,
                                            exerciseIndex,
                                            "distance",
                                            e.target.value === "" ? null : Number(e.target.value),
                                          )
                                        }
                                        className="rounded-2xl"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-semibold text-muted-foreground">Nage</div>
                                    <div className="mt-1">
                                      <Select
                                        value={exercise.stroke}
                                        onValueChange={(value) =>
                                          updateExercise(blockIndex, exerciseIndex, "stroke", value)
                                        }
                                      >
                                        <SelectTrigger className="rounded-2xl">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {strokeOptions.map((stroke) => (
                                            <SelectItem key={stroke.value} value={stroke.value}>
                                              {stroke.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-semibold text-muted-foreground">Type</div>
                                    <div className="mt-1">
                                      <Select
                                        value={exercise.strokeType}
                                        onValueChange={(value) =>
                                          updateExercise(blockIndex, exerciseIndex, "strokeType", value)
                                        }
                                      >
                                        <SelectTrigger className="rounded-2xl">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {strokeTypeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="col-span-2">
                                    <div className="flex items-center justify-between">
                                      <div className="text-[11px] font-semibold text-muted-foreground">
                                        Intensité (clic sur points)
                                      </div>
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-2 rounded-full bg-card px-2.5 py-1 text-xs font-semibold ring-1",
                                          intensityRingTone[normalizedIntensity],
                                          intensityTextTone[normalizedIntensity],
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "h-2 w-2 rounded-full",
                                            intensityTone[normalizedIntensity] ?? "bg-slate-300",
                                          )}
                                        />
                                        {formatIntensityLabel(normalizedIntensity)}
                                      </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <IntensityDotsSelector
                                        value={exercise.intensity}
                                        onChange={(value) =>
                                          updateExercise(blockIndex, exerciseIndex, "intensity", value)
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="col-span-2">
                                    <div className="text-[11px] font-semibold text-muted-foreground">Équipements</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {equipmentOptions.map((equipment) => {
                                        const active = exercise.equipment.includes(equipment.value);
                                        const iconUrl = getEquipmentIconUrl(equipment.value);
                                        return (
                                          <button
                                            key={equipment.value}
                                            type="button"
                                            onClick={() => {
                                              const next = active
                                                ? exercise.equipment.filter((item) => item !== equipment.value)
                                                : [...exercise.equipment, equipment.value];
                                              updateExercise(blockIndex, exerciseIndex, "equipment", next);
                                            }}
                                            className={cn(
                                              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
                                              active
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-card text-muted-foreground hover:bg-muted",
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "inline-flex h-7 w-7 items-center justify-center rounded-full",
                                                active ? "bg-white/10" : "bg-muted",
                                              )}
                                            >
                                              {iconUrl ? (
                                                <img src={iconUrl} alt="" className="h-4 w-4" aria-hidden="true" />
                                              ) : null}
                                            </span>
                                            {equipment.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="col-span-2">
                                    <div className="text-[11px] font-semibold text-muted-foreground">Modalités</div>
                                    <div className="mt-1">
                                      <Textarea
                                        value={modalitesText}
                                        onChange={(e) =>
                                          updateExercise(blockIndex, exerciseIndex, "modalities", e.target.value)
                                        }
                                        placeholder="Une modalité par ligne"
                                        rows={3}
                                        className="rounded-2xl"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeExercise(blockIndex, exerciseIndex)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                                  aria-label="Supprimer exercice"
                                  title="Supprimer exercice"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => addExercise(blockIndex)}
                          className="h-9 rounded-full px-3 text-xs"
                        >
                          <Plus className="h-4 w-4" /> Ajouter exercice
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeBlock(blockIndex)}
                          className="h-9 rounded-full px-3 text-xs"
                        >
                          <Trash2 className="h-4 w-4" /> Supprimer bloc
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <div className="h-8" />
        </div>

        <Dialog
          open={Boolean(selectedSession)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSession(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <SwimSessionConsultation
              title={selectedSession?.name ?? ""}
              description={selectedSession?.description ?? undefined}
              items={selectedSession?.items}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-base font-semibold">Coach</div>
          <div className="text-xs text-muted-foreground">Création</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewSession(createEmptySession());
            setCoachView("compact");
            setIsCreating(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nouvelle
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Rechercher une séance"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-3">
          {visibleSessions.map((session) => {
            const { totalDistance, totalDuration, blockCount } = getSessionMetrics(session);
            const canDelete = canDeleteSwimCatalog(session.id, assignments ?? null);
            const deleteDisabled = !canDelete || deleteSession.isPending;
            return (
              <Card key={session.id} className="rounded-2xl border-border">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold tracking-tight">{session.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Route className="h-3.5 w-3.5" />
                          {totalDistance}m
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" />
                          ~{totalDuration ?? "—"} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          {blockCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                        aria-label="Aperçu nageur"
                        title="Aperçu nageur"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSession({
                            id: session.id ?? null,
                            name: session.name ?? formatSwimSessionDefaultTitle(new Date()),
                            description: session.description ?? "",
                            estimatedDuration: Number((session as { estimated_duration?: number }).estimated_duration ?? 0),
                            blocks: buildBlocksFromItems(session.items ?? []),
                          });
                          setCoachView("compact");
                          setIsCreating(true);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                        aria-label="Modifier"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingArchiveSession(session)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                        aria-label="Archiver"
                        title="Archiver"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (deleteDisabled) return;
                          setPendingDeleteSession(session);
                        }}
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted",
                          deleteDisabled && "cursor-not-allowed text-muted-foreground",
                        )}
                        aria-label="Supprimer"
                        title={
                          assignments === null
                            ? "Suppression désactivée"
                            : canDelete
                              ? "Supprimer"
                              : "Séance déjà assignée"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="h-8" />
      </div>

      <Dialog
        open={Boolean(selectedSession)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSession(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <SwimSessionConsultation
            title={selectedSession?.name ?? ""}
            description={selectedSession?.description ?? undefined}
            items={selectedSession?.items}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingArchiveSession)}
        onOpenChange={(open) => {
          if (!open) setPendingArchiveSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              La séance sera masquée du catalogue (sans suppression).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingArchiveSession) return;
                setArchivedSessionIds((prev) => new Set([...Array.from(prev), pendingArchiveSession.id]));
                setPendingArchiveSession(null);
                toast({ title: "Séance archivée" });
              }}
            >
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteSession)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La séance sera supprimée du catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDeleteSession) return;
                deleteSession.mutate(pendingDeleteSession.id);
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

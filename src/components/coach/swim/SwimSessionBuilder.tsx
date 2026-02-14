import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SwimSessionConsultation } from "@/components/swim/SwimSessionConsultation";
import { SwimExerciseForm } from "./SwimExerciseForm";
import { SessionMetadataForm } from "../shared/SessionMetadataForm";
import { FormActions } from "../shared/FormActions";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { intensityTone } from "@/components/swim/IntensityDots";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";
import type { SwimSessionItem } from "@/lib/api";

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

interface SwimSessionBuilderProps {
  session: SwimSessionDraft;
  onSessionChange: (session: SwimSessionDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  userId: number | null;
  isSaving?: boolean;
}

const strokeTypeLabels: Record<string, string> = {
  nc: "NC",
  educ: "Educ",
  jambes: "Jambes",
};

const swimTypeTone: Record<string, string> = {
  nc: "bg-sky-100 text-sky-900 ring-sky-200",
  educ: "bg-violet-100 text-violet-900 ring-violet-200",
  jambes: "bg-teal-100 text-teal-900 ring-teal-200",
};

const intensityTextTone: Record<string, string> = {
  V0: "text-intensity-1",
  V1: "text-intensity-2",
  V2: "text-intensity-3",
  V3: "text-intensity-4",
  Max: "text-intensity-5",
};

const intensityRingTone: Record<string, string> = {
  V0: "ring-intensity-1/30",
  V1: "ring-intensity-2/30",
  V2: "ring-intensity-3/30",
  V3: "ring-intensity-4/30",
  Max: "ring-intensity-5/30",
};

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

const trimPreview = (value: string) => {
  if (!value) {
    return "";
  }
  return value.length > 48 ? `${value.slice(0, 45).trim()}…` : value;
};

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

export function SwimSessionBuilder({
  session,
  onSessionChange,
  onSave,
  onCancel,
  userId,
  isSaving,
}: SwimSessionBuilderProps) {
  const [coachView, setCoachView] = React.useState<"compact" | "detailed">("compact");
  const [selectedSession, setSelectedSession] = React.useState<{
    id: number;
    name: string;
    description: string;
    created_by: number | null;
    items: SwimSessionItem[];
  } | null>(null);

  const totalDistance = useMemo(
    () => calculateSwimTotalDistance(buildItemsFromBlocks(session.blocks)),
    [session.blocks],
  );

  const addBlock = () => {
    onSessionChange({
      ...session,
      blocks: [
        ...session.blocks,
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
    });
  };

  const updateBlock = (index: number, field: keyof SwimBlock, value: string | number | null | string[]) => {
    const blocks = [...session.blocks];
    blocks[index] = { ...blocks[index], [field]: value };
    onSessionChange({ ...session, blocks });
  };

  const removeBlock = (index: number) => {
    const blocks = session.blocks.filter((_, i) => i !== index);
    onSessionChange({ ...session, blocks });
  };

  const moveBlock = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= session.blocks.length) return;
    const blocks = [...session.blocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    onSessionChange({ ...session, blocks });
  };

  const addExercise = (blockIndex: number) => {
    const blocks = [...session.blocks];
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
    onSessionChange({ ...session, blocks });
  };

  const updateExercise = (
    blockIndex: number,
    exerciseIndex: number,
    field: keyof SwimExercise,
    value: string | number | null | string[],
  ) => {
    const blocks = [...session.blocks];
    const exercises = [...blocks[blockIndex].exercises];
    exercises[exerciseIndex] = { ...exercises[exerciseIndex], [field]: value } as SwimExercise;
    blocks[blockIndex] = { ...blocks[blockIndex], exercises };
    onSessionChange({ ...session, blocks });
  };

  const removeExercise = (blockIndex: number, exerciseIndex: number) => {
    const blocks = [...session.blocks];
    blocks[blockIndex].exercises = blocks[blockIndex].exercises.filter((_, idx) => idx !== exerciseIndex);
    onSessionChange({ ...session, blocks });
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 motion-reduce:animate-none">
      <FormActions
        isEditing={Boolean(session.id)}
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
        onPreview={() =>
          setSelectedSession({
            id: session.id ?? Date.now(),
            name: session.name,
            description: session.description,
            created_by: userId ?? null,
            items: buildItemsFromBlocks(session.blocks),
          })
        }
      />

      <div className="space-y-4 p-4">
        <SessionMetadataForm
          name={session.name}
          onNameChange={(value) => onSessionChange({ ...session, name: value })}
          estimatedDuration={session.estimatedDuration}
          onEstimatedDurationChange={(value) => onSessionChange({ ...session, estimatedDuration: value })}
          totalDistance={totalDistance}
          showDuration={true}
          showTotalDistance={true}
        />

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
                    Manipule les blocs vite. Passe en "Détail" pour éditer.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addBlock}
                  className="h-10 rounded-full px-3 text-xs"
                >
                  <Plus className="h-4 w-4" /> Bloc
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {session.blocks.map((block, blockIndex) => (
                  <div key={blockIndex} className="rounded-2xl border border-border bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                            <Repeat className="inline h-3 w-3" /> {block.repetitions ?? 1}x
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
                                      intensityTone[normalizedIntensity] ?? "bg-muted",
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
                          disabled={blockIndex === session.blocks.length - 1}
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

                {!session.blocks.length ? (
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
                variant="outline"
                size="sm"
                onClick={addBlock}
                className="h-10 rounded-full px-3 text-xs"
              >
                <Plus className="h-4 w-4" /> Ajouter bloc
              </Button>
            </div>

            <div className="space-y-4">
              {session.blocks.map((block, blockIndex) => (
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
                          disabled={blockIndex === session.blocks.length - 1}
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
                          variant="outline"
                          size="sm"
                          onClick={() => addExercise(blockIndex)}
                          className="h-10 rounded-full px-3 text-xs"
                        >
                          <Plus className="h-4 w-4" /> Exercice
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {block.exercises.map((exercise, exerciseIndex) => (
                        <SwimExerciseForm
                          key={exerciseIndex}
                          exercise={exercise}
                          onChange={(field, value) => updateExercise(blockIndex, exerciseIndex, field, value)}
                          onDelete={() => removeExercise(blockIndex, exerciseIndex)}
                          showDelete={true}
                        />
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addExercise(blockIndex)}
                        className="h-10 rounded-full px-3 text-xs"
                      >
                        <Plus className="h-4 w-4" /> Ajouter exercice
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeBlock(blockIndex)}
                        className="h-10 rounded-full px-3 text-xs"
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

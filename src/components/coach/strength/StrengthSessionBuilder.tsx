import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Filter, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormActions } from "../shared/FormActions";
import { StrengthExerciseForm } from "./StrengthExerciseForm";
import type { Exercise, StrengthCycleType, StrengthSessionItem, StrengthSessionTemplate } from "@/lib/api";

interface StrengthSessionBuilderProps {
  session: {
    title: string;
    description: string;
    cycle: StrengthCycleType;
    items: StrengthSessionItem[];
  };
  exercises: Exercise[];
  editingSessionId: number | null;
  onSessionChange: (session: {
    title: string;
    description: string;
    cycle: StrengthCycleType;
    items: StrengthSessionItem[];
  }) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddItem: () => void;
  onUpdateItem: (index: number, field: string, value: string | number | null) => void;
  onRemoveItem: (index: number) => void;
  onReorderItems: (fromIndex: number, toIndex: number) => void;
  onExerciseDialogOpen: () => void;
  isSaving?: boolean;
}

const normalizeStrengthCycle = (value?: string | null): StrengthCycleType => {
  if (value === "endurance" || value === "hypertrophie" || value === "force") {
    return value;
  }
  return "endurance";
};

export function StrengthSessionBuilder({
  session,
  exercises,
  editingSessionId,
  onSessionChange,
  onSave,
  onCancel,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onExerciseDialogOpen,
  isSaving,
}: StrengthSessionBuilderProps) {
  const [exerciseFilter, setExerciseFilter] = useState<"all" | "strength" | "warmup">("all");
  const [detailSession, setDetailSession] = useState<StrengthSessionTemplate | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));

  const handlePreview = () => {
    setDetailSession({
      id: editingSessionId ?? 0,
      title: session.title,
      description: session.description,
      cycle: session.cycle,
      items: session.items,
    } as StrengthSessionTemplate);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <FormActions
        isEditing={Boolean(editingSessionId)}
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
        onPreview={handlePreview}
      />

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Informations Générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input
                  value={session.title}
                  onChange={(e) => onSessionChange({ ...session, title: e.target.value })}
                  placeholder="ex: Full Body A"
                />
              </div>
              <div className="space-y-2">
                <Label>Cycle</Label>
                <Select
                  value={session.cycle}
                  onValueChange={(value) =>
                    onSessionChange({ ...session, cycle: normalizeStrengthCycle(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <Textarea
                value={session.description}
                onChange={(e) => onSessionChange({ ...session, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Exercices</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onExerciseDialogOpen} className="h-10">
                <Plus className="mr-2 h-4 w-4" /> Nouvel exercice
              </Button>
              <Button size="sm" variant="default" onClick={onAddItem} className="h-10">
                <Plus className="mr-2 h-4 w-4" /> Ajouter
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr] items-end">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtre exercices
              </Label>
              <Select
                value={exerciseFilter}
                onValueChange={(value: "all" | "strength" | "warmup") => setExerciseFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          {session.items.map((item, index) => (
            <div
              key={`${item.exercise_id}-${index}`}
              className={cn(
                "relative transition-all",
                dragOverIndex === index &&
                  draggingIndex !== null &&
                  draggingIndex !== index &&
                  "ring-2 ring-primary bg-accent/30"
              )}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={() => setDragOverIndex(index)}
              onDragLeave={() => setDragOverIndex((prev) => (prev === index ? null : prev))}
              onDrop={() => {
                if (draggingIndex === null) return;
                onReorderItems(draggingIndex, index);
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-6 cursor-grab rounded-md border p-1 text-muted-foreground hover:text-foreground"
                  draggable
                  onDragStart={() => setDraggingIndex(index)}
                  onDragEnd={() => {
                    setDraggingIndex(null);
                    setDragOverIndex(null);
                  }}
                  aria-label="Réordonner"
                >
                  <GripVertical className="h-4 w-4" />
                </button>

                <div className="flex-1">
                  <StrengthExerciseForm
                    exercise={item}
                    exercises={exercises}
                    exerciseFilter={exerciseFilter}
                    onChange={(field, value) => onUpdateItem(index, field, value)}
                    onDelete={() => onRemoveItem(index)}
                    showDelete={true}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                        <div
                          key={`${item.exercise_id}-${index}`}
                          className="rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {index + 1}. {exercise?.nom_exercice ?? "Exercice"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {exercise?.exercise_type === "warmup" ? "Échauffement" : "Travail"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.sets} séries • {item.reps} reps • {item.percent_1rm}% 1RM •{" "}
                            {item.rest_seconds}s
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
    </div>
  );
}

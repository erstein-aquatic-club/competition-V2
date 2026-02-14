import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { Exercise, StrengthSessionItem } from "@/lib/api";

interface StrengthExerciseFormProps {
  exercise: StrengthSessionItem;
  exercises: Exercise[];
  exerciseFilter: "all" | "strength" | "warmup";
  onChange: (field: string, value: string | number | null) => void;
  onDelete: () => void;
  showDelete?: boolean;
}

export function StrengthExerciseForm({
  exercise,
  exercises,
  exerciseFilter,
  onChange,
  onDelete,
  showDelete = true,
}: StrengthExerciseFormProps) {
  const selectedExerciseIds = new Set<number>();

  const filteredExercises = exercises.filter((ex) => {
    if (exerciseFilter === "all") return true;
    if (selectedExerciseIds.has(ex.id)) return true;
    return ex.exercise_type === exerciseFilter;
  });

  return (
    <Card className="relative">
      {showDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
          aria-label="Supprimer l'exercice"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <div className="pt-6 px-4 pb-4 grid md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3 space-y-2">
          <Label>Exercice</Label>
          <Select
            value={exercise.exercise_id.toString()}
            onValueChange={(v) => onChange("exercise_id", parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filteredExercises.length ? (
                filteredExercises.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id.toString()}>
                    {ex.nom_exercice}
                    {ex.exercise_type === "warmup" ? " • Échauffement" : ""}
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
            value={exercise.sets === 0 ? "" : exercise.sets}
            onChange={(e) => onChange("sets", e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label>Reps</Label>
          <Input
            type="number"
            value={exercise.reps === 0 ? "" : exercise.reps}
            onChange={(e) => onChange("reps", e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label>% 1RM</Label>
          <Input
            type="number"
            value={exercise.percent_1rm === 0 ? "" : exercise.percent_1rm}
            onChange={(e) => onChange("percent_1rm", e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label>Repos (s)</Label>
          <Input
            type="number"
            value={exercise.rest_seconds === 0 ? "" : exercise.rest_seconds}
            onChange={(e) => onChange("rest_seconds", e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>
      </div>
    </Card>
  );
}

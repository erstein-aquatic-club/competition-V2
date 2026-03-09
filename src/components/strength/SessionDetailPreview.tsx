import { useMemo, useState } from "react";
import { StrengthSessionTemplate, StrengthSessionItem, Exercise, Assignment, StrengthCycleType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { ChevronLeft, ChevronRight, Dumbbell, Calendar, Play } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";
import { BottomActionBar, SaveState } from "@/components/shared/BottomActionBar";
import { ExercisePicker } from "@/components/strength/ExercisePicker";
import { cn } from "@/lib/utils";
import type { OneRmEntry } from "@/lib/types";

const cycleDescriptions: Record<string, { color: string; bgColor: string; borderColor: string; description: string }> = {
  endurance: {
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Charges légères, séries longues, récupération courte. Travail d'endurance musculaire.",
  },
  hypertrophie: {
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800",
    description: "Charges modérées, séries moyennes. Travail de volume et de développement musculaire.",
  },
  force: {
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    borderColor: "border-red-200 dark:border-red-800",
    description: "Charges lourdes, peu de répétitions, récupération longue entre les séries.",
  },
};

const formatStrengthValue = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return String(numeric);
};

const formatStrengthSeconds = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return `${numeric}s`;
};

interface SessionDetailPreviewProps {
  session: StrengthSessionTemplate;
  assignment: Assignment | null;
  cycleType: StrengthCycleType;
  cycleOptions: Array<{ value: StrengthCycleType; label: string }>;
  exercises: Exercise[];
  oneRMs: OneRmEntry[];
  saveState: SaveState;
  onBack: () => void;
  onLaunch: () => void;
  substitutions?: Map<number, { originalIndex: number; exercise: Exercise }>;
  onSubstitute?: (itemIndex: number, exercise: Exercise) => void;
  originalItemCount?: number;
  onAddExercise?: (exercise: Exercise) => void;
}

export function SessionDetailPreview({
  session,
  assignment,
  cycleType,
  cycleOptions,
  exercises,
  oneRMs,
  saveState,
  onBack,
  onLaunch,
  substitutions,
  onSubstitute,
  originalItemCount,
  onAddExercise,
}: SessionDetailPreviewProps) {
  const exerciseLookup = useMemo(() => {
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const items = session.items ?? [];

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [disclaimerShown, setDisclaimerShown] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const withDisclaimer = (action: () => void) => {
    if (disclaimerShown) { action(); return; }
    setPendingAction(() => action);
    setDisclaimerOpen(true);
  };

  return (
    <motion.div
      className="space-y-5 pb-48"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      {/* Header compact avec retour */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted active:scale-95"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {cycleOptions.find((option) => option.value === cycleType)?.label}
          </p>
          <h1 className="text-xl font-bold tracking-tight truncate">{session.title}</h1>
        </div>
      </div>

      {/* Cycle context banner */}
      {(() => {
        const desc = cycleDescriptions[cycleType] ?? cycleDescriptions.endurance;
        const cycleLabel = cycleOptions.find((o) => o.value === cycleType)?.label ?? cycleType;
        const assignedCycle = assignment?.cycle;
        const hasCoachRecommendation = assignedCycle && assignedCycle !== cycleType;
        return (
          <div className={cn("rounded-2xl border p-4 space-y-2", desc.bgColor, desc.borderColor)}>
            <div className={cn("text-sm font-bold", desc.color)}>
              Cycle {cycleLabel} sélectionné
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {desc.description}
            </p>
            {hasCoachRecommendation && (
              <p className="text-xs font-semibold text-muted-foreground">
                Recommandé par le coach :{" "}
                <span className={desc.color}>
                  {cycleOptions.find((o) => o.value === assignedCycle)?.label ?? assignedCycle}
                </span>
              </p>
            )}
          </div>
        );
      })()}

      {/* Hero card avec infos clés */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12" />
        <div className="relative space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {assignment && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Assignée
              </span>
            )}
            {!assignment && (
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                Catalogue
              </span>
            )}
            {assignment?.assigned_date && (
              <span className="text-xs text-muted-foreground">
                Prévue le {format(new Date(assignment.assigned_date), "dd MMM", { locale: fr })}
              </span>
            )}
          </div>

          {/* Description */}
          {session.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {session.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80">
                <Dumbbell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{items.length}</p>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Exercices</p>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">
                  {cycleOptions.find((option) => option.value === cycleType)?.label}
                </p>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cycle</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {items.length} exercice{items.length > 1 ? "s" : ""}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Liste compacte d'exercices - mobile first */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const exercise = exerciseLookup.get(item.exercise_id);
          const percentValue = Number(item.percent_1rm);
          const hasPercent = Number.isFinite(percentValue) && percentValue > 0;
          const rm = hasPercent
            ? oneRMs?.find((entry: OneRmEntry) => entry.exercise_id === item.exercise_id)?.weight ?? 0
            : 0;
          const targetWeight = hasPercent ? Math.round(rm * (percentValue / 100)) : 0;
          const chargeLabel = hasPercent
            ? targetWeight > 0
              ? `${targetWeight} kg (${percentValue}% 1RM)`
              : `${percentValue}% 1RM`
            : null;
          const notes = item.notes?.trim();
          const setsVal = formatStrengthValue(item.sets);
          const repsVal = formatStrengthValue(item.reps);
          const restVal = formatStrengthSeconds(item.rest_seconds);

          return (
            <Sheet key={`${item.exercise_id}-${index}`}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-all active:scale-[0.98] hover:border-primary/50 hover:shadow-sm"
                >
                  {/* Numéro */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </div>

                  {/* Titre exercice */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate">
                        {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                      </p>
                      {substitutions?.has(index) && (
                        <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold">Modifié</span>
                      )}
                      {originalItemCount !== undefined && index >= originalItemCount && (
                        <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">Ajouté</span>
                      )}
                    </div>
                  </div>

                  {/* Replace button */}
                  {onSubstitute && (
                    <button
                      type="button"
                      className="shrink-0 text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-md hover:bg-primary/10 active:scale-95 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        withDisclaimer(() => {
                          setPickerTargetIndex(index);
                          setPickerOpen(true);
                        });
                      }}
                    >
                      Remplacer
                    </button>
                  )}

                  {/* Stats compactes: séries×reps | repos */}
                  <div className="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground">
                    <span className="font-mono">
                      {setsVal}×{repsVal}
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-mono">{restVal}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </button>
              </SheetTrigger>

              {/* Fiche détaillée exercice */}
              <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl pb-8">
                <SheetHeader className="text-left pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-xl leading-tight">
                        {exercise?.nom_exercice ?? item.exercise_name ?? "Exercice"}
                      </SheetTitle>
                      {exercise?.exercise_type && (
                        <p className="text-sm text-muted-foreground mt-0.5">{exercise.exercise_type}</p>
                      )}
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-4">
                  {/* GIF illustration - compact et chargement optimisé */}
                  {exercise?.illustration_gif && (
                    <div className="rounded-xl overflow-hidden bg-muted/20 border aspect-video flex items-center justify-center">
                      <img
                        src={exercise.illustration_gif}
                        alt={exercise.nom_exercice ?? "Exercice"}
                        className="w-full h-full max-h-36 object-contain"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  )}

                  {/* Description */}
                  {exercise?.description && (
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {exercise.description}
                    </div>
                  )}

                  {/* Stats grid 2×2 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/40 p-3 text-center">
                      <p className="text-2xl font-bold leading-none">{setsVal}</p>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">
                        Séries
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 text-center">
                      <p className="text-2xl font-bold leading-none">{repsVal}</p>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Reps</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 text-center">
                      <p className="text-lg font-bold leading-none">{chargeLabel ?? "—"}</p>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">
                        Charge
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 text-center">
                      <p className="text-lg font-bold leading-none">{restVal}</p>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Repos</p>
                    </div>
                  </div>

                  {/* Notes coach */}
                  {notes && (
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                      <div className="text-[10px] uppercase text-primary font-semibold mb-1">
                        Notes coach
                      </div>
                      <div className="text-sm text-foreground">{notes}</div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          );
        })}
        {items.length === 0 && (
          <div className="p-6 border-2 border-dashed rounded-xl text-center text-muted-foreground">
            Aucun exercice disponible pour cette séance.
          </div>
        )}
      </div>

      {onAddExercise && (
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors active:scale-[0.98]"
          onClick={() => withDisclaimer(() => setAddPickerOpen(true))}
        >
          + Ajouter un exercice
        </button>
      )}

      {onSubstitute && (
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          exercises={exercises}
          onSelect={(exercise) => {
            if (pickerTargetIndex !== null) onSubstitute(pickerTargetIndex, exercise);
            setPickerTargetIndex(null);
          }}
          title="Remplacer l'exercice"
        />
      )}

      {onAddExercise && (
        <ExercisePicker
          open={addPickerOpen}
          onOpenChange={setAddPickerOpen}
          exercises={exercises}
          onSelect={(exercise) => onAddExercise(exercise)}
          title="Ajouter un exercice"
        />
      )}

      <AlertDialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Attention</AlertDialogTitle>
            <AlertDialogDescription>
              Toute modification se fait sous ta responsabilité. Le coach aura accès à la séance réelle effectuée. Des changements incohérents avec le travail demandé peuvent entraîner des risques de blessure ou une perte de performance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setDisclaimerShown(true);
              setDisclaimerOpen(false);
              pendingAction?.();
              setPendingAction(null);
            }}>
              J'ai compris
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom action bar fixe — couvre le dock mobile */}
      <BottomActionBar saveState={saveState} className="bottom-0">
        <Button
          variant="default"
          className="flex-1 h-14 rounded-xl font-bold text-base shadow-lg"
          onClick={onLaunch}
        >
          <Play className="h-5 w-5 mr-2" />
          Lancer la séance
        </Button>
      </BottomActionBar>
    </motion.div>
  );
}

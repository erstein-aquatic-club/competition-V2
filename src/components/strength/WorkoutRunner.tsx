import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Loader2,
  Pause,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { BottomActionBar } from "@/components/shared/BottomActionBar";
import { ScrollContainer } from "@/components/shared/ScrollContainer";
import { ScaleSelector5 } from "@/components/shared/ScaleSelector5";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Exercise, StrengthSessionTemplate } from "@/lib/api";
import type { SetLogEntry, OneRmEntry, WorkoutFinishData, SetInputValues } from "@/lib/types";

export const resolveSetNumber = (log: SetLogEntry | null | undefined, fallbackIndex: number) => {
  const raw = Number(log?.set_index ?? log?.set_number ?? log?.setIndex ?? fallbackIndex);
  if (!Number.isFinite(raw) || raw <= 0) {
    return fallbackIndex;
  }
  return raw;
};

export const resolveNextStep = (
  items: StrengthSessionTemplate["items"] = [],
  logs: SetLogEntry[] | null | undefined,
  progressPct?: number | null,
) => {
  if (!items.length) return 0;
  const usableLogs = Array.isArray(logs) ? logs : [];
  if (usableLogs.length > 0) {
    const logsByExercise = new Map<number, SetLogEntry[]>();
    usableLogs.forEach((log: SetLogEntry, index: number) => {
      if (!log?.exercise_id) return;
      const existing = logsByExercise.get(log.exercise_id) ?? [];
      existing.push({ ...log, set_index: resolveSetNumber(log, index + 1) });
      logsByExercise.set(log.exercise_id, existing);
    });
    let nextStep = items.length + 1;
    for (let i = 0; i < items.length; i += 1) {
      const block = items[i];
      const existing = logsByExercise.get(block.exercise_id) ?? [];
      if (existing.length < (block.sets ?? 0)) {
        nextStep = i + 1;
        break;
      }
    }
    return nextStep;
  }
  const safeProgress = Number(progressPct ?? 0);
  if (!Number.isFinite(safeProgress) || safeProgress <= 0) {
    return 0;
  }
  const completedBlocks = Math.min(
    items.length,
    Math.max(0, Math.round((safeProgress / 100) * items.length)),
  );
  return Math.min(items.length, completedBlocks + 1);
};

const formatStrengthValue = (value?: number | null, suffix?: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "—";
  }
  return suffix ? `${numeric}${suffix}` : String(numeric);
};

export function WorkoutRunner({
  session,
  exercises,
  oneRMs,
  onFinish,
  onStart,
  onLogSets,
  onProgress,
  initialLogs,
  isFinishing,
  initialStep,
  onStepChange,
  initialInputOpen,
  initialSeriesOpen,
  onExitFocus,
}: {
  session: StrengthSessionTemplate;
  exercises: Exercise[];
  oneRMs: OneRmEntry[];
  onFinish: (data: WorkoutFinishData) => void;
  onStart?: () => Promise<void> | void;
  onLogSets?: (logs: SetLogEntry[]) => Promise<void> | void;
  onProgress?: (progressPct: number) => Promise<void> | void;
  initialLogs?: SetLogEntry[] | null;
  isFinishing?: boolean;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  initialInputOpen?: boolean;
  initialSeriesOpen?: boolean;
  onExitFocus?: () => void;
}) {
  const { toast } = useToast();
  const isLoggingRef = useRef(false);
  const [currentStep, setCurrentStep] = useState(initialStep ?? 0);
  const [logs, setLogs] = useState<SetLogEntry[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const elapsedStartRef = useRef(Date.now());
  const elapsedPausedRef = useRef(0);

  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [isRestPaused, setIsRestPaused] = useState(false);
  const restEndRef = useRef(0);
  const restPausedRemainingRef = useRef(0);
  const [autoRest, setAutoRest] = useState(true);
  const [difficulty, setDifficulty] = useState(3);
  const [fatigue, setFatigue] = useState(3);
  const [comments, setComments] = useState("");
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [currentSetIndex, setCurrentSetIndex] = useState(1);
  const [seriesSheetOpen, setSeriesSheetOpen] = useState(initialSeriesOpen ?? false);
  const [inputSheetOpen, setInputSheetOpen] = useState(initialInputOpen ?? false);
  const [activeInput, setActiveInput] = useState<"weight" | "reps">("weight");
  const [draftValue, setDraftValue] = useState("");
  const [isGifOpen, setIsGifOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      setElapsedTime(Math.floor((Date.now() - elapsedStartRef.current) / 1000) + elapsedPausedRef.current);
    };
    tick();
    const interval = setInterval(tick, 1000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [isActive]);

  useEffect(() => {
    if (!isGifOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGifOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGifOpen]);

  useEffect(() => {
    if (!isResting || isRestPaused) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000));
      setRestTimer(remaining);
      if (remaining <= 0) {
        setIsResting(false);
        setIsRestPaused(false);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [isResting, isRestPaused]);

  const workoutPlan = session.items || [];
  const currentExerciseIndex = currentStep - 1;
  const currentBlock =
    currentStep > 0 && currentStep <= workoutPlan.length ? workoutPlan[currentExerciseIndex] : null;
  const currentExerciseDef = currentBlock
    ? exercises.find((e) => e.id === currentBlock.exercise_id)
    : null;
  const nextBlock = currentStep < workoutPlan.length ? workoutPlan[currentStep] : null;
  const nextExerciseDef = nextBlock
    ? exercises.find((e) => e.id === nextBlock.exercise_id)
    : null;
  const muscleTags = (() => {
    const raw =
      (currentExerciseDef as Record<string, unknown> | undefined)?.muscle_groups ??
      (currentExerciseDef as Record<string, unknown> | undefined)?.muscles ??
      (currentExerciseDef as Record<string, unknown> | undefined)?.muscleGroups ??
      [];
    return Array.isArray(raw) ? raw : [];
  })();
  const restDuration = currentBlock?.rest_seconds ?? 0;
  const progressPct = workoutPlan.length
    ? Math.min(100, Math.max(0, Math.round(((currentStep - 1) / workoutPlan.length) * 100)))
    : 0;

  const percentValue = Number(currentBlock?.percent_1rm);
  const hasPercent = Number.isFinite(percentValue) && percentValue > 0;
  const rm = hasPercent
    ? oneRMs.find((r) => r.exercise_id === currentBlock?.exercise_id)?.weight || 0
    : 0;
  const targetWeight = hasPercent ? Math.round(rm * (percentValue / 100)) : 0;

  const [currentSetInputs, setCurrentSetInputs] = useState<Record<number, SetInputValues>>({});
  const logLookup = useMemo(() => {
    const map = new Map<string, SetLogEntry>();
    logs.forEach((log: SetLogEntry, index: number) => {
      const setNumber = resolveSetNumber(log, index + 1);
      if (!log.exercise_id) return;
      map.set(`${log.exercise_id}-${setNumber}`, log);
    });
    return map;
  }, [logs]);

  const currentSetKey = currentBlock ? `${currentBlock.exercise_id}-${currentSetIndex}` : null;
  const currentLoggedSet = currentSetKey ? logLookup.get(currentSetKey) : null;
  const activeWeight =
    currentLoggedSet?.weight ?? currentSetInputs[currentSetIndex - 1]?.weight ?? targetWeight;
  const activeReps =
    currentLoggedSet?.reps ??
    currentSetInputs[currentSetIndex - 1]?.reps ??
    currentBlock?.reps ??
    "";

  const launchConfetti = () => {
    if (typeof window === "undefined") return;
    const colors = ["#22c55e", "#3b82f6", "#f97316", "#e11d48", "#a855f7"];
    const confettiCount = 120;
    for (let i = 0; i < confettiCount; i += 1) {
      const piece = document.createElement("div");
      const size = Math.random() * 6 + 6;
      piece.style.position = "fixed";
      piece.style.top = "-10px";
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * 0.6}px`;
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.opacity = "0.9";
      piece.style.pointerEvents = "none";
      piece.style.zIndex = "9999";
      piece.style.borderRadius = "2px";
      document.body.appendChild(piece);
      const drift = (Math.random() - 0.5) * 200;
      const duration = 1200 + Math.random() * 800;
      const rotation = Math.random() * 360;
      piece
        .animate(
          [
            { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate3d(${drift}px, ${window.innerHeight + 200}px, 0) rotate(${rotation}deg)`,
              opacity: 0,
            },
          ],
          { duration, easing: "ease-out" },
        )
        .onfinish = () => piece.remove();
    }
  };

  useEffect(() => {
    // Guard: skip recalculation when a local logging action is in progress
    // to avoid the dual-update race condition that causes set skipping
    if (isLoggingRef.current) {
      if (initialLogs) setLogs(initialLogs);
      return;
    }
    if (!initialLogs) {
      setLogs((prev: SetLogEntry[]) => (prev.length ? [] : prev));
      setCurrentSetInputs((prev: Record<number, SetInputValues>) =>
        Object.keys(prev).length ? {} : prev,
      );
      return;
    }
    setLogs(initialLogs);
    if (!initialLogs.length) {
      setCurrentSetInputs((prev: Record<number, SetInputValues>) =>
        Object.keys(prev).length ? {} : prev,
      );
      setCurrentStep((prev: number) => (prev === 0 ? prev : 0));
      return;
    }
    const blocks = session.items || [];
    if (!blocks.length) return;
    const logsByExercise = new Map<number, SetLogEntry[]>();
    initialLogs.forEach((log: SetLogEntry, index: number) => {
      if (!log.exercise_id) return;
      const existing = logsByExercise.get(log.exercise_id) ?? [];
      existing.push({ ...log, set_index: resolveSetNumber(log, index + 1) });
      logsByExercise.set(log.exercise_id, existing);
    });
    const resolvedStep = resolveNextStep(blocks, initialLogs);
    if (resolvedStep > 0 && resolvedStep <= blocks.length) {
      const block = blocks[resolvedStep - 1];
      const existing = logsByExercise.get(block.exercise_id) ?? [];
      const inputs = existing.reduce((acc: Record<number, SetInputValues>, log: SetLogEntry, index: number) => {
        const setNumber = resolveSetNumber(log, index + 1);
        acc[setNumber - 1] = {
          reps: log.reps ?? undefined,
          weight: log.weight ?? undefined,
        };
        return acc;
      }, {});
      setCurrentSetInputs(inputs);
      const nextSetIndex = Math.min(block.sets ?? 1, existing.length + 1);
      setCurrentSetIndex(nextSetIndex);
    } else {
      setCurrentSetInputs({});
      setCurrentSetIndex(1);
    }
    setCurrentStep((prev) => (prev === resolvedStep ? prev : resolvedStep));
  }, [initialLogs, session.items]);

  useEffect(() => {
    if (currentStep <= workoutPlan.length || hasCelebrated) return;
    launchConfetti();
    setHasCelebrated(true);
  }, [currentStep, workoutPlan.length, hasCelebrated]);

  const updateStep = (nextStep: number) => {
    setCurrentStep(nextStep);
    onStepChange?.(nextStep);
  };

  const startRestTimer = (duration: number) => {
    if (duration <= 0) return;
    restEndRef.current = Date.now() + duration * 1000;
    restPausedRemainingRef.current = 0;
    setRestTimer(duration);
    setIsResting(true);
    setIsRestPaused(false);
  };

  const advanceExercise = async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const nextStep = currentStep + 1;
    setCurrentSetIndex(1);
    setCurrentSetInputs({});
    updateStep(nextStep);
    const progressPct = Math.round(
      (Math.min(nextStep - 1, workoutPlan.length) / workoutPlan.length) * 100,
    );
    try {
      await onProgress?.(progressPct);
    } catch (err) {
      toast({ title: "Erreur de sauvegarde", description: "Réessayez", variant: "destructive" });
    }
  };

  const handleValidateSet = async () => {
    if (!currentBlock) return;
    if (currentLoggedSet) {
      if (currentSetIndex >= currentBlock.sets) {
        await advanceExercise();
      } else {
        setCurrentSetIndex((prev) => Math.min(currentBlock.sets, prev + 1));
      }
      return;
    }
    const newLog = {
      exercise_id: currentBlock.exercise_id,
      set_number: currentSetIndex,
      reps: currentSetInputs[currentSetIndex - 1]?.reps || currentBlock.reps,
      weight: currentSetInputs[currentSetIndex - 1]?.weight || targetWeight,
    };
    setLogs((prev) => [...prev, newLog]);
    isLoggingRef.current = true;
    try {
      await onLogSets?.([newLog]);
    } catch (err) {
      toast({ title: "Erreur de sauvegarde", description: "Réessayez", variant: "destructive" });
    } finally {
      isLoggingRef.current = false;
    }
    if (autoRest && currentBlock.rest_seconds > 0) {
      startRestTimer(currentBlock.rest_seconds);
    }
    if (currentSetIndex >= currentBlock.sets) {
      await advanceExercise();
      return;
    }
    setCurrentSetIndex((prev) => Math.min(currentBlock.sets, prev + 1));
  };

  const openInputSheet = (type: "weight" | "reps") => {
    setActiveInput(type);
    const existingValue =
      type === "weight"
        ? currentSetInputs[currentSetIndex - 1]?.weight ?? targetWeight ?? ""
        : currentSetInputs[currentSetIndex - 1]?.reps ?? currentBlock?.reps ?? "";
    setDraftValue(existingValue ? String(existingValue) : "");
    setInputSheetOpen(true);
  };

  const applyDraftValue = () => {
    if (!currentBlock) return;
    const parsed =
      activeInput === "weight"
        ? Number(draftValue.replace(",", "."))
        : Number(draftValue);
    if (!Number.isFinite(parsed)) return;
    setCurrentSetInputs((prev: Record<number, SetInputValues>) => ({
      ...prev,
      [currentSetIndex - 1]: {
        ...prev[currentSetIndex - 1],
        [activeInput]: parsed,
      },
    }));
    setInputSheetOpen(false);
  };

  const appendDraft = (value: string) => {
    setDraftValue((prev) => {
      if (value === "." && prev.includes(".")) {
        return prev;
      }
      return prev + value;
    });
  };

  const selectInputType = (type: "weight" | "reps") => {
    if (!currentBlock) return;
    setActiveInput(type);
    const nextValue =
      type === "weight"
        ? currentSetInputs[currentSetIndex - 1]?.weight ?? targetWeight ?? ""
        : currentSetInputs[currentSetIndex - 1]?.reps ?? currentBlock?.reps ?? "";
    setDraftValue(nextValue ? String(nextValue) : "");
  };

  if (currentStep === 0) {
    return (
      <div className="space-y-6 text-center py-8 animate-in zoom-in duration-300">
        <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Dumbbell className="h-10 w-10 text-primary ml-1" />
        </div>
        <div>
          <h2 className="text-3xl font-bold font-display uppercase">{session.title}</h2>
          <p className="text-muted-foreground text-lg">{session.description}</p>
          <div className="flex gap-2 justify-center mt-4">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {session.cycle}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {workoutPlan.length} Exercices
            </Badge>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full text-xl h-14 font-bold uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-transform"
          disabled={isStarting}
          onClick={async () => {
            setIsStarting(true);
            try {
              await onStart?.();
              updateStep(1);
            } finally {
              setIsStarting(false);
            }
          }}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              CHARGEMENT...
            </>
          ) : (
            "COMMENCER SÉANCE"
          )}
        </Button>
      </div>
    );
  }

  if (currentStep > workoutPlan.length) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Card className="border-t-8 border-t-primary shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl uppercase font-display italic">Séance Terminée !</CardTitle>
            <CardDescription className="text-lg">
              Durée totale: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-xs uppercase font-bold text-muted-foreground">Volume</div>
                <div className="text-2xl font-mono font-bold">
                  {logs.reduce((acc, l) => acc + (Number(l.weight) || 0) * (Number(l.reps) || 0), 0)} kg
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-xs uppercase font-bold text-muted-foreground">Séries</div>
                <div className="text-2xl font-mono font-bold">{logs.length}</div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="uppercase font-bold text-xs text-muted-foreground">
                Difficulté de la séance
              </Label>
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                <span>Facile</span>
                <span>Très dur</span>
              </div>
              <ScaleSelector5 value={difficulty} onChange={setDifficulty} />
            </div>
            <div className="space-y-3">
              <Label className="uppercase font-bold text-xs text-muted-foreground">
                Fatigue fin de séance
              </Label>
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                <span>Frais</span>
                <span>Épuisé</span>
              </div>
              <ScaleSelector5 value={fatigue} onChange={setFatigue} />
            </div>
            <div className="space-y-2">
              <Label className="uppercase font-bold text-xs text-muted-foreground">Notes</Label>
              <textarea
                placeholder="Sensations, douleurs..."
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full h-14 text-lg font-bold uppercase"
              disabled={isFinishing}
              onClick={() => {
                if (isFinishing) return;
                onFinish({
                  duration: Math.floor(elapsedTime / 60),
                  feeling: difficulty,
                  fatigue,
                  comments,
                  logs,
                });
              }}
            >
              {isFinishing ? "ENREGISTREMENT..." : "ENREGISTRER & FERMER"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Voir l’animation de l’exercice"
            onClick={() => {
              if (!currentExerciseDef?.illustration_gif) return;
              setIsGifOpen(true);
            }}
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-card shadow-sm"
          >
            {currentExerciseDef?.illustration_gif ? (
              <img
                src={currentExerciseDef.illustration_gif}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Dumbbell className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              Ex {currentStep}/{workoutPlan.length}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              S {currentSetIndex}/{formatStrengthValue(currentBlock?.sets)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-muted-foreground">Séance</div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-sm font-semibold">{progressPct}%</div>
          </div>
          {onExitFocus ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Quitter le focus"
              onClick={() => {
                if (logs.length > 0) {
                  setExitConfirmOpen(true);
                } else {
                  onExitFocus();
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {currentExerciseDef?.nom_exercice ?? "Exercice"}
        </h2>
        {muscleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {muscleTags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Card className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">Série en cours</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={autoRest} onCheckedChange={setAutoRest} />
            Auto repos
          </div>
        </div>
        <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
          <div className="text-sm font-semibold">En cours</div>
          <div className="mt-2 text-lg font-semibold">
            Série {currentSetIndex}/{formatStrengthValue(currentBlock?.sets)} · Objectif{" "}
            {formatStrengthValue(currentBlock?.reps)} reps
          </div>
          <div className="mt-2 text-sm text-muted-foreground">Appuie sur une tuile pour saisir.</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="group relative rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-muted/30 p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md"
            onClick={() => openInputSheet("weight")}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Charge</div>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-3xl font-bold tabular-nums tracking-tight">
                {activeWeight || "—"}
              </span>
              <span className="text-sm font-medium text-muted-foreground">kg</span>
            </div>
          </button>
          <button
            type="button"
            className="group relative rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-muted/30 p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md"
            onClick={() => openInputSheet("reps")}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reps</div>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-3xl font-bold tabular-nums tracking-tight">
                {activeReps || "—"}
              </span>
              <span className="text-sm font-medium text-muted-foreground">reps</span>
            </div>
          </button>
        </div>
        <div className="mt-4 rounded-2xl border bg-muted/10 p-4">
          <div className="text-sm font-semibold">Notes</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {currentBlock?.notes || currentExerciseDef?.description || "Aucune note spécifique."}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full rounded-2xl"
          onClick={() => setSeriesSheetOpen(true)}
        >
          Voir les séries
        </Button>
      </Card>

      {!inputSheetOpen && !isResting ? (
        <BottomActionBar 
          className="bottom-0 z-[60]" 
          containerClassName="gap-3 py-4"
        >
          <Button
            className="flex-1 min-w-0 h-12 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-transform"
            onClick={handleValidateSet}
          >
            <Check className="mr-2 h-5 w-5" /> Valider série
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 rounded-xl p-0 active:scale-95 transition-transform"
            onClick={() => {
              if (restDuration <= 0) return;
              startRestTimer(restDuration);
            }}
            aria-label="Démarrer le repos"
          >
            <Timer className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 rounded-xl p-0 active:scale-95 transition-transform"
            onClick={() => advanceExercise()}
            aria-label="Exercice suivant"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </BottomActionBar>
      ) : null}

      {isResting && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-start justify-between border-b px-6 py-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Timer</div>
              <div className="text-lg font-semibold">Transition inter-exercice</div>
              <div className="text-sm text-muted-foreground">
                Prochain exercice : {nextExerciseDef?.nom_exercice ?? "À venir"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsResting(false);
                setIsRestPaused(false);
              }}
              aria-label="Fermer le timer de repos"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
            <Card className="w-full max-w-sm rounded-3xl border p-6 shadow-sm">
              <div className="text-sm text-muted-foreground">Temps restant</div>
              <div className="mt-2 text-5xl font-semibold tracking-tight">
                {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, "0")}
              </div>
              <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: restDuration ? `${(restTimer / restDuration) * 100}%` : "0%",
                  }}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    restEndRef.current += 15 * 1000;
                    if (isRestPaused) restPausedRemainingRef.current += 15 * 1000;
                    setRestTimer((prev) => prev + 15);
                  }}
                >
                  +15s
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    restEndRef.current += 30 * 1000;
                    if (isRestPaused) restPausedRemainingRef.current += 30 * 1000;
                    setRestTimer((prev) => prev + 30);
                  }}
                >
                  +30s
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    restEndRef.current = Math.max(Date.now(), restEndRef.current - 15 * 1000);
                    if (isRestPaused) restPausedRemainingRef.current = Math.max(0, restPausedRemainingRef.current - 15 * 1000);
                    setRestTimer((prev) => Math.max(0, prev - 15));
                  }}
                >
                  -15s
                </Button>
                <Button
                  variant="outline"
                  className="ml-auto rounded-full"
                  onClick={() => {
                    restEndRef.current = Date.now() + restDuration * 1000;
                    if (isRestPaused) restPausedRemainingRef.current = restDuration * 1000;
                    setRestTimer(restDuration);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </Card>
            <div className="flex w-full max-w-sm flex-wrap gap-3">
              <Button
                className="flex-1 rounded-full py-6 text-base font-semibold"
                onClick={() => {
                  setIsRestPaused((prev) => {
                    if (!prev) {
                      // Pausing: save remaining ms
                      restPausedRemainingRef.current = Math.max(0, restEndRef.current - Date.now());
                    } else {
                      // Resuming: recalculate end time from saved remaining
                      restEndRef.current = Date.now() + restPausedRemainingRef.current;
                    }
                    return !prev;
                  });
                }}
              >
                <Pause className="mr-2 h-4 w-4" /> {isRestPaused ? "Reprendre" : "Pause"}
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-6 py-6 text-base font-semibold"
                onClick={() => {
                  restEndRef.current = 0;
                  restPausedRemainingRef.current = 0;
                  setIsResting(false);
                  setRestTimer(0);
                  setIsRestPaused(false);
                }}
              >
                Passer <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isGifOpen && currentExerciseDef?.illustration_gif && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setIsGifOpen(false)}
        >
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative">
              <button
                type="button"
                aria-label="Fermer"
                className="absolute -right-3 -top-3 rounded-full bg-background p-2 shadow"
                onClick={() => setIsGifOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={currentExerciseDef.illustration_gif}
                alt=""
                className="max-h-[80vh] w-auto max-w-[92vw] rounded-2xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}

      <Sheet open={seriesSheetOpen} onOpenChange={setSeriesSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Aperçu séance</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {workoutPlan.map((item, index) => {
              const exercise = exercises.find((ex) => ex.id === item.exercise_id);
              const loggedSets = Array.from({ length: item.sets }).filter((_, setIndex) =>
                logLookup.get(`${item.exercise_id}-${setIndex + 1}`),
              ).length;
              const pct = item.sets ? Math.round((loggedSets / item.sets) * 100) : 0;
              return (
                <Card
                  key={`${item.exercise_id}-${index}`}
                  className="rounded-3xl border bg-muted/10 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold">
                        {exercise?.nom_exercice ?? item.exercise_name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatStrengthValue(item.sets)}x{formatStrengthValue(item.reps)} ·{" "}
                        {item.percent_1rm ? `${formatStrengthValue(item.percent_1rm)} 1RM` : "—"}
                      </div>
                    </div>
                    <div className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                      {loggedSets}/{formatStrengthValue(item.sets)}
                    </div>
                  </div>
                  <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Input Bottom Sheet - Mobile-first numpad */}
      <Drawer open={inputSheetOpen} onOpenChange={setInputSheetOpen}>
        <DrawerContent className="max-h-[90vh]">
          <div className="mx-auto w-full max-w-md px-4 pb-8">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-center">
                {activeInput === "weight" ? "Charge" : "Répétitions"}
              </DrawerTitle>
              <DrawerDescription className="text-center">
                Série {currentSetIndex}/{formatStrengthValue(currentBlock?.sets)} · Objectif{" "}
                {formatStrengthValue(currentBlock?.reps)} reps
              </DrawerDescription>
            </DrawerHeader>

            {/* Toggle between weight/reps */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                className={cn(
                  "rounded-xl border-2 p-4 text-center transition-all",
                  activeInput === "weight"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-muted bg-card hover:border-muted-foreground/30"
                )}
                onClick={() => selectInputType("weight")}
              >
                <div className="text-xs font-semibold uppercase text-muted-foreground">Charge</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {activeInput === "weight"
                    ? draftValue || "—"
                    : String(currentSetInputs[currentSetIndex - 1]?.weight ?? targetWeight ?? "—")}
                  <span className="ml-1 text-base font-normal text-muted-foreground">kg</span>
                </div>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-xl border-2 p-4 text-center transition-all",
                  activeInput === "reps"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-muted bg-card hover:border-muted-foreground/30"
                )}
                onClick={() => selectInputType("reps")}
              >
                <div className="text-xs font-semibold uppercase text-muted-foreground">Reps</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {activeInput === "reps"
                    ? draftValue || "—"
                    : String(currentSetInputs[currentSetIndex - 1]?.reps ?? currentBlock?.reps ?? "—")}
                  <span className="ml-1 text-base font-normal text-muted-foreground">reps</span>
                </div>
              </button>
            </div>

            {/* Quick suggestions for weight */}
            {activeInput === "weight" && targetWeight > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    targetWeight - 10,
                    targetWeight - 5,
                    targetWeight,
                    targetWeight + 5,
                    targetWeight + 10,
                  ]
                    .filter((v) => v > 0)
                    .map((v) => (
                      <Button
                        key={v}
                        variant={Number(draftValue) === v ? "default" : "outline"}
                        size="sm"
                        className="rounded-full px-4 h-10 text-sm font-semibold"
                        onClick={() => setDraftValue(String(v))}
                      >
                        {v} kg
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {/* Quick suggestions for reps */}
            {activeInput === "reps" && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {[6, 8, 10, 12, 15, 20].map((v) => (
                    <Button
                      key={v}
                      variant={Number(draftValue) === v ? "default" : "outline"}
                      size="sm"
                      className="rounded-full px-4 h-10 text-sm font-semibold"
                      onClick={() => setDraftValue(String(v))}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Large numpad - mobile optimized */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-14 text-xl font-semibold rounded-xl active:scale-95 transition-transform"
                  onClick={() => appendDraft(String(num))}
                >
                  {num}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold rounded-xl active:scale-95 transition-transform"
                onClick={() => appendDraft(".")}
              >
                ,
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold rounded-xl active:scale-95 transition-transform"
                onClick={() => appendDraft("0")}
              >
                0
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold rounded-xl active:scale-95 transition-transform"
                onClick={() => setDraftValue((prev) => prev.slice(0, -1))}
              >
                ⌫
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14 text-base font-semibold rounded-xl"
                onClick={() => setDraftValue("")}
              >
                Effacer
              </Button>
              <Button
                className="flex-1 h-14 text-base font-semibold rounded-xl"
                onClick={applyDraftValue}
              >
                <Check className="mr-2 h-5 w-5" />
                Valider
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {onExitFocus && (
        <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quitter la séance ?</AlertDialogTitle>
              <AlertDialogDescription>
                Les séries enregistrées seront conservées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setExitConfirmOpen(false); onExitFocus(); }}>
                Quitter
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Focus, Trophy, Flame, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NEUROTYPE_QUESTIONS } from "@/lib/neurotype-quiz-data";
import { calculateNeurotypScores } from "@/lib/neurotype-scoring";
import type { NeurotypResult } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NeurotypQuizProps {
  onComplete: (result: NeurotypResult) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Slide animation variants
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 100 : -100, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -100 : 100, opacity: 0 }),
};

const TRANSITION = { duration: 0.25, ease: "easeInOut" as const };

// ---------------------------------------------------------------------------
// Intro pillars data
// ---------------------------------------------------------------------------

const PILLARS = [
  {
    icon: Focus,
    title: "Focus",
    text: "Adopte des méthodes d'entraînement adaptées",
  },
  {
    icon: Trophy,
    title: "Accomplir",
    text: "Obtiens de meilleurs gains en moins de temps",
  },
  {
    icon: Flame,
    title: "Performer",
    text: "Développe la confiance dans ton programme",
  },
  {
    icon: TrendingUp,
    title: "Résultats",
    text: "Commence à exploser tes records !",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NeurotypQuiz({ onComplete, onCancel }: NeurotypQuizProps) {
  const [screen, setScreen] = useState<"intro" | "quiz">("intro");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selecting, setSelecting] = useState(false);
  const direction = useRef(1);

  const totalQuestions = NEUROTYPE_QUESTIONS.length;
  const question = NEUROTYPE_QUESTIONS[currentIdx];

  // --- Handlers ---

  const goNext = useCallback(() => {
    if (currentIdx < totalQuestions - 1) {
      direction.current = 1;
      setCurrentIdx((i) => i + 1);
    }
  }, [currentIdx, totalQuestions]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      direction.current = -1;
      setCurrentIdx((i) => i - 1);
    } else {
      // Back to intro from Q1
      setScreen("intro");
    }
  }, [currentIdx]);

  const handleSelect = useCallback(
    (optionIdx: number) => {
      if (selecting) return;
      setSelecting(true);

      const updated = { ...answers, [question.id]: optionIdx };
      setAnswers(updated);

      // Auto-advance after brief highlight
      setTimeout(() => {
        if (currentIdx === totalQuestions - 1) {
          // Last question — compute and return result
          const result = calculateNeurotypScores(updated);
          onComplete(result);
        } else {
          direction.current = 1;
          setCurrentIdx((i) => i + 1);
        }
        setSelecting(false);
      }, 300);
    },
    [selecting, answers, question, currentIdx, totalQuestions, onComplete],
  );

  // --- Intro Screen ---

  if (screen === "intro") {
    return (
      <div className="flex flex-col items-center px-5 py-8 text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">
          Découvre ton Type d'Entraînement
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Connaître ton Neurotype te permet de t'entraîner d'une manière qui
          maximise tes résultats, ta récupération et ta motivation !
        </p>

        <div className="grid grid-cols-2 gap-3 mt-8 w-full">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-4"
            >
              <Icon className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">{title}</span>
              <span className="text-xs text-muted-foreground leading-snug">
                {text}
              </span>
            </div>
          ))}
        </div>

        <Button
          className="mt-8 w-full"
          size="lg"
          onClick={() => setScreen("quiz")}
        >
          Commencer le quiz
        </Button>

        <button
          type="button"
          className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={onCancel}
        >
          Retour
        </button>
      </div>
    );
  }

  // --- Quiz Screen ---

  const progress = ((currentIdx + 1) / totalQuestions) * 100;
  const selectedOption = answers[question.id];

  return (
    <div className="flex flex-col max-w-md mx-auto px-5 py-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={goPrev}
          aria-label="Question précédente"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <span className="text-sm font-medium tabular-nums">
          {currentIdx + 1} / {totalQuestions}
        </span>

        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={onCancel}
        >
          Quitter
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question + options (animated) */}
      <AnimatePresence mode="wait" custom={direction.current}>
        <motion.div
          key={currentIdx}
          custom={direction.current}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={TRANSITION}
          className="mt-8 flex flex-col gap-4"
        >
          <h2 className="text-base font-medium leading-relaxed">
            {question.text}
          </h2>

          <div className="flex flex-col gap-3 mt-2">
            {question.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const justPicked = selecting && isSelected;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={selecting}
                  className={[
                    "rounded-xl border bg-card p-4 text-left w-full text-sm transition-all",
                    justPicked
                      ? "ring-2 ring-primary bg-primary/5"
                      : isSelected
                        ? "ring-2 ring-primary/50 bg-primary/5"
                        : "hover:border-primary/40 active:scale-[0.98]",
                  ].join(" ")}
                  onClick={() => handleSelect(idx)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

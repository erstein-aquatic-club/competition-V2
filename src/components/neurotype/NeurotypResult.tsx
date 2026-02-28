import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Dumbbell,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NEUROTYPE_PROFILES,
  NEUROTYPE_COLORS,
} from "@/lib/neurotype-quiz-data";
import { getNeurotypLevel } from "@/lib/neurotype-scoring";
import type { NeurotypResult as NeurotypResultType, NeurotypCode } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NeurotypResultProps {
  result: NeurotypResultType;
  onSave: (result: NeurotypResultType) => void;
  onRetry: () => void;
  onBack: () => void;
  isSaving?: boolean;
}

// Ordered codes for display
const ORDERED_CODES: NeurotypCode[] = ["1A", "1B", "2A", "2B", "3"];

// ---------------------------------------------------------------------------
// Level badge component
// ---------------------------------------------------------------------------

function LevelBadge({ level }: { level: "match" | "potential" | "unsuited" }) {
  const config = {
    match: {
      label: "Correspondance",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    potential: {
      label: "Potentiel",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
    unsuited: {
      label: "Inadapté",
      className: "bg-muted text-muted-foreground",
    },
  }[level];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight whitespace-nowrap ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  items,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-card text-card-foreground overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold text-sm"
      >
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
              {items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NeurotypResult({
  result,
  onSave,
  onRetry,
  onBack,
  isSaving,
}: NeurotypResultProps) {
  const profile = NEUROTYPE_PROFILES[result.dominant];
  const color = NEUROTYPE_COLORS[result.dominant];

  // Animate bars from 0 to actual width
  const [animateBars, setAnimateBars] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimateBars(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-lg space-y-6 pb-28"
    >
      {/* ---- Back button ---- */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      {/* ---- Header ---- */}
      <div className="flex flex-col items-center text-center space-y-3">
        <span
          className="inline-flex items-center justify-center rounded-full px-5 py-2 text-2xl font-bold text-white shadow-lg"
          style={{ backgroundColor: color }}
        >
          {profile.code}
        </span>

        <h1 className="text-xl font-bold">{profile.fullName}</h1>

        <p className="text-sm text-muted-foreground">
          Neurotransmetteur dominant :{" "}
          <span className="font-medium text-foreground">
            {profile.neurotransmitter}
          </span>
        </p>

        <p className="italic text-muted-foreground text-sm">
          &laquo;&nbsp;{profile.motto}&nbsp;&raquo;
        </p>

        <p className="text-xs text-muted-foreground/70 leading-relaxed normal-case not-italic mt-1">
          Ces résultats sont donnés à titre indicatif pour t'aider à réfléchir
          sur tes préférences d'entraînement.
        </p>
      </div>

      {/* ---- Score bars ---- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Tes scores</h2>

        <div className="space-y-3">
          {ORDERED_CODES.map((code) => {
            const pct = result.scores[code];
            const level = getNeurotypLevel(pct);
            const p = NEUROTYPE_PROFILES[code];

            return (
              <div key={code} className="space-y-1">
                {/* Label row */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {code}{" "}
                    <span className="text-muted-foreground">{p.name}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums font-medium">{pct}%</span>
                    <LevelBadge level={level} />
                  </div>
                </div>

                {/* Bar */}
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: animateBars ? `${pct}%` : "0%",
                      backgroundColor: NEUROTYPE_COLORS[code],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Gym Training (always expanded) ---- */}
      <div className="rounded-xl border bg-card text-card-foreground overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 font-semibold text-sm">
          <Dumbbell className="h-4 w-4" />
          <span>Entraînement en Salle</span>
        </div>
        <ul className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
          {profile.gymTraining.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Traits (collapsible, default closed) ---- */}
      <CollapsibleSection
        title="Traits de personnalité"
        items={profile.traits}
      />

      {/* ---- Action buttons ---- */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          onClick={() => onSave(result)}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? (
            <>
              <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer mon résultat
            </>
          )}
        </Button>

        <Button variant="outline" onClick={onRetry} className="w-full">
          <RotateCcw className="mr-2 h-4 w-4" />
          Refaire le quiz
        </Button>
      </div>
    </motion.div>
  );
}

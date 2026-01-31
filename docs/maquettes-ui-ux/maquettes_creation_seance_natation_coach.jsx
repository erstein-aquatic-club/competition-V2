import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Dumbbell,
  Footprints,
  Glasses,
  GripVertical,
  Info,
  Layers,
  Pencil,
  Play,
  Plus,
  Route,
  Save,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from "lucide-react";

/**
 * Maquettes visuelles — Vue nageur + Coach (création/modification)
 *
 * ✅ Intensité: 5 niveaux (V0, V1, V2, V3, MAX)
 * ✅ Intensité cliquable (points) côté coach
 * ✅ Coach: vue condensée (liste ultra compacte) OU vue détaillée (pas les deux)
 * ✅ Nageur: toggle Condensé/Détail (pas les deux)
 * ✅ Numériques: autoriser vide temporairement puis corriger au blur/save
 */

// ---------------------------------
// Types
// ---------------------------------

type Stroke = "pap" | "crawl" | "dos" | "brasse" | "4n" | "spe";

type SwimType = "NC" | "Educ" | "Jambes";

type Equip = "palmes" | "tuba" | "plaquettes" | "pull" | "elastique";

type Intensity = "V0" | "V1" | "V2" | "V3" | "MAX";

type Exercise = {
  id: string;
  reps?: number;
  distance: number;
  stroke: Stroke;
  swimType: SwimType;
  intensity: Intensity;
  notes?: string[]; // modalités (une par ligne)
  equipment?: Equip[];
};

type Block = {
  id: string;
  blockReps: number;
  title?: string;
  exercises: Exercise[];
};

type Session = {
  id: string;
  name: string;
  totalDistance: number;
  estDurationMin: number;
  tags?: string[];
  blocks: Block[];
};

// ---------------------------------
// Design tokens (couleurs)
// ---------------------------------

const intensityScale: Intensity[] = ["V0", "V1", "V2", "V3", "MAX"];

// Intensité: vert (V0) -> rouge foncé (MAX)
const intensityTone: Record<Intensity, string> = {
  V0: "bg-emerald-500",
  V1: "bg-lime-500",
  V2: "bg-yellow-500",
  V3: "bg-orange-500",
  MAX: "bg-red-900",
};

const intensityTextTone: Record<Intensity, string> = {
  V0: "text-emerald-800",
  V1: "text-lime-800",
  V2: "text-yellow-800",
  V3: "text-orange-800",
  MAX: "text-red-900",
};

const intensityRingTone: Record<Intensity, string> = {
  V0: "ring-emerald-200",
  V1: "ring-lime-200",
  V2: "ring-yellow-200",
  V3: "ring-orange-200",
  MAX: "ring-red-300",
};

// Codes couleurs par type de nage
const swimTypeTone: Record<SwimType, string> = {
  NC: "bg-sky-100 text-sky-900 ring-sky-200",
  Educ: "bg-violet-100 text-violet-900 ring-violet-200",
  Jambes: "bg-teal-100 text-teal-900 ring-teal-200",
};

// ---------------------------------
// Utils
// ---------------------------------

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function strokeLabel(s: Stroke) {
  switch (s) {
    case "pap":
      return "Papillon";
    case "crawl":
      return "Crawl";
    case "dos":
      return "Dos";
    case "brasse":
      return "Brasse";
    case "4n":
      return "4 nages";
    case "spe":
      return "Spé";
  }
}

const strokeOptions: Array<{ value: Stroke; label: string }> = [
  { value: "pap", label: "Papillon" },
  { value: "dos", label: "Dos" },
  { value: "brasse", label: "Brasse" },
  { value: "crawl", label: "Crawl" },
  { value: "4n", label: "4 nages" },
  { value: "spe", label: "Spé" },
];

const equipOptions: Array<{ value: Equip; label: string }> = [
  { value: "palmes", label: "Palmes" },
  { value: "tuba", label: "Tuba" },
  { value: "plaquettes", label: "Plaquettes" },
  { value: "pull", label: "Pull" },
  { value: "elastique", label: "Élastique" },
];

function equipIcon(e: Equip) {
  switch (e) {
    case "palmes":
      return <Footprints className="h-4 w-4" />;
    case "tuba":
      return <Glasses className="h-4 w-4" />;
    case "plaquettes":
      return <Layers className="h-4 w-4" />;
    case "pull":
      return <Layers className="h-4 w-4" />;
    case "elastique":
      return <Dumbbell className="h-4 w-4" />;
  }
}

function intensityLevel(v: Intensity) {
  return intensityScale.indexOf(v) + 1; // 1..5
}

function intensityBadgeClass(v: Intensity, compact = false) {
  return cn(
    "inline-flex items-center gap-2 rounded-full ring-1",
    compact ? "px-2 py-0.5 text-[11px] font-semibold" : "px-2.5 py-1 text-xs font-semibold",
    "bg-white",
    intensityTextTone[v],
    intensityRingTone[v]
  );
}

function IntensityDots({
  value,
  onChange,
  size = "md",
}: {
  value: Intensity;
  onChange?: (v: Intensity) => void;
  size?: "sm" | "md";
}) {
  const filled = intensityLevel(value);
  const total = intensityScale.length;
  const dot = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const gap = size === "sm" ? "gap-1" : "gap-1.5";

  return (
    <div className={cn("flex items-center", gap)} aria-label={`Intensité ${value}`}>
      {Array.from({ length: total }).map((_, idx) => {
        const on = idx < filled;
        const target = intensityScale[idx];
        const interactive = Boolean(onChange);
        return (
          <button
            key={idx}
            type="button"
            onClick={interactive ? () => onChange!(target) : undefined}
            className={cn(
              "rounded-full",
              dot,
              on ? intensityTone[value] : "bg-slate-200",
              interactive && "hover:opacity-80"
            )}
            aria-label={interactive ? `Définir intensité ${target}` : undefined}
            title={interactive ? target : undefined}
          />
        );
      })}
    </div>
  );
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function calcTotalDistance(blocks: Block[]) {
  let total = 0;
  for (const b of blocks) {
    for (const ex of b.exercises) {
      const repCount = ex.reps && ex.distance !== 1 ? ex.reps : 1;
      const dist = ex.distance === 1 && ex.reps && ex.reps >= 100 ? ex.reps : ex.distance;
      total += repCount * dist * b.blockReps;
    }
  }
  return Math.max(0, total);
}

function swap<T>(arr: T[], i: number, j: number) {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
  const next = [...arr];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next;
}

function normalizeIntInput(raw: string, fallback: number, min: number) {
  const t = raw.trim();
  if (t === "") return fallback; // vide => on garde la dernière valeur valide
  const n = parseInt(t, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function normalizeSessionForSave(draft: Session): Session {
  const normalizedBlocks: Block[] = (draft.blocks ?? []).map((b) => ({
    ...b,
    blockReps: Number.isFinite(b.blockReps) ? Math.max(1, Math.trunc(b.blockReps)) : 1,
    exercises: (b.exercises ?? []).map((e) => ({
      ...e,
      distance: Number.isFinite(e.distance) ? Math.max(0, Math.trunc(e.distance)) : 0,
      reps: e.reps == null ? undefined : Number.isFinite(e.reps) ? Math.max(1, Math.trunc(e.reps)) : 1,
    })),
  }));

  return {
    ...draft,
    estDurationMin: Number.isFinite(draft.estDurationMin) ? Math.max(0, Math.trunc(draft.estDurationMin)) : 0,
    blocks: normalizedBlocks,
    totalDistance: calcTotalDistance(normalizedBlocks),
  };
}

// ---------------------------------
// Données démo
// ---------------------------------

const demoSessions: Session[] = [
  {
    id: "s1",
    name: "Technique + Aérobie",
    totalDistance: 0,
    estDurationMin: 55,
    tags: ["25m", "Matin"],
    blocks: [
      {
        id: "b1",
        blockReps: 3,
        title: "Tech",
        exercises: [
          {
            id: "e1",
            reps: 4,
            distance: 50,
            stroke: "pap",
            swimType: "NC",
            intensity: "V3",
            notes: ["Pas de respiration 15m", "Coulée 3 ondulations"],
            equipment: ["palmes", "tuba"],
          },
          {
            id: "e2",
            reps: 2,
            distance: 100,
            stroke: "crawl",
            swimType: "Educ",
            intensity: "V1",
            notes: ["Travail amplitude", "Relâchement"],
          },
        ],
      },
      {
        id: "b2",
        blockReps: 2,
        title: "Aérobie",
        exercises: [
          {
            id: "e3",
            reps: 4,
            distance: 200,
            stroke: "crawl",
            swimType: "NC",
            intensity: "V2",
            notes: ["Respiration 3 temps"],
          },
          {
            id: "e4",
            reps: 4,
            distance: 50,
            stroke: "dos",
            swimType: "Jambes",
            intensity: "V2",
            notes: ["Battements continus"],
            equipment: ["palmes"],
          },
        ],
      },
    ],
  },
];

demoSessions[0].totalDistance = calcTotalDistance(demoSessions[0].blocks);

// ---------------------------------
// Sanity tests (dev)
// ---------------------------------

(function devSanityChecks() {
  console.assert(Array.isArray(demoSessions) && demoSessions.length > 0, "demoSessions doit contenir au moins une séance");
  console.assert(intensityScale.length === 5, "intensityScale doit contenir 5 niveaux");
  for (const v of intensityScale) console.assert(Boolean(intensityTone[v]), `intensityTone manquant pour ${v}`);

  console.assert(calcTotalDistance([]) === 0, "calcTotalDistance([]) doit retourner 0");
  console.assert(
    calcTotalDistance(demoSessions[0].blocks) === demoSessions[0].totalDistance,
    "totalDistance demo doit matcher calc"
  );

  console.assert(JSON.stringify(swap([1, 2, 3], 0, 2)) === JSON.stringify([3, 2, 1]), "swap doit permuter correctement");
  console.assert(JSON.stringify(swap([1, 2, 3], -1, 2)) === JSON.stringify([1, 2, 3]), "swap OOB doit noop");

  console.assert(normalizeIntInput("", 5, 1) === 5, "normalizeIntInput vide => fallback");
  console.assert(normalizeIntInput("0", 5, 1) === 1, "normalizeIntInput clamp min");
  console.assert(normalizeIntInput("12", 5, 1) === 12, "normalizeIntInput parse ok");
  console.assert(normalizeIntInput("abc", 5, 1) === 5, "normalizeIntInput invalide => fallback");

  console.assert(
    calcTotalDistance([
      {
        id: "b",
        title: "t",
        blockReps: 2,
        exercises: [{ id: "e", distance: 50, reps: 4, stroke: "crawl", swimType: "NC", intensity: "V0" }],
      },
    ]) === 400,
    "calcTotalDistance doit gérer blockReps et reps"
  );

  console.assert(intensityLevel("MAX") === 5, "MAX doit correspondre au niveau 5");

  const normalized = normalizeSessionForSave({
    id: "t",
    name: "t",
    totalDistance: 0,
    estDurationMin: -12,
    blocks: [
      {
        id: "b",
        blockReps: -3,
        exercises: [{ id: "e", distance: -50, reps: -2, stroke: "crawl", swimType: "NC", intensity: "V1" }],
      },
    ],
  });
  console.assert(normalized.estDurationMin === 0, "estDurationMin doit être clamp à 0");
  console.assert(normalized.blocks[0].blockReps === 1, "blockReps doit être clamp à 1");
  console.assert(normalized.blocks[0].exercises[0].distance === 0, "distance doit être clamp à 0");
  console.assert(normalized.blocks[0].exercises[0].reps === 1, "reps doit être clamp à 1");
})();

// ---------------------------------
// UI primitives
// ---------------------------------

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[420px] px-4 py-6">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">{children}</div>
        <div className="mt-4 text-center text-xs text-slate-400">Maquettes — Nageur + Coach</div>
      </div>
    </div>
  );
}

function TopBar({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
      <div className="flex items-center gap-2">
        {left}
        <div className="font-semibold tracking-tight">{title}</div>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">{children}</div>
  );
}

function Pill({
  children,
  tone = "soft",
  compact = false,
}: {
  children: React.ReactNode;
  tone?: "soft" | "solid";
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        "font-medium",
        tone === "soft" && "bg-slate-100 text-slate-700",
        tone === "solid" && "bg-slate-900 text-white"
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  compact,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  compact?: boolean;
  type?: "button" | "submit";
}) {
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white border-slate-900"
      : variant === "secondary"
        ? "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
        : variant === "danger"
          ? "bg-white text-red-700 border-red-200 hover:bg-red-50"
          : "bg-transparent text-slate-700 border-transparent hover:bg-slate-100";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold",
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        cls,
        disabled && "opacity-50"
      )}
    >
      {children}
    </button>
  );
}

function ModalSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 mx-auto max-w-[420px]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 35 }}
          >
            <div className="overflow-hidden rounded-t-[28px] bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                <div className="text-sm font-semibold">{title}</div>
                <button
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4">{children}</div>
              <div className="h-6" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
    />
  );
}

function NumericInput({
  value,
  onCommit,
  min = 0,
  placeholder,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const next = normalizeIntInput(draft, value, min);
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200"
    />
  );
}

function SegmentedToggle({
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  leftLabel: string;
  rightLabel: string;
  value: "left" | "right";
  onChange: (v: "left" | "right") => void;
}) {
  return (
    <div className="rounded-full border border-slate-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange("left")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold",
          value === "left" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
        )}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("right")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold",
          value === "right" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
        )}
      >
        {rightLabel}
      </button>
    </div>
  );
}

// ---------------------------------
// Nageur: lecture
// ---------------------------------

function ExerciseRowRead({ ex, onInfo, compact }: { ex: Exercise; onInfo?: () => void; compact: boolean }) {
  const showInfo = Boolean(ex.notes?.length || ex.equipment?.length);

  const distanceLabel = useMemo(() => {
    if (ex.distance === 1 && ex.reps && ex.reps >= 100) return `${ex.reps}m`;
    return `${ex.distance}m`;
  }, [ex.distance, ex.reps]);

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white", compact ? "p-3" : "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {ex.reps && ex.distance !== 1 ? <Pill compact={compact}>{ex.reps}x</Pill> : null}
          <Pill compact={compact}>{distanceLabel}</Pill>
        </div>
        <div className="flex items-center gap-2">
          <span className={intensityBadgeClass(ex.intensity, compact)}>
            <span className={cn("h-2 w-2 rounded-full", intensityTone[ex.intensity])} />
            {ex.intensity}
          </span>
          {showInfo ? (
            <button
              type="button"
              onClick={onInfo}
              className={cn(
                "inline-flex items-center justify-center rounded-full hover:bg-slate-100",
                compact ? "h-8 w-8" : "h-9 w-9"
              )}
              aria-label="Détails"
            >
              <Info className="h-4 w-4" />
            </button>
          ) : (
            <div className={cn(compact ? "h-8 w-8" : "h-9 w-9")} />
          )}
        </div>
      </div>

      <div className={cn("flex items-start justify-between", compact ? "mt-2" : "mt-3", "gap-2")}>
        <div className="flex-1 leading-tight">
          <div className={cn("font-semibold tracking-tight", compact ? "text-[13px]" : "text-sm")}>{strokeLabel(ex.stroke)}</div>
          <div className={cn(compact ? "mt-0.5" : "mt-1", "text-xs text-slate-500")}>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 font-semibold ring-1",
                swimTypeTone[ex.swimType]
              )}
            >
              {ex.swimType}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <IntensityDots value={ex.intensity} size={compact ? "sm" : "md"} />
          {(ex.equipment ?? []).length ? (
            <div className="flex items-center gap-1 text-slate-500">
              {(ex.equipment ?? []).slice(0, 3).map((eq) => (
                <span
                  key={eq}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full bg-slate-100",
                    compact ? "h-7 w-7" : "h-8 w-8"
                  )}
                  title={eq}
                >
                  {equipIcon(eq)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "rounded-2xl border border-slate-200 bg-slate-50 text-slate-700",
          compact ? "mt-2 px-3 py-2 text-xs" : "mt-3 px-3 py-2 text-sm"
        )}
      >
        {(ex.notes?.length ? ex.notes : ["—"]).join(" · ")}
      </div>
    </div>
  );
}

function BlockCardRead({
  block,
  blockIndex,
  onExerciseInfo,
  compact,
}: {
  block: Block;
  blockIndex: number;
  onExerciseInfo: (ex: Exercise) => void;
  compact: boolean;
}) {
  return (
    <Card>
      <div className={cn("flex items-center justify-between", compact ? "px-3 py-3" : "px-4 py-4")}>
        <div className="flex items-center gap-2">
          <Pill tone="solid" compact={compact}>
            🔁 {block.blockReps}x
          </Pill>
          <div className={cn("font-semibold tracking-tight", compact ? "text-[13px]" : "text-sm")}>{block.title ? block.title : `Bloc ${blockIndex + 1}`}</div>
        </div>
        <Pill compact={compact}>
          <Layers className="h-3.5 w-3.5" /> {block.exercises.length}
        </Pill>
      </div>
      <div className={cn(compact ? "space-y-2 px-3 pb-3" : "space-y-3 px-4 pb-4")}>
        {block.exercises.map((ex) => (
          <ExerciseRowRead key={ex.id} ex={ex} compact={compact} onInfo={() => onExerciseInfo(ex)} />
        ))}
      </div>
    </Card>
  );
}

function ReaderPreview({ session, onBack }: { session: Session; onBack: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<Exercise | null>(null);
  const [compact, setCompact] = useState(true);

  return (
    <div>
      <TopBar
        title="Aperçu nageur"
        left={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Retour"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        }
        right={
          <SegmentedToggle
            leftLabel="Condensé"
            rightLabel="Détail"
            value={compact ? "left" : "right"}
            onChange={(v) => setCompact(v === "left")}
          />
        }
      />

      <div className={cn(compact ? "px-3 py-3" : "px-4 py-4")}>
        <div className={cn("font-semibold tracking-tight", compact ? "text-base" : "text-lg")}>{session.name}</div>
        <div className={cn("mt-1 flex items-center gap-3 text-slate-500", compact ? "text-[11px]" : "text-xs")}>
          <span className="inline-flex items-center gap-1">
            <Route className="h-3.5 w-3.5" /> {session.totalDistance}m
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" /> ~{session.estDurationMin} min
          </span>
        </div>
      </div>

      <div className={cn(compact ? "space-y-3 px-3 pb-3" : "space-y-4 px-4 pb-4")}>
        {session.blocks.map((b, idx) => (
          <BlockCardRead
            key={b.id}
            block={b}
            blockIndex={idx}
            compact={compact}
            onExerciseInfo={(ex) => {
              setSheetExercise(ex);
              setSheetOpen(true);
            }}
          />
        ))}
      </div>

      <ModalSheet open={sheetOpen} title="Détails" onClose={() => setSheetOpen(false)}>
        {sheetExercise ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold">{strokeLabel(sheetExercise.stroke)}</div>
            <div className="flex flex-wrap gap-2">
              <Pill>
                {`${sheetExercise.distance === 1 && sheetExercise.reps ? sheetExercise.reps : sheetExercise.distance}m`}
              </Pill>
              {sheetExercise.reps && sheetExercise.distance !== 1 ? <Pill>{sheetExercise.reps}x</Pill> : null}
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", swimTypeTone[sheetExercise.swimType])}>
                {sheetExercise.swimType}
              </span>
              <span className={intensityBadgeClass(sheetExercise.intensity)}>
                <span className={cn("h-2 w-2 rounded-full", intensityTone[sheetExercise.intensity])} />
                {sheetExercise.intensity}
              </span>
            </div>
            <IntensityDots value={sheetExercise.intensity} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {(sheetExercise.notes?.length ? sheetExercise.notes : ["—"]).join(" · ")}
            </div>
          </div>
        ) : null}
      </ModalSheet>

      <div className="h-6" />
    </div>
  );
}

// ---------------------------------
// Coach: liste + éditeur
// ---------------------------------

function CoachList({
  sessions,
  onOpenEdit,
  onCreate,
  onPreview,
}: {
  sessions: Session[];
  onOpenEdit: (s: Session) => void;
  onCreate: () => void;
  onPreview: (s: Session) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, sessions]);

  return (
    <div>
      <TopBar
        title="Coach"
        left={<span className="text-xs text-slate-500">Création</span>}
        right={
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Nouvelle
          </button>
        }
      />

      <div className="p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Rechercher une séance"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-3">
          {filtered.map((s) => (
            <Card key={s.id}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold tracking-tight">{s.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Route className="h-3.5 w-3.5" /> {s.totalDistance}m
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5" /> ~{s.estDurationMin} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {s.blocks.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPreview(s)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                      aria-label="Aperçu nageur"
                      title="Aperçu nageur"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(s)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                      aria-label="Modifier"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

function CoachEditor({
  initial,
  onBack,
  onSave,
  onPreview,
}: {
  initial: Session;
  onBack: () => void;
  onSave: (s: Session) => void;
  onPreview: (s: Session) => void;
}) {
  const [draft, setDraft] = useState<Session>(() => ({
    ...initial,
    blocks: (initial.blocks ?? []).map((b) => ({
      ...b,
      exercises: b.exercises.map((e) => ({ ...e })),
    })),
  }));

  const [coachView, setCoachView] = useState<"compact" | "detailed">("compact");

  const recompute = (nextBlocks: Block[]) => {
    const total = calcTotalDistance(nextBlocks);
    return {
      ...draft,
      blocks: nextBlocks,
      totalDistance: total,
    };
  };

  const updateSessionField = (patch: Partial<Session>) => setDraft((s) => ({ ...s, ...patch }));

  const updateBlock = (blockId: string, patch: Partial<Block>) => {
    const next = draft.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
    setDraft(recompute(next));
  };

  const moveBlock = (blockId: string, dir: -1 | 1) => {
    const idx = draft.blocks.findIndex((b) => b.id === blockId);
    const next = swap(draft.blocks, idx, idx + dir);
    setDraft(recompute(next));
  };

  const addBlock = () => {
    const nb: Block = {
      id: uid("b"),
      blockReps: 1,
      title: "Nouveau bloc",
      exercises: [
        {
          id: uid("e"),
          reps: 4,
          distance: 50,
          stroke: "crawl",
          swimType: "NC",
          intensity: "V2",
          notes: [],
          equipment: [],
        },
      ],
    };
    setDraft(recompute([...(draft.blocks ?? []), nb]));
  };

  const deleteBlock = (blockId: string) => {
    const next = draft.blocks.filter((b) => b.id !== blockId);
    setDraft(recompute(next));
  };

  const addExercise = (blockId: string) => {
    const next = draft.blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        exercises: [
          ...b.exercises,
          {
            id: uid("e"),
            reps: 4,
            distance: 50,
            stroke: "crawl",
            swimType: "NC",
            intensity: "V2",
            notes: [],
            equipment: [],
          },
        ],
      };
    });
    setDraft(recompute(next));
  };

  const deleteExercise = (blockId: string, exId: string) => {
    const next = draft.blocks.map((b) => {
      if (b.id !== blockId) return b;
      return { ...b, exercises: b.exercises.filter((e) => e.id !== exId) };
    });
    setDraft(recompute(next));
  };

  const updateExercise = (blockId: string, exId: string, patch: Partial<Exercise>) => {
    const next = draft.blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        exercises: b.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)),
      };
    });
    setDraft(recompute(next));
  };

  const toggleEquip = (blockId: string, exId: string, eq: Equip) => {
    const ex = draft.blocks.find((b) => b.id === blockId)?.exercises.find((e) => e.id === exId);
    const current = ex?.equipment ?? [];
    const nextEquip = current.includes(eq) ? current.filter((x) => x !== eq) : [...current, eq];
    updateExercise(blockId, exId, { equipment: nextEquip });
  };

  const setModalites = (blockId: string, exId: string, text: string) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    updateExercise(blockId, exId, { notes: lines });
  };

  return (
    <div>
      <TopBar
        title="Édition"
        left={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Retour"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        }
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPreview(draft)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Aperçu nageur"
              title="Aperçu nageur"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onSave(normalizeSessionForSave(draft))}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              <Save className="h-4 w-4" /> Sauver
            </button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <Card>
          <div className="space-y-3 p-4">
            <div className="text-sm font-semibold">Infos séance</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <div className="text-xs font-semibold text-slate-500">Nom</div>
                <div className="mt-1">
                  <Input value={draft.name} onChange={(v) => updateSessionField({ name: v })} placeholder="Nom de la séance" />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Durée estimée (min)</div>
                <div className="mt-1">
                  <NumericInput value={draft.estDurationMin} min={0} placeholder="55" onCommit={(n) => updateSessionField({ estDurationMin: n })} />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Distance totale</div>
                <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">{draft.totalDistance}m</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Vue coach</div>
          <SegmentedToggle
            leftLabel="Condensé"
            rightLabel="Détail"
            value={coachView === "compact" ? "left" : "right"}
            onChange={(v) => setCoachView(v === "left" ? "compact" : "detailed")}
          />
        </div>

        {coachView === "compact" ? (
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Plan (ultra compact)</div>
                  <div className="mt-1 text-xs text-slate-500">Manipule les blocs vite. Passe en “Détail” pour éditer.</div>
                </div>
                <Button variant="secondary" compact onClick={addBlock}>
                  <Plus className="h-4 w-4" /> Bloc
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {draft.blocks.map((b, bi) => (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Pill tone="solid" compact>
                            🔁 {b.blockReps}x
                          </Pill>
                          <div className="truncate text-xs font-semibold">{b.title ?? `Bloc ${bi + 1}`}</div>
                          <div className="text-[11px] text-slate-500">· {b.exercises.length} ex</div>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-1">
                          {b.exercises.slice(0, 4).map((ex) => (
                            <span
                              key={ex.id}
                              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                              title={ex.notes?.length ? ex.notes.join(" · ") : ""}
                            >
                              {ex.reps && ex.distance !== 1 ? `${ex.reps}x` : ""}
                              {ex.distance}m
                              <span className={cn("ml-1 inline-flex items-center rounded-full px-2 py-0.5 ring-1", swimTypeTone[ex.swimType])}>
                                {ex.swimType}
                              </span>
                              <span
                                className={cn(
                                  "ml-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1",
                                  intensityRingTone[ex.intensity],
                                  intensityTextTone[ex.intensity]
                                )}
                              >
                                <span className={cn("h-2 w-2 rounded-full", intensityTone[ex.intensity])} />
                                {ex.intensity}
                              </span>
                            </span>
                          ))}
                          {b.exercises.length > 4 ? (
                            <span className="text-[11px] text-slate-400">+{b.exercises.length - 4}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveBlock(b.id, -1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40"
                          aria-label="Monter"
                          title="Monter"
                          disabled={bi === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(b.id, 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40"
                          aria-label="Descendre"
                          title="Descendre"
                          disabled={bi === draft.blocks.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBlock(b.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                          aria-label="Supprimer bloc"
                          title="Supprimer bloc"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {!draft.blocks.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
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
              <Button variant="secondary" onClick={addBlock}>
                <Plus className="h-4 w-4" /> Ajouter bloc
              </Button>
            </div>

            <div className="space-y-4">
              {draft.blocks.map((b, bi) => (
                <Card key={b.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
                          title="Drag (maquette)"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-slate-500">Titre bloc</div>
                          <Input value={b.title ?? `Bloc ${bi + 1}`} onChange={(v) => updateBlock(b.id, { title: v })} placeholder={`Bloc ${bi + 1}`} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveBlock(b.id, -1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40"
                          aria-label="Monter"
                          title="Monter"
                          disabled={bi === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(b.id, 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40"
                          aria-label="Descendre"
                          title="Descendre"
                          disabled={bi === draft.blocks.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBlock(b.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                          aria-label="Supprimer bloc"
                          title="Supprimer bloc"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500">Répétitions du bloc</div>
                        <div className="mt-1">
                          <NumericInput value={b.blockReps} min={1} placeholder="1" onCommit={(n) => updateBlock(b.id, { blockReps: n })} />
                        </div>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button variant="secondary" onClick={() => addExercise(b.id)}>
                          <Plus className="h-4 w-4" /> Exercice
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {b.exercises.map((ex) => {
                        const modalitesText = (ex.notes?.length ? ex.notes : []).join("\n");
                        return (
                          <div key={ex.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="grid flex-1 grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[11px] font-semibold text-slate-500">Répétitions</div>
                                  <div className="mt-1">
                                    <NumericInput value={ex.reps ?? 1} min={1} onCommit={(n) => updateExercise(b.id, ex.id, { reps: n })} />
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-semibold text-slate-500">Distance (m)</div>
                                  <div className="mt-1">
                                    <NumericInput value={ex.distance} min={0} onCommit={(n) => updateExercise(b.id, ex.id, { distance: n })} />
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-semibold text-slate-500">Nage</div>
                                  <div className="mt-1">
                                    <Select value={ex.stroke} onChange={(v) => updateExercise(b.id, ex.id, { stroke: v as Stroke })} options={strokeOptions} />
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-semibold text-slate-500">Type</div>
                                  <div className="mt-1">
                                    <Select
                                      value={ex.swimType}
                                      onChange={(v) => updateExercise(b.id, ex.id, { swimType: v as SwimType })}
                                      options={[
                                        { value: "NC", label: "NC" },
                                        { value: "Educ", label: "Educ" },
                                        { value: "Jambes", label: "Jambes" },
                                      ]}
                                    />
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[11px] font-semibold text-slate-500">Intensité (clic sur points)</div>
                                    <span className={intensityBadgeClass(ex.intensity)}>
                                      <span className={cn("h-2 w-2 rounded-full", intensityTone[ex.intensity])} />
                                      {ex.intensity}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <IntensityDots value={ex.intensity} onChange={(v) => updateExercise(b.id, ex.id, { intensity: v })} />
                                    <select
                                      value={ex.intensity}
                                      onChange={(e) => updateExercise(b.id, ex.id, { intensity: e.target.value as Intensity })}
                                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                    >
                                      {intensityScale.map((v) => (
                                        <option key={v} value={v}>
                                          {v}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  <div className="text-[11px] font-semibold text-slate-500">Équipements</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {equipOptions.map((opt) => {
                                      const active = (ex.equipment ?? []).includes(opt.value);
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => toggleEquip(b.id, ex.id, opt.value)}
                                          className={cn(
                                            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
                                            active
                                              ? "border-slate-900 bg-slate-900 text-white"
                                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                          )}
                                        >
                                          <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full", active ? "bg-white/10" : "bg-slate-100")}>
                                            {equipIcon(opt.value)}
                                          </span>
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="col-span-2">
                                  <div className="text-[11px] font-semibold text-slate-500">Modalités</div>
                                  <div className="mt-1">
                                    <Textarea value={modalitesText} onChange={(v) => setModalites(b.id, ex.id, v)} placeholder="Une modalité par ligne" rows={3} />
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => deleteExercise(b.id, ex.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
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
                      <Button variant="secondary" compact onClick={() => addExercise(b.id)}>
                        <Plus className="h-4 w-4" /> Ajouter exercice
                      </Button>
                      <Button variant="danger" compact onClick={() => deleteBlock(b.id)}>
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
    </div>
  );
}

// ---------------------------------
// Root
// ---------------------------------

type ScreenKey = "coachList" | "coachEdit" | "preview" | "settings";

type Mode = "coach" | "nageur";

export default function SwimMockups() {
  const [mode, setMode] = useState<Mode>("coach");
  const [screen, setScreen] = useState<ScreenKey>("coachList");

  const [sessions, setSessions] = useState<Session[]>(() => {
    const base = demoSessions.map((s) => ({
      ...s,
      blocks: s.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((e) => ({ ...e })),
      })),
    }));
    return base.map((s) => ({ ...s, totalDistance: calcTotalDistance(s.blocks) }));
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id ?? "");
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId]
  );

  const goCoach = () => {
    setMode("coach");
    setScreen("coachList");
  };

  const goNageurPreview = (s: Session) => {
    setMode("nageur");
    setActiveSessionId(s.id);
    setScreen("preview");
  };

  const startCreate = () => {
    const s: Session = {
      id: uid("s"),
      name: "Nouvelle séance",
      totalDistance: 0,
      estDurationMin: 45,
      tags: ["25m"],
      blocks: [],
    };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setMode("coach");
    setScreen("coachEdit");
  };

  const openEdit = (s: Session) => {
    setActiveSessionId(s.id);
    setMode("coach");
    setScreen("coachEdit");
  };

  const saveSession = (draft: Session) => {
    const normalized = normalizeSessionForSave(draft);
    setSessions((prev) => prev.map((s) => (s.id === normalized.id ? normalized : s)));
    setActiveSessionId(normalized.id);
    setMode("coach");
    setScreen("coachList");
  };

  return (
    <PhoneFrame>
      <div className="relative">
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-500">Mode</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goCoach}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold",
                  mode === "coach" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                )}
              >
                Coach
              </button>
              <button
                type="button"
                onClick={() => activeSession && goNageurPreview(activeSession)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold",
                  mode === "nageur" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                )}
              >
                Nageur
              </button>
              <button
                type="button"
                onClick={() => setScreen("settings")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                aria-label="Paramètres"
                title="Paramètres"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {screen === "coachList" && (
            <motion.div
              key="coachList"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <CoachList sessions={sessions} onCreate={startCreate} onOpenEdit={openEdit} onPreview={(s) => goNageurPreview(s)} />
            </motion.div>
          )}

          {screen === "coachEdit" && activeSession && (
            <motion.div
              key="coachEdit"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <CoachEditor
                initial={activeSession}
                onBack={() => {
                  setMode("coach");
                  setScreen("coachList");
                }}
                onSave={saveSession}
                onPreview={(draft) => {
                  const normalized = normalizeSessionForSave(draft);
                  setSessions((prev) => prev.map((s) => (s.id === normalized.id ? normalized : s)));
                  goNageurPreview(normalized);
                }}
              />
            </motion.div>
          )}

          {screen === "preview" && activeSession && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <ReaderPreview
                session={activeSession}
                onBack={() => {
                  setMode("coach");
                  setScreen("coachList");
                }}
              />
            </motion.div>
          )}

          {screen === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <SettingsScreen onBack={() => setScreen(mode === "coach" ? "coachList" : "preview")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [poolMode, setPoolMode] = useState(true);

  return (
    <div>
      <TopBar
        title="Préférences"
        left={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Retour"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        }
      />

      <div className="space-y-3 p-4">
        <Card>
          <div className="p-4">
            <div className="text-sm font-semibold">Mode piscine</div>
            <div className="mt-1 text-xs text-slate-500">Contraste renforcé et zones tactiles plus larges.</div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setPoolMode((v) => !v)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-sm font-semibold",
                  poolMode ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                {poolMode ? "Activé" : "Désactivé"}
              </button>
            </div>
          </div>
        </Card>

        <div className="h-6" />
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Timer,
  Route,
  Layers,
  Info,
  X,
  Footprints,
  Glasses,
  Dumbbell,
  Search,
  SlidersHorizontal,
  Play,
  Pause,
} from "lucide-react";

/**
 * Maquettes visuelles — Vue nageur (Vite + React)
 *
 * Objectif:
 * - Lecture ultra rapide au bord du bassin
 * - Blocs + exercices, intensité visuelle, modalités lisibles
 *
 * Dépendances attendues:
 * - tailwindcss
 * - framer-motion
 * - lucide-react
 */

// ---------------------------------
// Types
// ---------------------------------

type Stroke = "pap" | "crawl" | "dos" | "brasse" | "4n" | "spe";

type SwimType = "NC" | "Educ" | "Jambes";

type Equip = "palmes" | "tuba" | "plaquettes" | "pull" | "elastique";

type Intensity = "V0" | "V1" | "V2" | "V3" | "V4" | "V5" | "MAX";

type Exercise = {
  id: string;
  reps?: number; // 4x
  distance: number; // mètres (si 1 avec reps>=100 -> hack demo pour 200m)
  stroke: Stroke;
  swimType: SwimType;
  intensity: Intensity;
  notes?: string[]; // modalités
  equipment?: Equip[];
};

type Block = {
  id: string;
  blockReps: number; // répétitions du bloc
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

const intensityScale: Intensity[] = ["V0", "V1", "V2", "V3", "V4", "V5", "MAX"];

// Intensité: vert (V0) -> rouge foncé (MAX)
const intensityTone: Record<Intensity, string> = {
  V0: "bg-emerald-500",
  V1: "bg-lime-500",
  V2: "bg-yellow-500",
  V3: "bg-orange-500",
  V4: "bg-orange-600",
  V5: "bg-red-600",
  MAX: "bg-red-900",
};

const intensityTextTone: Record<Intensity, string> = {
  V0: "text-emerald-800",
  V1: "text-lime-800",
  V2: "text-yellow-800",
  V3: "text-orange-800",
  V4: "text-orange-900",
  V5: "text-red-800",
  MAX: "text-red-900",
};

const intensityRingTone: Record<Intensity, string> = {
  V0: "ring-emerald-200",
  V1: "ring-lime-200",
  V2: "ring-yellow-200",
  V3: "ring-orange-200",
  V4: "ring-orange-200",
  V5: "ring-red-200",
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
  return intensityScale.indexOf(v) + 1; // 1..7
}

function intensityBadgeClass(v: Intensity) {
  return cn(
    "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
    "bg-white",
    intensityTextTone[v],
    intensityRingTone[v]
  );
}

function IntensityDots({ value }: { value: Intensity }) {
  const filled = intensityLevel(value);
  const total = 7;

  return (
    <div className="flex items-center gap-1.5" aria-label={`Intensité ${value}`}>
      {Array.from({ length: total }).map((_, idx) => {
        const on = idx < filled;
        return (
          <span
            key={idx}
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              on ? intensityTone[value] : "bg-slate-200"
            )}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------
// Données démo (important pour éviter ReferenceError)
// ---------------------------------

const demoSessions: Session[] = [
  {
    id: "s1",
    name: "Technique + Aérobie",
    totalDistance: 2600,
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
      {
        id: "b3",
        blockReps: 1,
        title: "Retour au calme",
        exercises: [
          {
            id: "e5",
            reps: 200,
            distance: 1,
            stroke: "4n",
            swimType: "NC",
            intensity: "V0",
            notes: ["Très souple"],
          },
        ],
      },
    ],
  },
  {
    id: "s2",
    name: "Vitesse (Sprint)",
    totalDistance: 1800,
    estDurationMin: 40,
    tags: ["50m", "Soir"],
    blocks: [
      {
        id: "b4",
        blockReps: 4,
        title: "Sprint",
        exercises: [
          {
            id: "e6",
            reps: 6,
            distance: 25,
            stroke: "crawl",
            swimType: "NC",
            intensity: "V5",
            notes: ["Départ arrêté", "Récup 30s"],
          },
          {
            id: "e7",
            reps: 4,
            distance: 50,
            stroke: "spe",
            swimType: "NC",
            intensity: "MAX",
            notes: ["100%", "Qualité"],
          },
        ],
      },
    ],
  },
];

// ---------------------------------
// "Test cases" (sanity checks légers)
// ---------------------------------

(function devSanityChecks() {
  // Ces assertions servent de garde-fous si les données changent.
  console.assert(Array.isArray(demoSessions) && demoSessions.length > 0, "demoSessions doit contenir au moins une séance");
  console.assert(intensityScale.length === 7, "intensityScale doit contenir 7 niveaux");
  for (const k of intensityScale) {
    console.assert(Boolean(intensityTone[k]), `intensityTone manquant pour ${k}`);
  }
})();

// ---------------------------------
// Composants UI de base
// ---------------------------------

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[420px] px-4 py-6">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
          {children}
        </div>
        <div className="mt-4 text-center text-xs text-slate-400">Maquettes — Vue nageur (mobile-first)</div>
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      {children}
    </div>
  );
}

function Pill({ children, tone = "soft" }: { children: React.ReactNode; tone?: "soft" | "solid" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "soft" && "bg-slate-100 text-slate-700",
        tone === "solid" && "bg-slate-900 text-white"
      )}
    >
      {children}
    </span>
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

// ---------------------------------
// Composants métier
// ---------------------------------

function ExerciseRow({ ex, onInfo, compact = false }: { ex: Exercise; onInfo?: () => void; compact?: boolean }) {
  const showInfo = Boolean(ex.notes?.length || ex.equipment?.length);

  const distanceLabel = useMemo(() => {
    // hack démo: si distance===1 et reps>=100 -> label = "200m"
    if (ex.distance === 1 && ex.reps && ex.reps >= 100) return `${ex.reps}m`;
    return `${ex.distance}m`;
  }, [ex.distance, ex.reps]);

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white", compact ? "p-3" : "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {ex.reps && ex.distance !== 1 ? <Pill>{ex.reps}x</Pill> : null}
          <Pill>{distanceLabel}</Pill>
        </div>

        <div className="flex items-center gap-2">
          <span className={intensityBadgeClass(ex.intensity)}>
            <span className={cn("h-2 w-2 rounded-full", intensityTone[ex.intensity])} />
            {ex.intensity}
          </span>
          {showInfo ? (
            <button
              onClick={onInfo}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Détails"
            >
              <Info className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-9 w-9" />
          )}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex-1 leading-tight">
          <div className="text-sm font-semibold tracking-tight">{strokeLabel(ex.stroke)}</div>
          <div className="mt-1 text-xs text-slate-500">
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
          <IntensityDots value={ex.intensity} />
          <div className="flex items-center gap-1 text-slate-500">
            {(ex.equipment ?? []).slice(0, 4).map((eq) => (
              <span
                key={eq}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"
                aria-label={eq}
                title={eq}
              >
                {equipIcon(eq)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {(ex.notes?.length ? ex.notes : ["—"]).join(" · ")}
      </div>
    </div>
  );
}

function BlockCard({
  block,
  blockIndex,
  onExerciseInfo,
}: {
  block: Block;
  blockIndex: number;
  onExerciseInfo: (ex: Exercise) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <Pill tone="solid">🔁 {block.blockReps}x</Pill>
          <div className="text-sm font-semibold tracking-tight">{block.title ? block.title : `Bloc ${blockIndex + 1}`}</div>
        </div>
        <Pill>
          <Layers className="h-3.5 w-3.5" /> {block.exercises.length}
        </Pill>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {block.exercises.map((ex) => (
          <ExerciseRow key={ex.id} ex={ex} onInfo={() => onExerciseInfo(ex)} />
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------
// Screens
// ---------------------------------

type ScreenKey = "sessions" | "reader" | "focus" | "settings";

function SessionsScreen({
  sessions,
  onOpen,
  onGoSettings,
}: {
  sessions: Session[];
  onOpen: (s: Session) => void;
  onGoSettings: () => void;
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
        title="Séances"
        left={<span className="text-xs text-slate-500">Nageur</span>}
        right={
          <button
            onClick={onGoSettings}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Paramètres"
          >
            <SlidersHorizontal className="h-4 w-4" />
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
            <button key={s.id} onClick={() => onOpen(s)} className="w-full text-left">
              <Card>
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
                      </div>
                    </div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>

                  {s.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.tags.map((t) => (
                        <Pill key={t}>{t}</Pill>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> {s.blocks.length} blocs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3.5 w-3.5" /> Lecture
                    </span>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

function ReaderScreen({ session, onBack, onGoFocus }: { session: Session; onBack: () => void; onGoFocus: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExercise, setSheetExercise] = useState<Exercise | null>(null);

  const openExercise = (ex: Exercise) => {
    setSheetExercise(ex);
    setSheetOpen(true);
  };

  return (
    <div>
      <TopBar
        title="Lecture"
        left={
          <button
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Retour"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        }
        right={
          <button
            onClick={onGoFocus}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            <Play className="h-4 w-4" /> Focus
          </button>
        }
      />

      <div className="px-4 py-4">
        <div className="text-lg font-semibold tracking-tight">{session.name}</div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Route className="h-3.5 w-3.5" /> {session.totalDistance}m
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" /> ~{session.estDurationMin} min
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {session.blocks.map((b, idx) => (
          <BlockCard key={b.id} block={b} blockIndex={idx} onExerciseInfo={openExercise} />
        ))}
      </div>

      <ModalSheet open={sheetOpen} title="Détails" onClose={() => setSheetOpen(false)}>
        {sheetExercise ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{strokeLabel(sheetExercise.stroke)}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Pill>
                    {sheetExercise.distance === 1 && sheetExercise.reps ? `${sheetExercise.reps}m` : `${sheetExercise.distance}m`}
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
              </div>
              <div className="pt-1">
                <IntensityDots value={sheetExercise.intensity} />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500">Modalités</div>
              <div className="mt-2 space-y-2">
                {(sheetExercise.notes?.length ? sheetExercise.notes : ["Aucune"]).map((n, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500">Équipements</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(sheetExercise.equipment?.length ? sheetExercise.equipment : []).map((eq) => (
                  <span
                    key={eq}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">{equipIcon(eq)}</span>
                    <span className="capitalize">{eq}</span>
                  </span>
                ))}
                {!sheetExercise.equipment?.length ? <div className="text-sm text-slate-500">Aucun</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </ModalSheet>

      <div className="h-6" />
    </div>
  );
}

function FocusScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const flat = useMemo(() => {
    const list: Array<{ block: Block; blockIndex: number; ex: Exercise; exIndex: number }> = [];
    session.blocks.forEach((b, bi) => {
      b.exercises.forEach((ex, ei) => list.push({ block: b, blockIndex: bi, ex, exIndex: ei }));
    });
    return list;
  }, [session]);

  const [idx, setIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = flat[idx];
  const progress = ((idx + 1) / Math.max(1, flat.length)) * 100;

  return (
    <div>
      <TopBar
        title="Focus"
        left={
          <button
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Retour"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        }
        right={
          <button
            onClick={() => setSheetOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Détails"
          >
            <Info className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-4 py-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Bloc {current.blockIndex + 1} · Exercice {current.exIndex + 1}
          </span>
          <span>
            {idx + 1}/{flat.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-900" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="px-4">
        <motion.div key={current.ex.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {current.ex.reps && current.ex.distance !== 1 ? (
                  <span className="text-3xl font-semibold tracking-tight">{current.ex.reps}×</span>
                ) : null}
                <span className="text-3xl font-semibold tracking-tight">
                  {current.ex.distance === 1 && current.ex.reps ? `${current.ex.reps}m` : `${current.ex.distance}m`}
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1",
                  "bg-white",
                  intensityTextTone[current.ex.intensity],
                  intensityRingTone[current.ex.intensity]
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", intensityTone[current.ex.intensity])} />
                {current.ex.intensity}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">{strokeLabel(current.ex.stroke)}</div>
                <div className="mt-1 text-sm text-slate-500">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                      swimTypeTone[current.ex.swimType]
                    )}
                  >
                    {current.ex.swimType}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="origin-right scale-110">
                  <IntensityDots value={current.ex.intensity} />
                </div>
                <div className="flex items-center gap-2">
                  {(current.ex.equipment ?? []).map((eq) => (
                    <span
                      key={eq}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"
                      title={eq}
                    >
                      {equipIcon(eq)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Modalités</div>
              <div className="mt-2 text-sm text-slate-800">{(current.ex.notes?.length ? current.ex.notes : ["Aucune"]).join(" · ")}</div>
            </div>
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            disabled={idx === 0}
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              idx === 0 ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <ChevronLeft className="h-4 w-4" /> Précédent
            </span>
          </button>
          <button
            onClick={() => setIdx((v) => Math.min(flat.length - 1, v + 1))}
            disabled={idx === flat.length - 1}
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              idx === flat.length - 1
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-900 bg-slate-900 text-white hover:opacity-95"
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              Suivant <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold hover:bg-slate-50"
            onClick={() => setSheetOpen(true)}
          >
            <Pause className="h-4 w-4" /> Détails
          </button>
        </div>
      </div>

      <ModalSheet open={sheetOpen} title="Détails" onClose={() => setSheetOpen(false)}>
        <div className="space-y-3">
          <div className="text-sm font-semibold">{strokeLabel(current.ex.stroke)}</div>
          <div className="flex flex-wrap gap-2">
            <Pill>
              {current.ex.distance === 1 && current.ex.reps ? `${current.ex.reps}m` : `${current.ex.distance}m`}
            </Pill>
            {current.ex.reps && current.ex.distance !== 1 ? <Pill>{current.ex.reps}x</Pill> : null}
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", swimTypeTone[current.ex.swimType])}>
              {current.ex.swimType}
            </span>
            <span className={intensityBadgeClass(current.ex.intensity)}>
              <span className={cn("h-2 w-2 rounded-full", intensityTone[current.ex.intensity])} />
              {current.ex.intensity}
            </span>
          </div>
          <div className="pt-1">
            <IntensityDots value={current.ex.intensity} />
          </div>

          <div className="mt-2">
            <div className="text-xs font-semibold text-slate-500">Modalités</div>
            <div className="mt-2 space-y-2">
              {(current.ex.notes?.length ? current.ex.notes : ["Aucune"]).map((n, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  {n}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xs font-semibold text-slate-500">Équipements</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(current.ex.equipment?.length ? current.ex.equipment : []).map((eq) => (
                <span
                  key={eq}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">{equipIcon(eq)}</span>
                  <span className="capitalize">{eq}</span>
                </span>
              ))}
              {!current.ex.equipment?.length ? <div className="text-sm text-slate-500">Aucun</div> : null}
            </div>
          </div>
        </div>
      </ModalSheet>

      <div className="h-6" />
    </div>
  );
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [poolMode, setPoolMode] = useState(true);
  const [bigText, setBigText] = useState(false);

  return (
    <div>
      <TopBar
        title="Préférences"
        left={
          <button
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

        <Card>
          <div className="p-4">
            <div className="text-sm font-semibold">Texte plus grand</div>
            <div className="mt-1 text-xs text-slate-500">Augmente légèrement les tailles en lecture.</div>
            <div className="mt-3">
              <button
                onClick={() => setBigText((v) => !v)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-sm font-semibold",
                  bigText ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                {bigText ? "Activé" : "Désactivé"}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm font-semibold">Légende</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white">
                    <Footprints className="h-4 w-4" />
                  </span>
                  Palmes
                </span>
                <Pill>Équipement</Pill>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white">
                    <Glasses className="h-4 w-4" />
                  </span>
                  Tuba
                </span>
                <Pill>Équipement</Pill>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white">
                    <Info className="h-4 w-4" />
                  </span>
                  Détails / Modalités
                </span>
                <Pill>Bottom sheet</Pill>
              </div>
            </div>
          </div>
        </Card>

        <div className="h-6" />
      </div>
    </div>
  );
}

// ---------------------------------
// Root (prototype)
// ---------------------------------

export default function SwimMockups() {
  const [screen, setScreen] = useState<ScreenKey>("sessions");
  const [activeSession, setActiveSession] = useState<Session>(demoSessions[0]);

  return (
    <PhoneFrame>
      <div className="relative">
        <AnimatePresence mode="wait">
          {screen === "sessions" && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <SessionsScreen
                sessions={demoSessions}
                onOpen={(s) => {
                  setActiveSession(s);
                  setScreen("reader");
                }}
                onGoSettings={() => setScreen("settings")}
              />
            </motion.div>
          )}

          {screen === "reader" && (
            <motion.div
              key="reader"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <ReaderScreen session={activeSession} onBack={() => setScreen("sessions")} onGoFocus={() => setScreen("focus")} />
            </motion.div>
          )}

          {screen === "focus" && (
            <motion.div
              key="focus"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <FocusScreen session={activeSession} onBack={() => setScreen("reader")} />
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
              <SettingsScreen onBack={() => setScreen("sessions")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}

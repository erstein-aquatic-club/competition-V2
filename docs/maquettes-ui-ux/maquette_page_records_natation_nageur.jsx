import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useInRouterContext,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Trophy, Dumbbell, Waves, RefreshCw, Pencil, Check, X } from "lucide-react";

/**
 * Maquette – Page Records (natation & musculation)
 *
 * ✅ Routes Natation :
 *   - /records/natation/entrainement
 *   - /records/natation/competition
 * ✅ UX anti-empilement :
 *   - Segmented principal (Natation / Musculation)
 *   - Segmented secondaire seulement sur Natation (Entraînement / Compétition)
 *   - Bassin 25m/50m via un bouton "pill" (1 tap)
 * ✅ Tableau (mobile-first, sans dépassement) :
 *   - Entraînement : Épreuve | Temps | Date (+ action)
 *   - Compétition : Épreuve | Temps | Points | Date (lecture seule)
 */

const cx = (...c: Array<string | false | null | undefined>) =>
  c.filter(Boolean).join(" ");

type SwimKind = "training" | "comp";

type SwimRowT = {
  id: string;
  epreuve: string;
  pool: "25m" | "50m";
  bestMs: number;
  // points: uniquement en compétition
  points?: number;
  date: string; // ISO
  meet?: string;
};

type StrengthRowT = {
  id: string;
  label: string;
  unit: "kg" | "reps";
  best: number;
};

export const formatTime = (ms: number | string | null | undefined) => {
  if (ms === null || ms === undefined) return "—";
  const n = typeof ms === "string" ? Number(ms) : ms;
  if (Number.isNaN(n)) return "—";

  const total = Math.max(0, Math.round(n));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centi = Math.floor((total % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
  }
  return `${seconds}.${String(centi).padStart(2, "0")}`;
};

export const toMs = (input: unknown) => {
  // accepts: "1:02.34" or "62.34" or "62" or "1:02"
  const s = String(input ?? "").trim();
  if (!s) return null;
  const m = s.match(/^((\d+):)?(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const secs = parseInt(m[3], 10);
  const centi = m[4] ? parseInt(m[4].padEnd(2, "0"), 10) : 0;
  return mins * 60000 + secs * 1000 + centi * 10;
};

const dateLabel = (iso?: string) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
};

const canEditSwim = (kind: SwimKind) => kind === "training";

type SegmentedItem<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

function Segmented<T extends string>({
  value,
  onChange,
  items,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<SegmentedItem<T>>;
  layoutId: string;
}) {
  return (
    <div className="w-full rounded-2xl bg-zinc-900/70 border border-white/10 p-1 flex">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={cx(
              "flex-1 relative rounded-xl px-3 py-2 text-sm font-semibold transition",
              active ? "text-zinc-900" : "text-zinc-200"
            )}
            aria-pressed={active}
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-white"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-2">
              {it.icon}
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sticky top-0 z-20 backdrop-blur bg-zinc-950/70 border-b border-white/10">
      <div className="px-4 pt-4 pb-3">
        <div className="text-xl font-semibold text-white tracking-tight">
          {title}
        </div>
        {subtitle ? <div className="mt-0.5 text-sm text-zinc-400">{subtitle}</div> : null}
      </div>
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-zinc-900/60 border border-white/10 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function InlineEdit({
  value,
  placeholder,
  onSave,
  onCancel,
  inputMode = "decimal",
  hint,
}: {
  value: string;
  placeholder: string;
  onSave: (draft: string) => void;
  onCancel: () => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  hint?: string;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            className="w-full rounded-xl bg-zinc-950/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            autoFocus
          />
          {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
        </div>
        <button
          onClick={() => onSave(draft)}
          className="h-10 w-10 rounded-xl bg-white text-zinc-900 flex items-center justify-center active:scale-[0.98] transition"
          aria-label="Valider"
        >
          <Check className="h-5 w-5" />
        </button>
        <button
          onClick={onCancel}
          className="h-10 w-10 rounded-xl bg-white/10 text-white flex items-center justify-center active:scale-[0.98] transition"
          aria-label="Annuler"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

const Skeleton = () => (
  <div className="animate-pulse">
    <div className="h-10 rounded-xl bg-white/10" />
  </div>
);

// Mock data
const swimTrainingSeed: SwimRowT[] = [
  { id: "tr-50fr", epreuve: "50 NL", pool: "25m", bestMs: 23830, date: "2024-11-17" },
  { id: "tr-100fr", epreuve: "100 NL", pool: "25m", bestMs: 52650, date: "2023-12-17" },
  { id: "tr-200fr", epreuve: "200 NL", pool: "25m", bestMs: 117830, date: "2015-12-19" },
  { id: "tr-50dos", epreuve: "50 Dos", pool: "25m", bestMs: 31850, date: "2017-05-07" },
];

const swimCompSeed: SwimRowT[] = [
  {
    id: "co-50fr",
    epreuve: "50 NL",
    pool: "50m",
    bestMs: 23620,
    points: 1185,
    date: "2024-03-28",
    meet: "France Élite",
  },
  {
    id: "co-100fr",
    epreuve: "100 NL",
    pool: "50m",
    bestMs: 51450,
    points: 1167,
    date: "2024-03-29",
    meet: "France Élite",
  },
  {
    id: "co-200fr",
    epreuve: "200 NL",
    pool: "50m",
    bestMs: 113420,
    points: 1158,
    date: "2024-03-30",
    meet: "France Élite",
  },
  {
    id: "co-400fr",
    epreuve: "400 NL",
    pool: "50m",
    bestMs: 240520,
    points: 736,
    date: "2024-03-31",
    meet: "France Élite",
  },
];

const strengthSeed: StrengthRowT[] = [
  { id: "sq", label: "Squat", unit: "kg", best: 120 },
  { id: "bp", label: "Développé couché", unit: "kg", best: 90 },
  { id: "dl", label: "Soulevé de terre", unit: "kg", best: 150 },
  { id: "ohp", label: "Développé militaire", unit: "kg", best: 60 },
  { id: "pu", label: "Tractions", unit: "reps", best: 12 },
];

// ----------------------------
// Routing helpers
// ----------------------------
export function inferTabFromPath(pathname: string): "natation" | "musculation" {
  return pathname.includes("/musculation") ? "musculation" : "natation";
}

export function inferSwimPageFromPath(pathname: string): SwimKind {
  return pathname.includes("/competition") ? "comp" : "training";
}

function SwimTable({
  kind,
  rows,
  editingId,
  onEdit,
  onCancelEdit,
  onSaveEdit,
}: {
  kind: SwimKind;
  rows: SwimRowT[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, draft: string) => void;
}) {
  const editable = canEditSwim(kind);
  const showPoints = kind === "comp";

  // Columns are fixed to prevent overflow; epreuve uses minmax for truncation.
  const colsTraining = "grid-cols-[minmax(0,1fr)_4.75rem_4.75rem_2.5rem]"; // Épreuve | Temps | Date | Action
  const colsComp = "grid-cols-[minmax(0,1fr)_4.75rem_3.75rem_4.75rem]"; // Épreuve | Temps | Pts | Date
  const cols = editable ? colsTraining : colsComp;

  const Header = () => {
    return (
      <div className={cx("grid items-center gap-3", cols)}>
        <div className="truncate justify-self-start">Épreuve</div>
        <div className="whitespace-nowrap justify-self-end">Temps</div>
        {showPoints ? (
          <div className="whitespace-nowrap justify-self-end">Pts</div>
        ) : (
          <div className="whitespace-nowrap justify-self-end">Date</div>
        )}
        {showPoints ? (
          <div className="whitespace-nowrap justify-self-end">Date</div>
        ) : editable ? (
          <div className="sr-only">Actions</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="px-4 py-2 text-[11px] text-zinc-400 border-b border-white/10">
        <Header />
      </div>

      <div className="divide-y divide-white/10">
        {rows.map((r) => {
          const isEditing = editingId === r.id;

          return (
            <div key={r.id} className="px-4 py-3">
              <div className={cx("grid items-center gap-3", cols)}>
                <div className="min-w-0 justify-self-start">
                  <div className="text-sm font-semibold text-white truncate">{r.epreuve}</div>
                </div>

                <div className="justify-self-end text-sm font-semibold tabular-nums text-white whitespace-nowrap overflow-hidden">
                  {formatTime(r.bestMs)}
                </div>

                {showPoints ? (
                  <div className="justify-self-end text-sm tabular-nums text-zinc-200 whitespace-nowrap overflow-hidden">
                    {r.points ?? "—"}
                  </div>
                ) : (
                  <div className="justify-self-end text-sm tabular-nums text-zinc-300 whitespace-nowrap overflow-hidden">
                    {dateLabel(r.date)}
                  </div>
                )}

                {showPoints ? (
                  <div className="justify-self-end text-sm tabular-nums text-zinc-300 whitespace-nowrap overflow-hidden">
                    {dateLabel(r.date)}
                  </div>
                ) : editable ? (
                  <button
                    onClick={() => onEdit(r.id)}
                    className="justify-self-end inline-flex items-center justify-center h-9 w-9 rounded-xl bg-transparent text-zinc-400 hover:text-white hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/15"
                    aria-label={`Modifier ${r.epreuve}`}
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {kind === "comp" && r.meet ? (
                <div className="mt-1 text-xs text-zinc-500 truncate">{r.meet}</div>
              ) : null}

              <AnimatePresence>
                {editable && isEditing ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <InlineEdit
                      value={formatTime(r.bestMs)}
                      placeholder="Ex: 1:02.34"
                      inputMode="text"
                      hint="Format: mm:ss.cc ou ss.cc"
                      onCancel={onCancelEdit}
                      onSave={(draft) => onSaveEdit(r.id, draft)}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecordsShell({ active }: { active: "natation" | "musculation" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [poolLen, setPoolLen] = useState<"25m" | "50m">("25m");
  const [swimTraining, setSwimTraining] = useState<SwimRowT[]>(swimTrainingSeed);
  const [swimComp, setSwimComp] = useState<SwimRowT[]>(swimCompSeed);
  const [strength, setStrength] = useState<StrengthRowT[]>(strengthSeed);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const swimPage = inferSwimPageFromPath(location.pathname);

  const trainingRows = useMemo(
    () => swimTraining.filter((r) => r.pool === poolLen),
    [swimTraining, poolLen]
  );
  const compRows = useMemo(
    () => swimComp.filter((r) => r.pool === poolLen),
    [swimComp, poolLen]
  );
  const activeSwimRows = swimPage === "training" ? trainingRows : compRows;

  const refreshCompetition = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 900));

    setSwimComp((prev) =>
      prev.map((row, idx) => {
        if (idx === 0) return { ...row, bestMs: Math.max(0, row.bestMs - 120), date: "2024-04-01" };
        if (idx === 1) return { ...row, date: "2024-04-01" };
        return row;
      })
    );

    setSyncing(false);
  };

  const saveStrength = (id: string, draft: string) => {
    const n = String(draft || "").trim();
    if (!n) {
      setEditingId(null);
      return;
    }
    const val = Number(n.replace(",", "."));
    if (Number.isNaN(val)) return;
    setStrength((prev) => prev.map((e) => (e.id === id ? { ...e, best: val } : e)));
    setEditingId(null);
  };

  const saveSwimTraining = (id: string, draft: string) => {
    const ms = toMs(draft);
    if (ms == null) return;
    const today = new Date().toISOString().slice(0, 10);
    setSwimTraining((prev) => prev.map((r) => (r.id === id ? { ...r, bestMs: ms, date: today } : r)));
    setEditingId(null);
  };

  const PoolPillButton = () => (
    <button
      onClick={() => {
        setPoolLen((p) => (p === "25m" ? "50m" : "25m"));
        setEditingId(null);
      }}
      className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm font-semibold text-white active:scale-[0.99] transition"
      aria-label="Changer le bassin"
      title="Appuie pour basculer 25m / 50m"
    >
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-xl bg-white/10">
        <Waves className="h-4 w-4" />
      </span>
      <span className="tabular-nums">{poolLen}</span>
    </button>
  );

  const SwimHeader = () => (
    <div className="px-4 mt-5 mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          {swimPage === "training" ? (
            <Trophy className="h-5 w-5 text-white" />
          ) : (
            <Waves className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="text-sm font-semibold text-white">
          {swimPage === "training" ? "Records entraînement" : "Records compétition"}
        </div>
      </div>

      {swimPage === "comp" ? (
        <button
          onClick={refreshCompetition}
          disabled={syncing}
          className={cx(
            "inline-flex items-center gap-2 text-sm px-3 py-2 rounded-2xl border",
            syncing
              ? "border-white/10 bg-white/5 text-zinc-400"
              : "border-white/10 bg-white/5 text-zinc-200 hover:text-white hover:bg-white/10"
          )}
        >
          <RefreshCw className={cx("h-4 w-4", syncing && "animate-spin")} />
          Actualiser
        </button>
      ) : null}
    </div>
  );

  const goTab = (next: "natation" | "musculation") => {
    setEditingId(null);
    if (next === "musculation") {
      navigate("/records/musculation");
      return;
    }
    navigate(
      swimPage === "comp"
        ? "/records/natation/competition"
        : "/records/natation/entrainement"
    );
  };

  const goSwimPage = (next: SwimKind) => {
    setEditingId(null);
    navigate(
      next === "comp"
        ? "/records/natation/competition"
        : "/records/natation/entrainement"
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-md">
        <TopBar title="Records" subtitle="Natation & 1RM musculation" />

        <div className="px-4 pt-3">
          <Segmented
            value={active}
            onChange={goTab}
            items={[
              {
                value: "natation",
                label: "Natation",
                icon: <Waves className="h-4 w-4" />,
              },
              {
                value: "musculation",
                label: "Musculation",
                icon: <Dumbbell className="h-4 w-4" />,
              },
            ]}
            layoutId="seg-main"
          />

          {active === "natation" ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1">
                <Segmented
                  value={swimPage}
                  onChange={goSwimPage}
                  items={[
                    {
                      value: "training",
                      label: "Entraînement",
                      icon: <Trophy className="h-4 w-4" />,
                    },
                    {
                      value: "comp",
                      label: "Compétition",
                      icon: <Waves className="h-4 w-4" />,
                    },
                  ]}
                  layoutId="seg-swim"
                />
              </div>
              <PoolPillButton />
            </div>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {active === "natation" ? (
            <motion.div
              key={`nat-${swimPage}-${poolLen}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <SwimHeader />

              {swimPage === "comp" ? (
                <div className="px-4 -mt-1 mb-2 text-xs text-zinc-500">
                  Records fédération (lecture seule). Tu peux uniquement actualiser.
                </div>
              ) : null}

              <Card className="mx-4 overflow-hidden">
                {swimPage === "comp" && syncing ? (
                  <div className="p-4 grid gap-3">
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                  </div>
                ) : activeSwimRows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-zinc-400">
                    Aucun record en bassin {poolLen}.
                  </div>
                ) : (
                  <SwimTable
                    kind={swimPage}
                    rows={activeSwimRows}
                    editingId={editingId}
                    onEdit={(id) => setEditingId(id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={(id, draft) => saveSwimTraining(id, draft)}
                  />
                )}
              </Card>

              <div className="h-10" />
            </motion.div>
          ) : (
            <motion.div
              key="mus"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="px-4 mt-5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Dumbbell className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    1RM musculation
                  </div>
                </div>
              </div>

              <Card className="mx-4 overflow-hidden">
                <div className="divide-y divide-white/10">
                  {strength.map((e) => (
                    <div key={e.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {e.label}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-400">
                            Valeur de référence
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-semibold tabular-nums whitespace-nowrap">
                            {typeof e.best === "number"
                              ? `${e.best}${e.unit === "kg" ? " kg" : ""}`
                              : "—"}
                          </div>
                          <button
                            onClick={() => setEditingId(e.id)}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {editingId === e.id ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 overflow-hidden"
                          >
                            <InlineEdit
                              value={typeof e.best === "number" ? String(e.best) : ""}
                              placeholder={e.unit === "kg" ? "Ex: 100" : "Ex: 12"}
                              inputMode="decimal"
                              hint={
                                e.unit === "kg"
                                  ? "Charge max (kg)."
                                  : "Max de répétitions."
                              }
                              onCancel={() => setEditingId(null)}
                              onSave={(draft) => saveStrength(e.id, draft)}
                            />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="h-10" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pb-10" />
      </div>
    </div>
  );
}

/**
 * Component to be mounted at /records/*
 * Must be rendered under a Router.
 */
export function RecordsRoutes() {
  const location = useLocation();
  const tab = inferTabFromPath(location.pathname);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="natation/entrainement" replace />} />
      <Route path="natation/entrainement" element={<RecordsShell active="natation" />} />
      <Route path="natation/competition" element={<RecordsShell active="natation" />} />
      <Route path="musculation" element={<RecordsShell active="musculation" />} />
      <Route
        path="*"
        element={
          <Navigate
            to={tab === "musculation" ? "musculation" : "natation/entrainement"}
            replace
          />
        }
      />
    </Routes>
  );
}

/**
 * Safe default export:
 * - If a Router exists, render <RecordsRoutes />.
 * - Otherwise (Canvas / isolated render), wrap in a MemoryRouter.
 */
export default function RecordsEntry() {
  const inRouter = useInRouterContext();

  if (inRouter) return <RecordsRoutes />;

  return (
    <MemoryRouter initialEntries={["/records/natation/entrainement"]}>
      <Routes>
        <Route path="/records/*" element={<RecordsRoutes />} />
        <Route path="*" element={<Navigate to="/records/natation/entrainement" replace />} />
      </Routes>
    </MemoryRouter>
  );
}

// ----------------------------
// Minimal self-tests (dev-only)
// ----------------------------
const __DEV__ =
  typeof import.meta !== "undefined" &&
  // @ts-ignore - Vite injects import.meta.env
  import.meta.env &&
  // @ts-ignore
  import.meta.env.MODE === "development";

function assert(name: string, condition: boolean) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error(`❌ ${name}`);
    throw new Error(`Test failed: ${name}`);
  }
  // eslint-disable-next-line no-console
  console.log(`✅ ${name}`);
}

if (__DEV__) {
  // time parsing/formatting tests
  assert("toMs parses seconds", toMs("27.99") === 27990);
  assert("toMs parses minutes", toMs("1:02.34") === 62340);
  assert("toMs parses whole seconds", toMs("27") === 27000);
  assert("toMs parses mm:ss", toMs("1:02") === 62000);
  assert("toMs rejects invalid", toMs("abc") === null);

  assert("formatTime renders minutes", formatTime(62340) === "1:02.34");
  assert("formatTime renders seconds", formatTime(27990) === "27.99");
  assert("formatTime handles null", formatTime(null) === "—");
  assert("formatTime handles NaN", formatTime("nope") === "—");
  assert("formatTime clamps negatives", formatTime(-10) === "0.00");

  // date formatting tests
  assert("dateLabel short format", dateLabel("2024-11-17") === "17/11/24");

  // routing helper tests
  assert(
    "inferTabFromPath natation",
    inferTabFromPath("/records/natation/entrainement") === "natation"
  );
  assert(
    "inferTabFromPath musculation",
    inferTabFromPath("/records/musculation") === "musculation"
  );
  assert(
    "inferSwimPageFromPath training",
    inferSwimPageFromPath("/records/natation/entrainement") === "training"
  );
  assert(
    "inferSwimPageFromPath comp",
    inferSwimPageFromPath("/records/natation/competition") === "comp"
  );
  assert(
    "inferSwimPageFromPath default training",
    inferSwimPageFromPath("/records/natation") === "training"
  );

  // edit permissions
  assert("canEditSwim training", canEditSwim("training") === true);
  assert("canEditSwim comp", canEditSwim("comp") === false);
}

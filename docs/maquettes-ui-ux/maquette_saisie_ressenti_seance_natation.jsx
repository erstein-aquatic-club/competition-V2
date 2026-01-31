import React, { useEffect, useMemo, useRef, useState } from "react";

// Ultra-rapide : confirmer > ajuster. Mobile strict-first.
// Flat design : pas d’emojis/illustrations.
// Homogénéité : chaque sheet a un bouton "Valider".

type Slot = "MATIN" | "SOIR";

type Toast = { open: boolean; msg: string };

type Sheet = null | "date" | "slot" | "duration" | "distance";

type ScaleTone = "hard" | "good" | "fatigue";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const pad2 = (n: number) => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${pad2(m)}`;
};

const formatMeters = (m: number) => {
  const s = new Intl.NumberFormat("fr-FR").format(m);
  // iOS/Safari peuvent insérer des espaces insécables (fine ou normale)
  const thinNbsp = String.fromCharCode(0x202f);
  const nbsp = String.fromCharCode(0x00a0);
  return s.replaceAll(thinNbsp, " ").replaceAll(nbsp, " ") + " m";
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function useLocalState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState] as const;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight">Saisie séance</div>
            <div className="text-[11px] text-slate-500">Ultra-rapide • 15–20s</div>
          </div>
          <div className="text-[11px] font-extrabold text-slate-500">Pouce-only</div>
        </div>
      </div>
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}

function MiniBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-black text-slate-700">
      {children}
    </span>
  );
}

function Tile({
  label,
  value,
  badge,
  onClick,
}: {
  label: string;
  value: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-extrabold text-slate-500">{label}</div>
        <MiniBadge>{badge}</MiniBadge>
      </div>
      <div className="mt-2 text-base font-black tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] font-extrabold text-slate-400">Tap pour modifier</div>
    </button>
  );
}

function BottomSheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Fermer"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-800">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700"
          >
            Fermer
          </button>
        </div>
        {children}
        <div className="pointer-events-none mx-auto mt-3 h-1.5 w-14 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function QuickGrid({
  options,
  value,
  onPick,
}: {
  options: Array<{ label: string; value: number }>;
  value: number;
  onPick: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            className={cx(
              "h-12 rounded-2xl border text-sm font-black active:scale-[0.99]",
              active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"
            )}
            aria-pressed={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FlatScale({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  tone: ScaleTone;
}) {
  const activeHard = [
    "bg-slate-100 border-slate-300",
    "bg-yellow-100 border-yellow-300",
    "bg-orange-200 border-orange-300",
    "bg-red-300 border-red-400",
    "bg-red-600 border-red-700 text-white",
  ];
  const activeGood = [
    "bg-slate-100 border-slate-300",
    "bg-emerald-100 border-emerald-300",
    "bg-emerald-200 border-emerald-300",
    "bg-emerald-300 border-emerald-400",
    "bg-emerald-600 border-emerald-700 text-white",
  ];
  // Fatigue : 1/2 bleu/vert (peu fatigué), puis vers le rouge (très fatigué)
  const activeFatigue = [
    "bg-sky-100 border-sky-300",
    "bg-emerald-100 border-emerald-300",
    "bg-yellow-100 border-yellow-300",
    "bg-orange-200 border-orange-300",
    "bg-red-600 border-red-700 text-white",
  ];

  const palette = tone === "hard" ? activeHard : tone === "good" ? activeGood : activeFatigue;

  return (
    <div className="space-y-2">
      <div className="text-sm font-bold text-slate-800">{label}</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => {
          const active = i === value;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={cx(
                "flex-1 h-10 rounded-xl border text-sm font-black active:scale-[0.99]",
                active ? palette[i - 1] : "bg-white border-slate-200"
              )}
              aria-pressed={active}
              aria-label={`${label} ${i}/5`}
              title={`${label} ${i}/5`}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  if (!toast.open) return null;
  return (
    <div className="fixed inset-x-0 top-14 z-30 mx-auto max-w-md px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-800">{toast.msg}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function runSelfTestsOnce() {
  // Micro-tests sans framework : évite les régressions évidentes.
  try {
    console.assert(clamp(5, 0, 10) === 5, "clamp basic");
    console.assert(clamp(-1, 0, 10) === 0, "clamp min");
    console.assert(clamp(999, 0, 10) === 10, "clamp max");

    console.assert(formatDuration(120) === "2 h 00", "formatDuration 2h");
    console.assert(formatDuration(75) === "1 h 15", "formatDuration 1h15");

    console.assert(formatMeters(100).includes("m"), "formatMeters suffix");
    console.assert(formatMeters(0) === "0 m", "formatMeters zero");

    const re = new RegExp("^\\d{4}-\\d{2}-\\d{2}$");
    console.assert(re.test(todayISO()), "todayISO format");
    console.assert(re.test(addDaysISO(-1)), "addDaysISO format");
  } catch {
    // ignore
  }
}

export default function App() {
  useEffect(() => {
    runSelfTestsOnce();
  }, []);

  // Persistant pour vitesse
  const [slot, setSlot] = useLocalState<Slot>("swim.slot", "SOIR");
  const [distance, setDistance] = useLocalState<number>("swim.distance", 3500);
  const [duration, setDuration] = useLocalState<number>("swim.duration", 120);

  // Date (par saisie)
  const [date, setDate] = useState(todayISO());

  // Ressenti (par séance)
  const [difficulty, setDifficulty] = useState(3);
  const [fatigue, setFatigue] = useState(3);
  const [performance, setPerformance] = useState(3);
  const [engagement, setEngagement] = useState(3);

  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");

  // Sheets + drafts (Valider)
  const [sheet, setSheet] = useState<Sheet>(null);
  const [slotDraft, setSlotDraft] = useState<Slot>(slot);
  const [durationDraft, setDurationDraft] = useState<number>(duration);
  const [distanceDraft, setDistanceDraft] = useState<number>(distance);

  // Toast
  const [toast, setToast] = useState<Toast>({ open: false, msg: "" });
  const toastTimer = useRef<number | null>(null);

  const openToast = (msg: string) => {
    setToast({ open: true, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast({ open: false, msg: "" }), 1600);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const openSheet = (s: Exclude<Sheet, null>) => {
    if (s === "slot") setSlotDraft(slot);
    if (s === "duration") setDurationDraft(duration);
    if (s === "distance") setDistanceDraft(distance);
    setSheet(s);
  };

  // (conservé en mémoire pour éventuel retour futur dans l’UI)
  const summary = useMemo(() => {
    const slotLabel = slot === "MATIN" ? "Matin" : "Soir";
    return `${date} • ${slotLabel} • ${formatMeters(distance)} • ${formatDuration(duration)}`;
  }, [date, slot, distance, duration]);
  void summary;

  const payload = useMemo(
    () => ({
      date,
      slot,
      distance_m: distance,
      duration_min: duration,
      difficulty_1_5: difficulty,
      fatigue_1_5: fatigue,
      performance_1_5: performance,
      engagement_1_5: engagement,
      comment,
    }),
    [date, slot, distance, duration, difficulty, fatigue, performance, engagement, comment]
  );

  const isValid =
    !!date &&
    (slot === "MATIN" || slot === "SOIR") &&
    distance >= 0 &&
    distance <= 10000 &&
    distance % 100 === 0 &&
    duration >= 30 &&
    duration <= 240 &&
    duration % 15 === 0;

  const save = () => {
    if (!isValid) return;

    // Proposer un commentaire si séance "dure" (sans bloquer)
    const hard = difficulty >= 4 || fatigue >= 4;
    if (hard && !commentOpen && comment.trim().length === 0) {
      setCommentOpen(true);
      openToast("Ajoute un mot ? (optionnel)");
      return;
    }

    // Mock submit
    // eslint-disable-next-line no-console
    console.log("SUBMIT", payload);
    openToast("Séance enregistrée");

    // Reset rapide
    setDate(todayISO());
    setDifficulty(3);
    setFatigue(3);
    setPerformance(3);
    setEngagement(3);
    setComment("");
    setCommentOpen(false);
  };

  return (
    <Shell>
      <Toast toast={toast} onClose={() => setToast({ open: false, msg: "" })} />

      <Card>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ressenti de la séance</h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Tile
              label="Date"
              value={date === todayISO() ? "Aujourd’hui" : date}
              badge="D"
              onClick={() => openSheet("date")}
            />
            <Tile
              label="Créneau"
              value={slot === "MATIN" ? "Matin" : "Soir"}
              badge="C"
              onClick={() => openSheet("slot")}
            />
            <Tile label="Distance" value={formatMeters(distance)} badge="m" onClick={() => openSheet("distance")} />
            <Tile label="Durée" value={formatDuration(duration)} badge="h" onClick={() => openSheet("duration")} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-extrabold tracking-tight text-slate-800">Ressenti</div>
              <div className="text-[11px] font-extrabold text-slate-500">4 taps</div>
            </div>

            <div className="space-y-4">
              <FlatScale label="Difficulté" value={difficulty} onChange={setDifficulty} tone="hard" />
              <FlatScale
                label="Fatigue en fin de séance"
                value={fatigue}
                onChange={setFatigue}
                tone="fatigue"
              />
              <FlatScale
                label="Performance perçue"
                value={performance}
                onChange={setPerformance}
                tone="good"
              />
              <FlatScale label="Engagement" value={engagement} onChange={setEngagement} tone="good" />
            </div>

            <div className="mt-4">
              {!commentOpen ? (
                <button
                  type="button"
                  onClick={() => setCommentOpen(true)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800"
                >
                  Ajouter un commentaire (optionnel)
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-800">Commentaire</div>
                    <button
                      type="button"
                      onClick={() => {
                        setCommentOpen(false);
                        setComment("");
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700"
                    >
                      Fermer
                    </button>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="1 phrase max (ex : épaules OK, jambes lourdes au bloc 3…)"
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <button
            type="button"
            disabled={!isValid}
            onClick={save}
            className={cx(
              "w-full rounded-2xl px-4 py-3 text-sm font-black tracking-tight",
              isValid ? "bg-slate-900 text-white" : "cursor-not-allowed bg-slate-200 text-slate-500"
            )}
          >
            Enregistrer
          </button>
          <div className="mt-2 text-center text-[11px] text-slate-500">
            Astuce : Créneau/Distance/Durée sont mémorisés.
          </div>
        </div>
      </div>

      {/* SHEETS */}
      <BottomSheet open={sheet === "date"} title="Date" onClose={() => setSheet(null)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black active:scale-[0.99]"
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={() => setDate(addDaysISO(-1))}
              className="h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black active:scale-[0.99]"
            >
              Hier
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-extrabold text-slate-500">Choisir</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setSheet(null);
              openToast("Date mise à jour");
            }}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white active:scale-[0.99]"
          >
            Valider
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "slot"} title="Créneau" onClose={() => setSheet(null)}>
        <div className="space-y-3">
          <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {([
              { value: "MATIN", label: "Matin" },
              { value: "SOIR", label: "Soir" },
            ] as const).map((o) => {
              const active = o.value === slotDraft;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSlotDraft(o.value)}
                  className={cx(
                    "flex-1 rounded-xl px-3 py-3 text-sm font-black",
                    active ? "bg-slate-900 text-white" : "text-slate-700"
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setSlot(slotDraft);
              setSheet(null);
              openToast("Créneau mis à jour");
            }}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white active:scale-[0.99]"
          >
            Valider
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "duration"} title="Durée" onClose={() => setSheet(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-extrabold text-slate-500">Sélection</div>
            <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{formatDuration(durationDraft)}</div>
            <div className="mt-1 text-[11px] text-slate-500">Choisis une durée (pas 15 min)</div>
          </div>

          <QuickGrid
            value={durationDraft}
            onPick={setDurationDraft}
            options={[
              { label: "1 h", value: 60 },
              { label: "1 h 15", value: 75 },
              { label: "1 h 30", value: 90 },
              { label: "1 h 45", value: 105 },
              { label: "2 h", value: 120 },
              { label: "2 h 15", value: 135 },
              { label: "2 h 30", value: 150 },
              { label: "2 h 45", value: 165 },
              { label: "3 h", value: 180 },
            ]}
          />

          <button
            type="button"
            onClick={() => {
              setDuration(durationDraft);
              setSheet(null);
              openToast("Durée mise à jour");
            }}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white active:scale-[0.99]"
          >
            Valider
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "distance"} title="Distance" onClose={() => setSheet(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-extrabold text-slate-500">Sélection</div>
            <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{formatMeters(distanceDraft)}</div>
            <div className="mt-1 text-[11px] text-slate-500">Glisse pour ajuster (pas 100 m)</div>
          </div>

          <input
            type="range"
            min={0}
            max={10000}
            step={100}
            value={distanceDraft}
            onChange={(e) => setDistanceDraft(Number(e.target.value))}
            className="w-full"
            aria-label="Distance"
          />

          <button
            type="button"
            onClick={() => {
              setDistance(distanceDraft);
              setSheet(null);
              openToast("Distance mise à jour");
            }}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white active:scale-[0.99]"
          >
            Valider
          </button>
        </div>
      </BottomSheet>
    </Shell>
  );
}

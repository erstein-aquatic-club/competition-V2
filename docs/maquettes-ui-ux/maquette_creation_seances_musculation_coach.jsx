import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Maquette — Création & Lecture séances musculation (mobile-first)
 * Design premium, dense, ultra lisible en salle.
 * Single-file runnable (index.tsx) for Vite + React.
 *
 * ✅ Rôle connu via authentification : cette maquette est en mode COACH.
 * ✅ Vue par défaut = Bibliothèque. Navigation : Bibliothèque → Éditeur.
 * ✅ Boutons sur chaque carte en bibliothèque : Modifier + Dupliquer.
 * ✅ Dans l’éditeur, bouton « Fermer » retourne à la bibliothèque.
 */

type Cycle = "endurance" | "hypertrophy" | "strength";

type ExerciseDefaults = {
  reps: number;
  sets: number;
  percent1RM: number;
  rest: number; // seconds
};

type ExerciseDBItem = {
  id: string;
  name: string;
  muscleGroup: string;
  defaults: Record<Cycle, ExerciseDefaults>;
};

type WorkoutSection = {
  id: string;
  title: string;
};

type WorkoutExercise = {
  id: string; // instance id
  sectionId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  isTouched: {
    sets?: boolean;
    reps?: boolean;
    percent1RM?: boolean;
    rest?: boolean;
  };
  sets: number;
  reps: number;
  percent1RM: number;
  rest: number;
};

type View = "condensed" | "detail";

type WorkoutMeta = {
  title: string;
  athleteName: string;
  cycle: Cycle; // internal only (invisible dans l’UI coach)
  dateLabel: string;
};

type LibraryItem = {
  id: string;
  title: string;
  athleteName: string;
  createdAt: number;
  updatedAt: number;
  /**
   * ✅ Source de vérité = ordre global des exercices.
   * On ne stocke PAS les sections (ni leur ordre).
   */
  items: WorkoutExercise[];
  /**
   * UI-only : titres de sections (facultatif). Permet de réafficher des noms.
   * Si ton backend n’en veut pas, tu peux le supprimer.
   */
  sectionTitles: Record<string, string>;
};

// -------------------------
// Mock DB
// -------------------------

const ExerciseDB: ExerciseDBItem[] = [
  {
    id: "bench_press",
    name: "Développé couché",
    muscleGroup: "Pectoraux",
    defaults: {
      endurance: { sets: 3, reps: 15, percent1RM: 55, rest: 60 },
      hypertrophy: { sets: 4, reps: 10, percent1RM: 70, rest: 90 },
      strength: { sets: 5, reps: 5, percent1RM: 85, rest: 150 },
    },
  },
  {
    id: "back_squat",
    name: "Squat arrière",
    muscleGroup: "Jambes",
    defaults: {
      endurance: { sets: 3, reps: 15, percent1RM: 55, rest: 75 },
      hypertrophy: { sets: 4, reps: 10, percent1RM: 70, rest: 120 },
      strength: { sets: 5, reps: 4, percent1RM: 88, rest: 180 },
    },
  },
  {
    id: "deadlift",
    name: "Soulevé de terre",
    muscleGroup: "Dos / Ischios",
    defaults: {
      endurance: { sets: 3, reps: 12, percent1RM: 60, rest: 90 },
      hypertrophy: { sets: 4, reps: 8, percent1RM: 75, rest: 150 },
      strength: { sets: 5, reps: 3, percent1RM: 90, rest: 210 },
    },
  },
  {
    id: "pull_up",
    name: "Tractions",
    muscleGroup: "Dos",
    defaults: {
      endurance: { sets: 4, reps: 10, percent1RM: 0, rest: 60 },
      hypertrophy: { sets: 4, reps: 8, percent1RM: 0, rest: 90 },
      strength: { sets: 6, reps: 4, percent1RM: 0, rest: 150 },
    },
  },
  {
    id: "overhead_press",
    name: "Développé militaire",
    muscleGroup: "Épaules",
    defaults: {
      endurance: { sets: 3, reps: 15, percent1RM: 50, rest: 60 },
      hypertrophy: { sets: 4, reps: 10, percent1RM: 67, rest: 90 },
      strength: { sets: 5, reps: 5, percent1RM: 82, rest: 150 },
    },
  },
  {
    id: "rowing",
    name: "Rowing barre",
    muscleGroup: "Dos",
    defaults: {
      endurance: { sets: 3, reps: 15, percent1RM: 55, rest: 60 },
      hypertrophy: { sets: 4, reps: 10, percent1RM: 70, rest: 90 },
      strength: { sets: 5, reps: 5, percent1RM: 85, rest: 150 },
    },
  },
];

// -------------------------
// Tiny utils
// -------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatRest(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m${String(r).padStart(2, "0")}` : `${m}m`;
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function getDefaultsFor(exerciseId: string, cycle: Cycle): ExerciseDefaults {
  const found = ExerciseDB.find((e) => e.id === exerciseId);
  return (
    found?.defaults?.[cycle] ?? {
      sets: 3,
      reps: 10,
      percent1RM: 70,
      rest: 90,
    }
  );
}

function percentTone(p: number): "neutral" | "accent" | "success" | "danger" {
  if (p >= 90) return "danger";
  if (p >= 80) return "accent";
  if (p >= 65) return "success";
  return "neutral";
}

// -------------------------
// Sections = UI-only
// Ordre dérivé de l’ordre global des items (première apparition de sectionId)
// -------------------------

function deriveSectionsFromItems(items: WorkoutExercise[], sectionTitles: Record<string, string>): WorkoutSection[] {
  const seen = new Set<string>();
  const out: WorkoutSection[] = [];

  for (const it of items) {
    if (seen.has(it.sectionId)) continue;
    seen.add(it.sectionId);
    out.push({ id: it.sectionId, title: sectionTitles[it.sectionId] ?? "Section" });
  }

  // sections "vides" (titre défini sans exercices) à la fin
  for (const id of Object.keys(sectionTitles)) {
    if (seen.has(id)) continue;
    out.push({ id, title: sectionTitles[id] });
  }

  return out;
}

function buildSectionItems(items: WorkoutExercise[], sections: WorkoutSection[]) {
  const map = new Map<string, WorkoutExercise[]>();
  for (const s of sections) map.set(s.id, []);
  for (const it of items) {
    if (!map.has(it.sectionId)) map.set(it.sectionId, []);
    map.get(it.sectionId)!.push(it);
  }
  return map;
}

// Déplacer une section = déplacer le bloc d’exercices (ordre global).
// IMPORTANT: on ne déplace que les sections non vides.
function moveSectionBlock(items: WorkoutExercise[], sectionId: string, dir: -1 | 1, sectionTitles: Record<string, string>) {
  const nonEmptySections = deriveSectionsFromItems(items, sectionTitles).filter((s) => items.some((it) => it.sectionId === s.id));
  const i = nonEmptySections.findIndex((s) => s.id === sectionId);
  if (i < 0) return items;
  const j = i + dir;
  if (j < 0 || j >= nonEmptySections.length) return items;

  const neighborId = nonEmptySections[j].id;
  const block = items.filter((it) => it.sectionId === sectionId);
  if (block.length === 0) return items;

  const remaining = items.filter((it) => it.sectionId !== sectionId);

  const neighborIdxs = remaining
    .map((it, idx) => (it.sectionId === neighborId ? idx : -1))
    .filter((x) => x >= 0);

  const insertAt =
    neighborIdxs.length === 0
      ? dir === -1
        ? 0
        : remaining.length
      : dir === -1
        ? neighborIdxs[0]
        : neighborIdxs[neighborIdxs.length - 1] + 1;

  return [...remaining.slice(0, insertAt), ...block, ...remaining.slice(insertAt)];
}

// -------------------------
// Minimal self-tests (dev-friendly, no framework)
// -------------------------

function runSelfTests() {
  console.assert(formatRest(30) === "30s", "formatRest <60s");
  console.assert(formatRest(60) === "1m", "formatRest 60s");
  console.assert(formatRest(90) === "1m30", "formatRest 90s");
  console.assert(clamp(5, 0, 3) === 3, "clamp upper");
  console.assert(clamp(-1, 0, 3) === 0, "clamp lower");

  const d = getDefaultsFor("bench_press", "hypertrophy");
  console.assert(d.sets > 0 && d.reps > 0, "defaults exist");

  console.assert(percentTone(92) === "danger", "percentTone danger");
  console.assert(percentTone(80) === "accent", "percentTone accent");

  const secs = deriveSectionsFromItems(
    [
      { id: "a", sectionId: "B", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 },
      { id: "b", sectionId: "A", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 },
      { id: "c", sectionId: "B", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 },
    ],
    { A: "A", B: "B" }
  );
  console.assert(secs[0].id === "B" && secs[1].id === "A", "deriveSectionsFromItems follows first appearance");

  const moved = moveSectionBlock(
    [
      { id: "a", sectionId: "A", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 },
      { id: "b", sectionId: "A", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 },
      { id: "c", sectionId: "B", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 },
    ],
    "B",
    -1,
    { A: "A", B: "B" }
  );
  console.assert(moved[0].sectionId === "B", "moveSectionBlock moves section as a block");

  // New tests: derive should include titled empty sections at end
  const secs2 = deriveSectionsFromItems(
    [{ id: "a", sectionId: "A", exerciseId: "x", name: "x", muscleGroup: "m", isTouched: {}, sets: 1, reps: 1, percent1RM: 0, rest: 0 }],
    { A: "A", Z: "Z" }
  );
  console.assert(secs2.map((s) => s.id).join(",") === "A,Z", "derive includes empty titled sections");

  // New tests: percentTone base
  console.assert(percentTone(64) === "neutral", "percentTone neutral");
}
runSelfTests();

// -------------------------
// Reusable UI Components
// -------------------------

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.page}>
      <div style={styles.safeTop} />
      <div style={styles.container}>{children}</div>
      <div style={styles.safeBottom} />
    </div>
  );
}

function TopBar({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={styles.topBar}>
      <div style={styles.topBarSide}>{left}</div>
      <div style={styles.topBarTitle} title={title}>
        {title}
      </div>
      <div style={{ ...styles.topBarSide, justifyContent: "flex-end" }}>{right}</div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...styles.card, ...(style ?? {}) }}>
      <div style={styles.cardInner}>{children}</div>
    </div>
  );
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "danger" | "success" }) {
  const map: Record<string, React.CSSProperties> = {
    neutral: styles.pillNeutral,
    accent: styles.pillAccent,
    danger: styles.pillDanger,
    success: styles.pillSuccess,
  };
  return <span style={{ ...styles.pill, ...(map[tone] ?? map.neutral) }}>{label}</span>;
}

function TinyButton({
  label,
  onClick,
  tone = "ghost",
  disabled,
}: {
  label: string;
  onClick: () => void;
  tone?: "ghost" | "solid" | "danger";
  disabled?: boolean;
}) {
  const base = { ...styles.tinyBtn } as React.CSSProperties;
  const t = tone === "solid" ? styles.tinyBtnSolid : tone === "danger" ? styles.tinyBtnDanger : styles.tinyBtnGhost;
  return (
    <button style={{ ...base, ...t, opacity: disabled ? 0.45 : 1 }} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

function IconButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ ...styles.iconBtn, opacity: disabled ? 0.45 : 1 }}
    >
      <span style={{ fontSize: 18, lineHeight: "18px" }}>{label}</span>
    </button>
  );
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={styles.segmentedWrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{ ...styles.segmentedBtn, ...(active ? styles.segmentedBtnActive : {}) }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumericInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  disabled,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const lastValueRef = useRef<number>(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      const old = lastValueRef.current;
      lastValueRef.current = value;
      if (draft === String(old)) setDraft(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(String(value));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const rounded = step === 1 ? Math.round(parsed) : Math.round(parsed / step) * step;
    const next = clamp(rounded, min, max);
    setDraft(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldInputRow}>
        <input
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "" || /^\d+$/.test(next)) setDraft(next);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          style={{ ...styles.fieldInput, opacity: disabled ? 0.55 : 1 }}
        />
        {suffix ? <div style={styles.fieldSuffix}>{suffix}</div> : null}
      </div>
    </div>
  );
}

function RowSeparator() {
  return <div style={styles.separator} />;
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return <div style={styles.bottomBar}>{children}</div>;
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles.primaryBtn, opacity: disabled ? 0.55 : 1 }}>
      {label}
    </button>
  );
}

function GhostButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles.ghostBtn, opacity: disabled ? 0.55 : 1 }}>
      {label}
    </button>
  );
}

// -------------------------
// Modals
// -------------------------

function ExercisePicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (exerciseId: string) => void }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
  }, [open]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return ExerciseDB;
    return ExerciseDB.filter((e) => `${e.name} ${e.muscleGroup}`.toLowerCase().includes(query));
  }, [q]);

  if (!open) return null;

  return (
    <div style={styles.modalOverlay} role="dialog" aria-modal="true">
      <div style={styles.modalSheet}>
        <div style={styles.modalHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={styles.modalTitle}>Ajouter un exercice</div>
            <div style={styles.modalSubtitle}>Valeurs préremplies automatiquement.</div>
          </div>
          <IconButton label="✕" onClick={onClose} />
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <div style={styles.searchWrap}>
            <span style={{ fontSize: 14, opacity: 0.85 }}>⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom ou groupe)" style={styles.searchInput} autoFocus />
          </div>
        </div>
        <div style={styles.modalList}>
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onSelect(e.id);
                onClose();
              }}
              style={styles.modalRow}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <div style={styles.modalRowTitle}>{e.name}</div>
                <div style={styles.modalRowSub}>{e.muscleGroup}</div>
              </div>
              <span style={{ opacity: 0.6 }}>›</span>
            </button>
          ))}
          {filtered.length === 0 ? <div style={{ padding: 16, opacity: 0.7, fontSize: 13 }}>Aucun résultat.</div> : null}
        </div>
        <div style={styles.modalFooter}>
          <GhostButton label="Fermer" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function SectionEditor({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (title: string) => void }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
  }, [open]);

  if (!open) return null;

  const canCreate = title.trim().length >= 2;

  return (
    <div style={styles.modalOverlay} role="dialog" aria-modal="true">
      <div style={styles.modalSheet}>
        <div style={styles.modalHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={styles.modalTitle}>Nouvelle section</div>
            <div style={styles.modalSubtitle}>Structure la séance (ex : Activation, Finisher).</div>
          </div>
          <IconButton label="✕" onClick={onClose} />
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={styles.fieldLabel}>Nom</div>
            <div style={styles.fieldInputRow}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Force" style={styles.fieldInput} autoFocus />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <GhostButton label="Annuler" onClick={onClose} />
            <PrimaryButton
              label="Ajouter"
              onClick={() => {
                if (!canCreate) return;
                onCreate(title.trim());
                onClose();
              }}
              disabled={!canCreate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// Data init
// -------------------------

function buildInitialSections(): WorkoutSection[] {
  // IDs stables pour faciliter le prototype.
  return [
    { id: "sec_warmup", title: "Échauffement" },
    { id: "sec_main", title: "Corps de la séance" },
  ];
}

function buildInitialExercises(cycle: Cycle, sections: WorkoutSection[]): WorkoutExercise[] {
  const warmupId = sections[0]?.id;
  const mainId = sections[1]?.id;
  const seed = ["back_squat", "bench_press", "rowing", "overhead_press", "pull_up"] as const;

  return seed.map((exerciseId, idx) => {
    const db = ExerciseDB.find((x) => x.id === exerciseId)!;
    const d = db.defaults[cycle];
    return {
      id: uid("we"),
      sectionId: idx < 1 ? warmupId : mainId,
      exerciseId: db.id,
      name: db.name,
      muscleGroup: db.muscleGroup,
      isTouched: {},
      sets: d.sets,
      reps: d.reps,
      percent1RM: d.percent1RM,
      rest: d.rest,
    };
  });
}

function applyCycleDefaults(list: WorkoutExercise[], cycle: Cycle): WorkoutExercise[] {
  return list.map((ex) => {
    const d = getDefaultsFor(ex.exerciseId, cycle);
    return {
      ...ex,
      sets: ex.isTouched.sets ? ex.sets : d.sets,
      reps: ex.isTouched.reps ? ex.reps : d.reps,
      percent1RM: ex.isTouched.percent1RM ? ex.percent1RM : d.percent1RM,
      rest: ex.isTouched.rest ? ex.rest : d.rest,
    };
  });
}

// -------------------------
// Screens
// -------------------------

function WorkoutApp() {
  // ✅ Navigation : bibliothèque (par défaut) -> éditeur
  const [screen, setScreen] = useState<"library" | "editor">("library");
  const [view, setView] = useState<View>("condensed");

  const [meta] = useState<WorkoutMeta>({
    title: "Séance Haut du corps",
    athleteName: "Alex",
    cycle: "hypertrophy", // internal only
    dateLabel: "Aujourd’hui",
  });

  // Sections = UI-only : titres, et leur ordre est dérivé depuis items.
  const [sectionTitles, setSectionTitles] = useState<Record<string, string>>(() => ({
    sec_warmup: "Échauffement",
    sec_main: "Corps de la séance",
  }));

  const [items, setItems] = useState<WorkoutExercise[]>(() => buildInitialExercises(meta.cycle, buildInitialSections()));

  const sections = useMemo(() => deriveSectionsFromItems(items, sectionTitles), [items, sectionTitles]);
  const sectionItems = useMemo(() => buildSectionItems(items, sections), [items, sections]);

  const [library, setLibrary] = useState<LibraryItem[]>(() => {
    const s = buildInitialSections();
    const now = Date.now();
    return [
      {
        id: uid("lib"),
        title: "Séance Full Body",
        athleteName: "Alex",
        createdAt: now - 1000 * 60 * 60,
        updatedAt: now - 1000 * 60 * 60,
        items: buildInitialExercises("strength", s),
        sectionTitles: { sec_warmup: "Échauffement", sec_main: "Corps de la séance" },
      },
    ];
  });

  // If set: save overwrites this workout.
  const [editingId, setEditingId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetSectionId, setPickerTargetSectionId] = useState<string>("sec_main");
  const [sectionModalOpen, setSectionModalOpen] = useState(false);

  useEffect(() => {
    setItems((prev) => applyCycleDefaults(prev, meta.cycle));
  }, [meta.cycle]);

  const totalSets = useMemo(() => items.reduce((acc, it) => acc + (it.sets || 0), 0), [items]);

  function openPicker(sectionId: string) {
    setPickerTargetSectionId(sectionId);
    setPickerOpen(true);
  }

  function addExerciseToSection(exerciseId: string, sectionId: string) {
    const db = ExerciseDB.find((x) => x.id === exerciseId);
    if (!db) return;
    const d = db.defaults[meta.cycle];
    setItems((prev) => [
      ...prev,
      {
        id: uid("we"),
        sectionId,
        exerciseId: db.id,
        name: db.name,
        muscleGroup: db.muscleGroup,
        isTouched: {},
        sets: d.sets,
        reps: d.reps,
        percent1RM: d.percent1RM,
        rest: d.rest,
      },
    ]);
  }

  function removeExercise(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function updateExercise(id: string, patch: Partial<WorkoutExercise>, touchKey?: keyof WorkoutExercise["isTouched"]) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const nextTouched = touchKey ? { ...it.isTouched, [touchKey]: true } : it.isTouched;
        return { ...it, ...patch, isTouched: nextTouched };
      })
    );
  }

  function resetToDefaults(id: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const d = getDefaultsFor(it.exerciseId, meta.cycle);
        return { ...it, isTouched: {}, sets: d.sets, reps: d.reps, percent1RM: d.percent1RM, rest: d.rest };
      })
    );
  }

  function moveExercise(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;

      const next = [...prev];
      const cur = { ...next[idx] };
      const other = { ...next[j] };

      // Si on traverse une frontière, on change la section de l’exercice déplacé.
      if (cur.sectionId !== other.sectionId) cur.sectionId = other.sectionId;

      next[idx] = other;
      next[j] = cur;
      return next;
    });
  }

  function addSection(title: string) {
    const id = uid("sec");
    setSectionTitles((prev) => ({ ...prev, [id]: title }));
  }

  function removeSection(sectionId: string) {
    // ✅ choix A : supprimer la section => supprimer aussi ses exercices
    setItems((prev) => prev.filter((it) => it.sectionId !== sectionId));
    setSectionTitles((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }

  function moveSection(sectionId: string, dir: -1 | 1) {
    setItems((prev) => moveSectionBlock(prev, sectionId, dir, sectionTitles));
  }

  function newWorkout() {
    const s = buildInitialSections();
    setItems(buildInitialExercises(meta.cycle, s));
    setSectionTitles({ sec_warmup: "Échauffement", sec_main: "Corps de la séance" });
    setEditingId(null);
    setView("condensed");
    setScreen("editor");
  }

  function closeEditor() {
    setScreen("library");
  }

  function saveWorkout() {
    const now = Date.now();

    if (editingId) {
      setLibrary((prev) =>
        prev.map((w) =>
          w.id === editingId
            ? {
                ...w,
                title: meta.title,
                athleteName: meta.athleteName,
                updatedAt: now,
                items: items.map((it) => ({ ...it, isTouched: { ...it.isTouched } })),
                sectionTitles: { ...sectionTitles },
              }
            : w
        )
      );
    } else {
      const snapshot: LibraryItem = {
        id: uid("lib"),
        title: meta.title,
        athleteName: meta.athleteName,
        createdAt: now,
        updatedAt: now,
        items: items.map((it) => ({ ...it, isTouched: { ...it.isTouched } })),
        sectionTitles: { ...sectionTitles },
      };
      setLibrary((prev) => [snapshot, ...prev]);
      setEditingId(snapshot.id);
    }

    setScreen("library");
  }

  function duplicateFromLibrary(w: LibraryItem) {
    const now = Date.now();
    const snapshot: LibraryItem = {
      id: uid("lib"),
      title: w.title + " (copie)",
      athleteName: w.athleteName,
      createdAt: now,
      updatedAt: now,
      items: w.items.map((it) => ({ ...it, id: uid("we"), isTouched: { ...it.isTouched } })),
      sectionTitles: { ...w.sectionTitles },
    };
    setLibrary((prev) => [snapshot, ...prev]);
  }

  function loadWorkout(w: LibraryItem) {
    setItems(w.items.map((it) => ({ ...it, isTouched: { ...it.isTouched } })));
    setSectionTitles({ ...w.sectionTitles });
    setEditingId(w.id);
    setScreen("editor");
    setView("condensed");
  }

  const nonEmptySectionCount = sections.filter((s) => (sectionItems.get(s.id) ?? []).length > 0).length;

  return (
    <AppShell>
      <TopBar title="Musculation" left={<Pill label={meta.dateLabel} tone="neutral" />} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {screen === "library" ? (
          <LibraryView
            library={library}
            editingId={editingId}
            onLoad={loadWorkout}
            onNew={newWorkout}
            onDuplicate={duplicateFromLibrary}
          />
        ) : (
          <>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.workoutTitle}>{meta.title}</div>
                    <div style={styles.workoutSub}>
                      <span style={{ opacity: 0.9 }}>{meta.athleteName}</span>
                      <span style={{ opacity: 0.55 }}>·</span>
                      <span style={{ opacity: 0.9 }}>{nonEmptySectionCount} sections</span>
                      <span style={{ opacity: 0.55 }}>·</span>
                      <span style={{ opacity: 0.9 }}>{totalSets} séries</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <TinyButton label="+ Section" onClick={() => setSectionModalOpen(true)} tone="ghost" />
                      <TinyButton
                        label="+"
                        onClick={() => {
                          const last = sections[sections.length - 1]?.id ?? pickerTargetSectionId;
                          openPicker(last);
                        }}
                        tone="solid"
                      />
                    </div>
                  </div>
                </div>

                <RowSeparator />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={styles.fieldLabel}>Vue</div>
                    <SegmentedToggle<View>
                      value={view}
                      options={[
                        { value: "condensed", label: "Condensé" },
                        { value: "detail", label: "Détail" },
                      ]}
                      onChange={(v) => setView(v)}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {view === "condensed" ? (
              <CondensedSections
                sections={sections}
                sectionItems={sectionItems}
                onOpenPicker={openPicker}
                onMove={moveExercise}
                onRemoveExercise={removeExercise}
                onRemoveSection={removeSection}
                onMoveSection={moveSection}
              />
            ) : (
              <DetailedSections
                sections={sections}
                sectionItems={sectionItems}
                cycle={meta.cycle}
                onOpenPicker={openPicker}
                onMove={moveExercise}
                onRemoveExercise={removeExercise}
                onRemoveSection={removeSection}
                onMoveSection={moveSection}
                onUpdate={updateExercise}
                onReset={resetToDefaults}
              />
            )}

            <BottomBar>
              <GhostButton label="Fermer" onClick={closeEditor} />
              <PrimaryButton label={editingId ? "Mettre à jour" : "Enregistrer"} onClick={saveWorkout} />
            </BottomBar>
          </>
        )}
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exerciseId) => addExerciseToSection(exerciseId, pickerTargetSectionId)}
      />
      <SectionEditor open={sectionModalOpen} onClose={() => setSectionModalOpen(false)} onCreate={addSection} />
    </AppShell>
  );
}

function LibraryView({
  library,
  editingId,
  onLoad,
  onNew,
  onDuplicate,
}: {
  library: LibraryItem[];
  editingId: string | null;
  onLoad: (w: LibraryItem) => void;
  onNew: () => void;
  onDuplicate: (w: LibraryItem) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Bibliothèque</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Ouvre une séance existante, ou crée-en une nouvelle.</div>
          </div>
          <TinyButton label="+ Nouvelle" onClick={onNew} tone="solid" />
        </div>
      </Card>

      {library.map((w) => {
        const isEditing = editingId === w.id;
        const derived = deriveSectionsFromItems(w.items, w.sectionTitles);
        const sectionCount = derived.filter((s) => w.items.some((it) => it.sectionId === s.id)).length;
        return (
          <Card key={w.id}>
            <div style={styles.libraryRow}>
              <button onClick={() => onLoad(w)} style={styles.libraryRowBtn}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.libraryTitle}>{w.title}</div>
                  <div style={styles.librarySub}>
                    <span>{w.athleteName}</span>
                    <span style={{ opacity: 0.55 }}>·</span>
                    <span>{sectionCount} sections</span>
                    <span style={{ opacity: 0.55 }}>·</span>
                    <span>{w.items.length} ex.</span>
                  </div>
                </div>
                {isEditing ? <Pill label="En cours" tone="accent" /> : <span style={{ opacity: 0.5 }}>›</span>}
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <TinyButton label="Modifier" onClick={() => onLoad(w)} tone="ghost" />
                <TinyButton label="Dupliquer" onClick={() => onDuplicate(w)} tone="ghost" />
              </div>
            </div>
          </Card>
        );
      })}

      {library.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Aucune séance enregistrée.</div>
        </Card>
      ) : null}
    </div>
  );
}

function CondensedSections({
  sections,
  sectionItems,
  onOpenPicker,
  onMove,
  onRemoveExercise,
  onRemoveSection,
  onMoveSection,
}: {
  sections: WorkoutSection[];
  sectionItems: Map<string, WorkoutExercise[]>;
  onOpenPicker: (sectionId: string) => void;
  onMove: (exerciseId: string, dir: -1 | 1) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, dir: -1 | 1) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map((sec, idx) => {
        const list = sectionItems.get(sec.id) ?? [];
        return (
          <Card key={sec.id}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={styles.sectionHeaderRow}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={styles.sectionHeaderTitle}>{sec.title}</div>
                  <div style={styles.sectionHeaderSub}>
                    {list.length} exercice{list.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <IconButton label="↑" onClick={() => onMoveSection(sec.id, -1)} disabled={idx === 0} />
                    <IconButton label="↓" onClick={() => onMoveSection(sec.id, 1)} disabled={idx === sections.length - 1} />
                  </div>
                  <TinyButton label="+" onClick={() => onOpenPicker(sec.id)} tone="solid" />
                  <TinyButton label="Suppr." onClick={() => onRemoveSection(sec.id)} tone="danger" />
                </div>
              </div>

              <RowSeparator />

              <div style={{ display: "flex", flexDirection: "column" }}>
                {list.map((it) => {
                  const pct = it.percent1RM;
                  const pctLabel = pct ? `${pct}%` : "BW";
                  return (
                    <div key={it.id}>
                      <div style={styles.condensedRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <div style={styles.condensedTitle}>{it.name}</div>
                            <div style={styles.condensedSub}>
                              {it.sets}×{it.reps}
                              <span style={{ opacity: 0.55 }}>·</span>
                              {formatRest(it.rest)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Pill label={pctLabel} tone={percentTone(pct)} />
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <IconButton label="↑" onClick={() => onMove(it.id, -1)} />
                            <IconButton label="↓" onClick={() => onMove(it.id, 1)} />
                            <IconButton label="−" onClick={() => onRemoveExercise(it.id)} />
                          </div>
                        </div>
                      </div>
                      <RowSeparator />
                    </div>
                  );
                })}
                {list.length === 0 ? <div style={{ padding: 14, opacity: 0.7, fontSize: 13 }}>Aucun exercice.</div> : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DetailedSections({
  sections,
  sectionItems,
  cycle,
  onOpenPicker,
  onMove,
  onRemoveExercise,
  onRemoveSection,
  onMoveSection,
  onUpdate,
  onReset,
}: {
  sections: WorkoutSection[];
  sectionItems: Map<string, WorkoutExercise[]>;
  cycle: Cycle;
  onOpenPicker: (sectionId: string) => void;
  onMove: (exerciseId: string, dir: -1 | 1) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, dir: -1 | 1) => void;
  onUpdate: (exerciseId: string, patch: Partial<WorkoutExercise>, touchKey?: keyof WorkoutExercise["isTouched"]) => void;
  onReset: (exerciseId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map((sec, idx) => {
        const list = sectionItems.get(sec.id) ?? [];
        return (
          <div key={sec.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Card>
              <div style={styles.sectionTitleRow}>
                <div style={styles.sectionTitle}>{sec.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <IconButton label="↑" onClick={() => onMoveSection(sec.id, -1)} disabled={idx === 0} />
                    <IconButton label="↓" onClick={() => onMoveSection(sec.id, 1)} disabled={idx === sections.length - 1} />
                  </div>
                  <TinyButton label="+ Ex" onClick={() => onOpenPicker(sec.id)} tone="solid" />
                  <TinyButton label="Suppr." onClick={() => onRemoveSection(sec.id)} tone="danger" />
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.72 }}>Valeurs préremplies automatiquement, ajustables au besoin.</div>
            </Card>

            {list.map((it) => {
              const defaults = getDefaultsFor(it.exerciseId, cycle);
              const touchedCount = Object.values(it.isTouched).filter(Boolean).length;
              const pct = it.percent1RM;
              return (
                <Card key={it.id}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.exerciseTitle}>{it.name}</div>
                        <div style={styles.exerciseSub}>
                          {it.muscleGroup}
                          {touchedCount ? (
                            <>
                              <span style={{ opacity: 0.55 }}>·</span>
                              <span style={{ opacity: 0.9 }}>{touchedCount} modif.</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Pill label={pct ? `${pct}%1RM` : "Poids libre"} tone={percentTone(pct)} />
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <IconButton label="↑" onClick={() => onMove(it.id, -1)} />
                          <IconButton label="↓" onClick={() => onMove(it.id, 1)} />
                          <IconButton label="−" onClick={() => onRemoveExercise(it.id)} />
                        </div>
                      </div>
                    </div>

                    <RowSeparator />

                    <div style={styles.editorGrid}>
                      <NumericInput label="Séries" value={it.sets} min={1} max={12} onChange={(v) => onUpdate(it.id, { sets: v }, "sets")} />
                      <NumericInput label="Répétitions" value={it.reps} min={1} max={50} onChange={(v) => onUpdate(it.id, { reps: v }, "reps")} />
                      <NumericInput
                        label="% 1RM"
                        value={it.percent1RM}
                        min={0}
                        max={100}
                        onChange={(v) => onUpdate(it.id, { percent1RM: v }, "percent1RM")}
                        suffix="%"
                        placeholder="0"
                      />
                      <NumericInput label="Récup (sec)" value={it.rest} min={0} max={600} onChange={(v) => onUpdate(it.id, { rest: v }, "rest")} suffix="s" />

                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={styles.defaultsRow}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <div style={styles.defaultsLabel}>Défauts</div>
                            <Pill label={`${defaults.sets}×${defaults.reps}`} tone="neutral" />
                            <Pill label={defaults.percent1RM ? `${defaults.percent1RM}%1RM` : "Poids libre"} tone={percentTone(defaults.percent1RM)} />
                            <Pill label={formatRest(defaults.rest)} tone="neutral" />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <TinyButton label="Réinit." onClick={() => onReset(it.id)} tone="ghost" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Ajouter</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Ajoute un exercice à la fin de cette section.</div>
                </div>
                <TinyButton label="+ Exercice" onClick={() => onOpenPicker(sec.id)} tone="solid" />
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------
// Styles — minimal, premium, dense
// -------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 800px at 20% -10%, rgba(255,255,255,0.08), rgba(255,255,255,0) 60%), #0B0F16",
    color: "rgba(255,255,255,0.92)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
  },
  safeTop: { height: 10 },
  safeBottom: { height: 18 },
  container: {
    maxWidth: 460,
    margin: "0 auto",
    padding: "14px 14px 108px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    backdropFilter: "blur(14px)",
    background: "rgba(11, 15, 22, 0.72)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: "10px 12px",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
  },
  topBarSide: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    maxWidth: "42vw",
    overflowX: "auto",
    overflowY: "hidden",
  },
  topBarTitle: {
    fontSize: 14,
    letterSpacing: 0.2,
    fontWeight: 750,
    opacity: 0.95,
    textAlign: "center",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  card: {
    borderRadius: 22,
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  cardInner: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  separator: { height: 1, background: "rgba(255,255,255,0.07)" },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 750,
    border: "1px solid rgba(255,255,255,0.10)",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  pillNeutral: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.88)" },
  pillAccent: {
    background: "rgba(123, 97, 255, 0.20)",
    border: "1px solid rgba(123, 97, 255, 0.35)",
    color: "rgba(240,238,255,0.95)",
  },
  pillSuccess: {
    background: "rgba(73, 204, 146, 0.16)",
    border: "1px solid rgba(73, 204, 146, 0.28)",
    color: "rgba(227, 255, 244, 0.95)",
  },
  pillDanger: {
    background: "rgba(255, 102, 102, 0.16)",
    border: "1px solid rgba(255, 102, 102, 0.28)",
    color: "rgba(255, 235, 235, 0.95)",
  },
  segmentedWrap: {
    display: "inline-flex",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  segmentedBtn: {
    appearance: "none",
    border: "none",
    cursor: "pointer",
    background: "transparent",
    color: "rgba(255,255,255,0.78)",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.15,
  },
  segmentedBtnActive: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08))",
    color: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  tinyBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: 0.2,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  tinyBtnGhost: { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.88)" },
  tinyBtnSolid: {
    background: "linear-gradient(180deg, rgba(123, 97, 255, 0.42), rgba(123, 97, 255, 0.22))",
    border: "1px solid rgba(123, 97, 255, 0.40)",
    color: "rgba(250, 249, 255, 0.98)",
  },
  tinyBtnDanger: {
    background: "rgba(255, 102, 102, 0.16)",
    border: "1px solid rgba(255, 102, 102, 0.30)",
    color: "rgba(255, 240, 240, 0.95)",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.25,
    textTransform: "uppercase",
    opacity: 0.65,
  },
  fieldInputRow: {
    display: "flex",
    alignItems: "stretch",
    gap: 0,
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
  },
  fieldInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.92)",
    padding: "12px 12px",
    fontSize: 14,
    fontWeight: 850,
    letterSpacing: 0.1,
  },
  fieldSuffix: {
    padding: "12px 12px",
    display: "flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.7,
    borderLeft: "1px solid rgba(255,255,255,0.10)",
  },
  condensedRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 2px",
  },
  condensedTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  condensedSub: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    opacity: 0.72,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: 0.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  exerciseSub: {
    marginTop: 3,
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    opacity: 0.72,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  editorGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  defaultsRow: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  defaultsLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    opacity: 0.6,
    marginRight: 2,
  },
  bottomBar: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 12,
    width: "min(460px, calc(100vw - 28px))",
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11, 15, 22, 0.78)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  },
  primaryBtn: {
    flex: 1,
    border: "1px solid rgba(123, 97, 255, 0.45)",
    background: "linear-gradient(180deg, rgba(123, 97, 255, 0.52), rgba(123, 97, 255, 0.26))",
    color: "rgba(250, 249, 255, 0.98)",
    borderRadius: 18,
    padding: "14px 14px",
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: 0.2,
    cursor: "pointer",
  },
  ghostBtn: {
    flex: 1,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: "14px 14px",
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: 0.2,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 12,
    zIndex: 20,
  },
  modalSheet: {
    width: "min(460px, 100%)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(18, 22, 31, 0.96), rgba(11, 15, 22, 0.96))",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
    overflow: "hidden",
    maxHeight: "84vh",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    padding: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  modalTitle: { fontSize: 14, fontWeight: 950, letterSpacing: 0.1 },
  modalSubtitle: { fontSize: 12, opacity: 0.7 },
  modalList: { overflow: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 },
  modalRow: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: "12px 12px",
    cursor: "pointer",
    color: "rgba(255,255,255,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    textAlign: "left",
  },
  modalRowTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  modalRowSub: {
    fontSize: 12,
    opacity: 0.72,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  modalFooter: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    gap: 10,
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    padding: "10px 12px",
  },
  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 800,
  },
  sectionHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: 0.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sectionHeaderSub: { fontSize: 12, opacity: 0.7 },
  sectionTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 800, opacity: 0.88, letterSpacing: 0.2 },
  workoutTitle: {
    fontSize: 16,
    fontWeight: 850,
    letterSpacing: 0.1,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  workoutSub: {
    marginTop: 4,
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    opacity: 0.8,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  libraryRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  libraryRowBtn: {
    flex: 1,
    minWidth: 0,
    width: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 0,
    margin: 0,
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    textAlign: "left",
  },
  libraryTitle: {
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: 0.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  librarySub: {
    marginTop: 4,
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    opacity: 0.72,
    flexWrap: "wrap",
  },
};

export default function App() {
  return <WorkoutApp />;
}

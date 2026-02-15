import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Waves, Power, Check, Circle, UserX, FileText, UserCheck, Minus, Plus, Sun, Moon } from "lucide-react";
import { useLocation } from "wouter";
import { BottomActionBar, type SaveState } from "@/components/shared/BottomActionBar";
import { slideInFromBottom, staggerChildren, listItem } from "@/lib/animations";
import { durationsSeconds } from "@/lib/design-tokens";
import { StrokeDetailForm } from "./StrokeDetailForm";
import { TechnicalNotesSection } from "./TechnicalNotesSection";
import type { Session, SwimExerciseLogInput, SwimSessionItem } from "@/lib/api";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function dayLabelFR(d: Date) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtKm(km: number | string | null | undefined) {
  const n = Number(km);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  const str = String(rounded);
  return str.endsWith(".0") ? str.slice(0, -2) : str;
}

function metersToKm(m: number | string | null | undefined) {
  const n = Number(m);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 1000) * 100) / 100;
}

function kmToMeters(km: number | string | null | undefined) {
  const n = Number(km);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000);
}

type SlotKey = "AM" | "PM";

type PlannedSession = {
  id: string;
  iso: string;
  slotKey: SlotKey;
  title: string;
  km: number | null;
  details: string[];
  assignmentId?: number;
  isEmpty: boolean;
};

type StrokeDraft = { NL: string; DOS: string; BR: string; PAP: string; QN: string };

type IndicatorKey = "difficulty" | "fatigue_end" | "performance" | "engagement";

type DraftState = Record<IndicatorKey, number | null> & {
  comment: string;
  distanceMeters: number | null;
  showStrokeDetail: boolean;
  strokes: StrokeDraft;
  exerciseLogs: SwimExerciseLogInput[];
};

const INDICATORS = [
  { key: "difficulty" as const, label: "Difficulté", mode: "hard" as const },
  { key: "fatigue_end" as const, label: "Fatigue fin", mode: "hard" as const },
  { key: "performance" as const, label: "Perf perçue", mode: "good" as const },
  { key: "engagement" as const, label: "Engagement", mode: "good" as const },
];

const SLOTS = [
  { key: "AM" as const, label: "Matin", Icon: Sun },
  { key: "PM" as const, label: "Soir", Icon: Moon },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

interface IconButtonProps {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "dark" | "sky";
  disabled?: boolean;
}

function IconButton({ onClick, label, children, tone = "neutral", disabled }: IconButtonProps) {
  const tones = {
    neutral: "bg-background border-border text-foreground hover:bg-muted",
    dark: "bg-foreground border-foreground text-background hover:opacity-90",
    sky: "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border p-2 transition",
        tones[tone],
        disabled && "opacity-50 cursor-not-allowed hover:bg-background"
      )}
      aria-label={label}
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function valueTone(mode: "hard" | "good", value: number) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 1 || v > 5) return "neutral";

  const hardMap: Record<number, string> = {
    1: "bg-intensity-1 border-intensity-1 text-white",
    2: "bg-intensity-2 border-intensity-2 text-white",
    3: "bg-intensity-3 border-intensity-3 text-white",
    4: "bg-intensity-4 border-intensity-4 text-white",
    5: "bg-intensity-5 border-intensity-5 text-white",
  };
  const goodMap: Record<number, string> = {
    1: "bg-intensity-5 border-intensity-5 text-white",
    2: "bg-intensity-4 border-intensity-4 text-white",
    3: "bg-intensity-3 border-intensity-3 text-white",
    4: "bg-intensity-2 border-intensity-2 text-white",
    5: "bg-intensity-1 border-intensity-1 text-white",
  };

  return mode === "hard" ? hardMap[v] : goodMap[v];
}

interface DistanceStepperProps {
  plannedMeters: number;
  valueMeters: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function DistanceStepper({ plannedMeters, valueMeters, onChange, disabled }: DistanceStepperProps) {
  const step = 100;
  const min = 0;
  const max = 30000;

  const displayMeters = Number.isFinite(Number(valueMeters)) ? Number(valueMeters) : plannedMeters;
  const delta = displayMeters - plannedMeters;

  return (
    <div className={cn("mt-4 rounded-3xl border px-4 py-3", disabled ? "bg-muted border-border" : "bg-card border-border")}>
      <div className="flex items-center justify-between mb-2">
        <div className={cn("text-xs font-semibold", disabled ? "text-muted-foreground" : "text-foreground")}>Ajuster kilométrage</div>
        {delta !== 0 && (
          <div className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            delta > 0
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          )}>
            {delta > 0 ? `+${delta}m` : `${delta}m`}
          </div>
        )}
      </div>

      {/* Planned value reference */}
      <div className="text-center mb-3">
        <div className={cn("text-xs", disabled ? "text-muted-foreground" : "text-muted-foreground")}>
          Planifié : {plannedMeters}m ({fmtKm(metersToKm(plannedMeters))} km)
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={disabled || displayMeters - step < min}
          onClick={() => onChange(displayMeters - step)}
          className={cn(
            "h-11 w-11 rounded-2xl border flex items-center justify-center transition-colors",
            disabled
              ? "bg-muted border-border text-muted-foreground cursor-not-allowed"
              : "bg-card border-border text-foreground hover:bg-muted active:scale-95"
          )}
          aria-label="-100m"
        >
          <Minus className="h-5 w-5" />
        </button>

        <div className="min-w-[140px] text-center">
          <div className={cn(
            "text-2xl font-bold",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}>
            {displayMeters}m
          </div>
          <div className={cn("text-sm font-medium mt-0.5", disabled ? "text-muted-foreground" : "text-primary")}>
            {fmtKm(metersToKm(displayMeters))} km
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || displayMeters + step > max}
          onClick={() => onChange(displayMeters + step)}
          className={cn(
            "h-11 w-11 rounded-2xl border flex items-center justify-center transition-colors",
            disabled
              ? "bg-muted border-border text-muted-foreground cursor-not-allowed"
              : "bg-card border-border text-foreground hover:bg-muted active:scale-95"
          )}
          aria-label="+100m"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

interface SessionStatus {
  status: "present" | "absent" | "not_expected";
  expected: boolean;
  expectedByDefault: boolean;
}

interface FeedbackDrawerProps {
  open: boolean;
  selectedDate: Date;
  sessionsForSelectedDay: PlannedSession[];
  selectedDayStatus: { completed: number; total: number };
  dayKm: string;
  activeSessionId: string | null;
  detailsOpen: boolean;
  draftState: DraftState;
  saveState: SaveState;
  isPending: boolean;
  logsBySessionId: Record<string, Session>;
  assignmentItems?: SwimSessionItem[];
  onClose: () => void;
  onDayOffAll: () => void;
  onOpenSession: (sessionId: string) => void;
  onCloseSession: () => void;
  onToggleDetails: () => void;
  onMarkAbsent: (sessionId: string) => void;
  onMarkPresent: (sessionId: string) => void;
  onClearOverride: (sessionId: string) => void;
  onSaveFeedback: () => void;
  onDraftStateChange: (state: DraftState) => void;
  getSessionStatus: (session: PlannedSession, date: Date) => SessionStatus;
}

export function FeedbackDrawer({
  open,
  selectedDate,
  sessionsForSelectedDay,
  selectedDayStatus,
  dayKm,
  activeSessionId,
  detailsOpen,
  draftState,
  saveState,
  isPending,
  logsBySessionId,
  assignmentItems,
  onClose,
  onDayOffAll,
  onOpenSession,
  onCloseSession,
  onToggleDetails,
  onMarkAbsent,
  onMarkPresent,
  onClearOverride,
  onSaveFeedback,
  onDraftStateChange,
  getSessionStatus,
}: FeedbackDrawerProps) {
  const [, setLocation] = useLocation();

  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessionsForSelectedDay.find((s) => s.id === activeSessionId) || null;
  }, [activeSessionId, sessionsForSelectedDay]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-overlay bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "fixed z-modal bg-background shadow-2xl",
              // Mobile: bottom sheet
              "left-0 right-0 bottom-0 top-auto max-h-[calc(100dvh-env(safe-area-inset-top))] h-[88dvh] rounded-t-3xl",
              // Desktop: drawer à droite
              "sm:right-0 sm:top-0 sm:left-auto sm:bottom-auto sm:h-full sm:w-full sm:max-w-xl sm:rounded-none"
            )}
            variants={slideInFromBottom}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-full flex-col">
              <div className="px-5 pt-3 sm:hidden">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />
              </div>

              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 sm:px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground">{dayLabelFR(selectedDate)}</div>
                </div>
                <IconButton onClick={onClose} label="Fermer">
                  <X className="h-5 w-5" />
                </IconButton>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-5">
                {/* Header jour minimal */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-2xl border border-border bg-card flex items-center justify-center">
                      <Waves className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <div className="text-sm font-semibold text-foreground">{dayKm} km</div>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            selectedDayStatus.total > 0 && selectedDayStatus.completed >= 1 ? "bg-status-success" : "bg-muted-foreground/30"
                          )}
                        />
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            selectedDayStatus.total > 0 && selectedDayStatus.completed >= 2 ? "bg-status-success" : "bg-muted-foreground/30"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <IconButton onClick={onDayOffAll} label="OFF (absent journée)" tone="dark" disabled={isPending}>
                    <Power className="h-5 w-5" />
                  </IconButton>
                </div>

                {/* Liste séances (compacte) */}
                <div className="mt-4 grid gap-2">
                  {sessionsForSelectedDay.map((s) => {
                    const st = getSessionStatus(s, selectedDate);
                    const hasLog = Boolean(logsBySessionId[s.id]);

                    const isAbsentOverride = st.status === "absent";
                    const isNotExpected = st.status === "not_expected";
                    const isAbsentLike = isAbsentOverride || isNotExpected;

                    const needsAction = st.expected && !hasLog && !isAbsentOverride;

                    const bg = hasLog
                      ? "bg-status-success-bg border-status-success/30"
                      : isAbsentLike
                      ? "bg-sky-50 border-sky-200"
                      : needsAction
                      ? "bg-status-warning-bg border-status-warning/30"
                      : "bg-card border-border";

                    const SlotIcon = SLOTS.find((x) => x.key === s.slotKey)?.Icon || Circle;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onOpenSession(s.id)}
                        className={cn("w-full rounded-3xl border px-3 py-3 text-left transition", bg, "hover:shadow-sm")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-2xl border flex items-center justify-center",
                                hasLog
                                  ? "border-status-success/30 bg-status-success-bg"
                                  : isAbsentLike
                                  ? "border-sky-200 bg-sky-100"
                                  : needsAction
                                  ? "border-status-warning/30 bg-status-warning-bg"
                                  : "border-border bg-muted"
                              )}
                            >
                              <SlotIcon className="h-5 w-5 text-foreground" />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground">{s.title}</div>
                              <div className="mt-1 flex items-center gap-2">
                                {s.isEmpty ? <Chip>Vide</Chip> : <Chip>{fmtKm(s.km)} km</Chip>}
                                {hasLog && (
                                  <span className="inline-flex items-center text-emerald-800">
                                    <Check className="h-4 w-4" />
                                    <span className="sr-only">Présent</span>
                                  </span>
                                )}
                                {isAbsentLike && !hasLog && (
                                  <span className="inline-flex items-center text-sky-800">
                                    <UserX className="h-4 w-4" />
                                    <span className="sr-only">Absent</span>
                                  </span>
                                )}
                                {needsAction && (
                                  <span className="inline-flex items-center text-orange-900">
                                    <Circle className="h-4 w-4" />
                                    <span className="sr-only">En attente</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isNotExpected && (
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkPresent(s.id);
                                }}
                                label="Je suis venu"
                                disabled={isPending}
                              >
                                <UserCheck className="h-5 w-5" />
                              </IconButton>
                            )}

                            {st.expected && !hasLog && !isAbsentOverride && (
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkAbsent(s.id);
                                }}
                                label="Absent"
                                tone="sky"
                                disabled={isPending}
                              >
                                <UserX className="h-5 w-5" />
                              </IconButton>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Détail séance + ressenti */}
                <AnimatePresence>
                  {activeSession && (
                    <motion.div
                      key={activeSession.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: durationsSeconds.normal }}
                      className="mt-4 rounded-3xl border border-border bg-card overflow-hidden"
                    >
                      {(() => {
                        const st = getSessionStatus(activeSession, selectedDate);
                        const isAbsentOverride = st.status === "absent";
                        const isNotExpected = st.status === "not_expected";
                        const hasLog = Boolean(logsBySessionId[activeSession.id]);
                        const canRate = st.expected && !isAbsentOverride;

                        const leftActionLabel = isAbsentOverride ? "Annuler" : isNotExpected ? "Je suis venu" : "Absent";

                        const leftActionFn = isAbsentOverride
                          ? () => onClearOverride(activeSession.id)
                          : isNotExpected
                          ? () => onMarkPresent(activeSession.id)
                          : () => onMarkAbsent(activeSession.id);

                        const plannedMeters = kmToMeters(activeSession.km ?? 0);

                        return (
                          <>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-foreground">{activeSession.title}</div>
                                <div className="mt-1 flex items-center gap-2">
                                  {activeSession.isEmpty ? <Chip>Vide</Chip> : <Chip>{fmtKm(activeSession.km)} km</Chip>}
                                  {hasLog ? (
                                    <span className="inline-flex items-center text-emerald-800">
                                      <Check className="h-4 w-4" />
                                      <span className="sr-only">Présent</span>
                                    </span>
                                  ) : isAbsentOverride || isNotExpected ? (
                                    <span className="inline-flex items-center text-sky-800">
                                      <UserX className="h-4 w-4" />
                                      <span className="sr-only">Absent</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-orange-900">
                                      <Circle className="h-4 w-4" />
                                      <span className="sr-only">En attente</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <IconButton onClick={onCloseSession} label="Retour">
                                <X className="h-5 w-5" />
                              </IconButton>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-3">
                              <button
                                type="button"
                                onClick={leftActionFn}
                                className={cn(
                                  "rounded-2xl px-3 py-3 text-sm font-semibold border transition inline-flex items-center justify-center gap-2",
                                  isNotExpected ? "bg-foreground text-background border-foreground hover:opacity-90" : "bg-card text-foreground border-border hover:bg-muted"
                                )}
                              >
                                {isNotExpected ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                                {leftActionLabel}
                              </button>

                              <button
                                type="button"
                                onClick={onToggleDetails}
                                className="rounded-2xl px-3 py-3 text-sm font-semibold border border-border bg-card hover:bg-muted inline-flex items-center justify-center gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                Fiche
                              </button>
                            </div>

                            <AnimatePresence>
                              {detailsOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  transition={{ duration: durationsSeconds.normal }}
                                  className="mx-3 mb-3 rounded-2xl border border-border bg-muted p-3"
                                >
                                  {activeSession.details?.length ? (
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                                      {activeSession.details.map((line, idx) => (
                                        <li key={idx}>{line}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      {activeSession.assignmentId ? "Séance coach — détails dans la fiche." : "Aucun détail pour ce créneau."}
                                    </div>
                                  )}

                                  {activeSession.assignmentId ? (
                                    <div className="mt-3">
                                      <button
                                        type="button"
                                        onClick={() => setLocation(`/swim-session?assignmentId=${activeSession.assignmentId}`)}
                                        className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                                      >
                                        Ouvrir la fiche complète
                                      </button>
                                    </div>
                                  ) : null}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Ressenti + distance */}
                            <div className="px-4 pb-4">
                              {!canRate && (
                                <div className="mb-3 rounded-2xl bg-sky-50 text-sky-900 px-3 py-2 text-xs">
                                  {isAbsentOverride ? "Absent: aucun ressenti." : 'Non prévu: appuyez "Je suis venu".'}
                                </div>
                              )}

                              <motion.div
                                className="space-y-4"
                                variants={staggerChildren}
                                initial="hidden"
                                animate="visible"
                              >
                                {INDICATORS.map((ind) => {
                                  const selected = draftState[ind.key];
                                  return (
                                    <motion.div key={ind.key} className="space-y-2" variants={listItem}>
                                      <div className={cn("text-sm font-semibold", !canRate ? "text-muted-foreground" : "text-foreground")}>{ind.label}</div>
                                      <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4, 5].map((n) => {
                                          const isSel = selected === n;
                                          return (
                                            <button
                                              key={n}
                                              type="button"
                                              disabled={!canRate}
                                              onClick={() => onDraftStateChange({ ...draftState, [ind.key]: n })}
                                              className={cn(
                                                "h-11 w-11 rounded-2xl border text-sm font-semibold transition",
                                                !canRate
                                                  ? "bg-muted text-muted-foreground border-border cursor-not-allowed"
                                                  : isSel
                                                  ? valueTone(ind.mode, n)
                                                  : "bg-card text-foreground border-border hover:bg-muted"
                                              )}
                                            >
                                              {n}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  );
                                })}

                                <motion.div className="space-y-2" variants={listItem}>
                                  <div className={cn("text-sm font-semibold", !canRate ? "text-muted-foreground" : "text-foreground")}>Commentaire</div>
                                  <textarea
                                    value={draftState.comment}
                                    onChange={(e) => onDraftStateChange({ ...draftState, comment: e.target.value })}
                                    disabled={!canRate}
                                    rows={3}
                                    placeholder="Sensations, points techniques…"
                                    className={cn(
                                      "w-full resize-none rounded-3xl border px-4 py-3 text-sm outline-none",
                                      !canRate
                                        ? "bg-muted text-muted-foreground border-border"
                                        : "bg-card text-foreground border-border focus:ring-2 focus:ring-foreground/10"
                                    )}
                                  />
                                </motion.div>
                              </motion.div>

                              {/* Stepper distance (±100m) */}
                              <DistanceStepper
                                plannedMeters={plannedMeters}
                                valueMeters={draftState.distanceMeters}
                                onChange={(m) => onDraftStateChange({ ...draftState, distanceMeters: m })}
                                disabled={!canRate}
                              />

                              {/* Détail par nage (collapsible) */}
                              <StrokeDetailForm
                                strokes={draftState.strokes}
                                showStrokeDetail={draftState.showStrokeDetail}
                                disabled={!canRate}
                                onToggle={() => onDraftStateChange({ ...draftState, showStrokeDetail: !draftState.showStrokeDetail })}
                                onChange={(strokes) => onDraftStateChange({ ...draftState, strokes })}
                              />

                              {/* Notes techniques par exercice */}
                              <TechnicalNotesSection
                                exerciseLogs={draftState.exerciseLogs}
                                assignmentItems={assignmentItems}
                                disabled={!canRate}
                                onLogsChange={(exerciseLogs) => onDraftStateChange({ ...draftState, exerciseLogs })}
                              />

                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action bar outside scroll area — constrained to drawer width */}
              {activeSession && (() => {
                const st = getSessionStatus(activeSession, selectedDate);
                const canRate = st.expected && st.status !== "absent";
                return (
                  <BottomActionBar saveState={saveState} position="static">
                    <button
                      type="button"
                      onClick={onSaveFeedback}
                      disabled={isPending || !canRate || !INDICATORS.every((i) => Number.isInteger(draftState[i.key]))}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm font-semibold transition flex-1",
                        isPending || !canRate
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : INDICATORS.every((i) => Number.isInteger(draftState[i.key]))
                          ? "bg-status-success text-white hover:opacity-90"
                          : "bg-status-success-bg text-status-success cursor-not-allowed"
                      )}
                    >
                      Valider
                    </button>
                    <div className="text-xs text-muted-foreground">{"\u2192"} km</div>
                  </BottomActionBar>
                );
              })()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

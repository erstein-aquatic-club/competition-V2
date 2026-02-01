import React, { useMemo, useRef, useState, useCallback, memo, useTransition, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Settings2,
  Waves,
  Power,
  Check,
  Circle,
  UserX,
  Info,
  Sun,
  Moon,
  FileText,
  UserCheck,
  Minus,
  Plus,
} from "lucide-react";

/**
 * Dashboard (swim) — UI based on maquette_accueil_calendrier_nageur_vite_react.jsx
 * - Pixel perfect UI/UX aligned with the mockup
 * - Backend logic unchanged:
 *   - Sessions (ressentis + distance) still saved via api.syncSession / api.updateSession
 *   - Coach assignments still fetched via api.getAssignments
 * - 2 placeholders per day (Matin/Soir), tagged as "vides" if no assignment exists.
 * - Presence/absence toggles are stored client-side (localStorage) to avoid backend changes.
 */

const WEEKDAYS_FR_SHORT = ["L", "M", "M", "J", "V", "S", "D"]; // mobile
const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]; // desktop

const INDICATORS = [
  { key: "difficulty", label: "Difficulté", mode: "hard" },
  { key: "fatigue_end", label: "Fatigue fin", mode: "hard" },
  { key: "performance", label: "Perf perçue", mode: "good" },
  { key: "engagement", label: "Engagement", mode: "good" },
] as const;

const SLOTS = [
  { key: "AM", label: "Matin", Icon: Sun },
  { key: "PM", label: "Soir", Icon: Moon },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];
type IndicatorKey = (typeof INDICATORS)[number]["key"];

type PlannedSession = {
  id: string; // `${iso}__${slotKey}`
  iso: string; // YYYY-MM-DD
  slotKey: SlotKey;
  title: string;
  km: number | null;
  details: string[];
  assignmentId?: number;
  isEmpty: boolean;
};

type PresenceDefaults = Record<number, Record<SlotKey, boolean>>;
type AttendanceOverride = "present" | "absent";
type AttendanceOverrides = Record<string, AttendanceOverride>;

type DraftState = Record<IndicatorKey, number | null> & {
  comment: string;
  distanceMeters: number | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekdayMondayIndex(d: Date) {
  const js = d.getDay();
  return (js + 6) % 7;
}

function monthLabelFR(d: Date) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function dayLabelFR(d: Date) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseSessionId(sessionId: string) {
  const parts = String(sessionId).split("__");
  return { iso: parts[0], slotKey: (parts[1] || "") as SlotKey | "" };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function fmtKm(km: any) {
  const n = Number(km);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  const str = String(rounded);
  return str.endsWith(".0") ? str.slice(0, -2) : str;
}

function metersToKm(m: any) {
  const n = Number(m);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 1000) * 100) / 100;
}

function kmToMeters(km: any) {
  const n = Number(km);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000);
}

function safeLinesFromText(text: any): string[] {
  if (!text) return [];
  const raw = String(text)
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  // Split bullet-ish lines if needed
  return raw.flatMap((line) => {
    const cleaned = line.replace(/^[•\\-–—]\\s*/, "").trim();
    return cleaned ? [cleaned] : [];
  });
}

function extractDistanceKmFromText(text: any): number | null {
  if (!text) return null;
  const t = String(text);
  const m = t.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(km|m)\\b/i);
  if (!m) return null;
  const val = Number(String(m[1]).replace(",", "."));
  if (!Number.isFinite(val)) return null;
  if (m[2].toLowerCase() === "m") return metersToKm(val);
  return val;
}

function pickAssignmentSlotKey(a: any, fallbackIdx: number): SlotKey {
  const direct =
    a?.slot ??
    a?.session_slot ??
    a?.assigned_slot ??
    a?.time_slot ??
    a?.timeOfDay ??
    a?.slot_key ??
    a?.slotKey;

  const norm = String(direct || "").toLowerCase();
  if (norm.includes("mat") || norm === "am") return "AM";
  if (norm.includes("soir") || norm === "pm") return "PM";

  const hay = `${a?.title ?? ""} ${a?.description ?? ""}`.toLowerCase();
  if (hay.includes("matin") || hay.includes(" am ") || hay.includes("(am)")) return "AM";
  if (hay.includes("soir") || hay.includes(" pm ") || hay.includes("(pm)")) return "PM";

  return fallbackIdx === 0 ? "AM" : "PM";
}

function assignmentIso(a: any): string | null {
  const raw = a?.assigned_date ?? a?.date ?? a?.day ?? a?.scheduled_for ?? a?.scheduledAt ?? null;
  if (!raw) return null;
  const s = String(raw);
  // handle ISO datetime or plain date
  const iso = s.length >= 10 ? s.slice(0, 10) : s;
  return /\\d{4}-\\d{2}-\\d{2}/.test(iso) ? iso : null;
}

function assignmentPlannedKm(a: any): number | null {
  const meters =
    a?.distance_meters ??
    a?.distanceMeters ??
    a?.meters ??
    a?.planned_meters ??
    a?.plannedMeters ??
    a?.distance ?? // often meters
    null;

  if (meters != null && Number.isFinite(Number(meters))) {
    // Heuristic: if it's <= 50, assume it's km; else meters.
    const n = Number(meters);
    if (n > 0 && n <= 50) return n; // km
    return metersToKm(n); // meters
  }

  const km =
    a?.km ??
    a?.distance_km ??
    a?.distanceKm ??
    a?.planned_km ??
    a?.plannedKm ??
    null;

  if (km != null && Number.isFinite(Number(km))) return Number(km);

  const fromText = extractDistanceKmFromText(`${a?.title ?? ""} ${a?.description ?? ""}`);
  if (fromText != null) return fromText;

  return null;
}

function toneForDay({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return "rest";
  if (completed >= total) return "full";
  if (completed > 0) return "half";
  return "none";
}

const CalendarCell = memo(function CalendarCell({
  date,
  inMonth,
  isToday,
  isSelected,
  status,
  onClick,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  status: { completed: number; total: number };
  onClick: () => void;
}) {
  const { completed, total } = status;
  const tone = toneForDay(status);

  const bg =
    tone === "full"
      ? "bg-primary"
      : tone === "half"
      ? "bg-primary/10"
      : tone === "none"
      ? "bg-muted"
      : "bg-muted/50";

  const border =
    tone === "full"
      ? "border-primary"
      : tone === "half"
      ? "border-primary/30"
      : tone === "none"
      ? "border-muted-foreground/20"
      : "border-border";

  const text = tone === "full" ? "text-primary-foreground" : "text-foreground";

  // micro-progress 2 segments (no overflow)
  const segOff = tone === "full" ? "bg-primary-foreground/25" : "bg-muted-foreground/30";
  const segOn = tone === "full" ? "bg-primary-foreground" : "bg-primary";

  const ring = isSelected
    ? tone === "full"
      ? "ring-2 ring-primary-foreground/50"
      : "ring-2 ring-primary/30"
    : "";

  // Aujourd'hui = contour accentué (sans texte)
  const todayRing = isToday
    ? tone === "full"
      ? "ring-2 ring-primary-foreground/40"
      : "ring-2 ring-primary/50"
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "aspect-square min-w-0 rounded-2xl border p-1 transition",
        bg,
        border,
        !inMonth && "opacity-40",
        "hover:shadow-sm",
        ring,
        todayRing
      )}
      aria-label={`${toISODate(date)} — ${total === 0 ? "Repos" : `${completed}/${total}`}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className={cn("text-[12px] font-semibold", text)}>{date.getDate()}</div>
          <div className="h-[14px] w-[14px]" />
        </div>

        <div className="flex items-center justify-end">
          {total > 0 && (
            <div className="w-6">
              <div className="flex gap-1">
                <span className={cn("h-1.5 flex-1 rounded-full", completed >= 1 ? segOn : segOff)} />
                <span className={cn("h-1.5 flex-1 rounded-full", completed >= 2 ? segOn : segOff)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

function Drawer({
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
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "fixed z-50 bg-background shadow-2xl",
              // Mobile: bottom sheet
              "left-0 right-0 bottom-0 top-auto h-[88vh] rounded-t-3xl",
              // Desktop: drawer à droite
              "sm:right-0 sm:top-0 sm:left-auto sm:bottom-auto sm:h-full sm:w-full sm:max-w-xl sm:rounded-none"
            )}
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 22, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-full flex-col">
              <div className="px-5 pt-3 sm:hidden">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />
              </div>

              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 sm:px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground">{title}</div>
                </div>
                <IconButton onClick={onClose} label="Fermer">
                  <X className="h-5 w-5" />
                </IconButton>
              </div>

              {/*
                Mobile: add extra bottom padding so the dock (app tabbar) never hides the
                last controls (ressentis / distance / buttons).
              */}
              <div className="flex-1 overflow-auto p-4 pb-24 sm:p-5 sm:pb-5">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Modal({
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
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            // Mobile: add a bigger bottom offset so the modal isn't hidden by the dock.
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 pb-24 sm:p-4 sm:pb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="w-full max-w-md rounded-3xl border bg-background shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="truncate text-base font-semibold text-foreground">{title}</div>
                <IconButton onClick={onClose} label="Fermer">
                  <X className="h-5 w-5" />
                </IconButton>
              </div>
              <div className="p-4">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

function IconButton({
  onClick,
  label,
  children,
  tone = "neutral",
  disabled,
}: {
  onClick: (e?: any) => void;
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "dark" | "sky";
  disabled?: boolean;
}) {
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
    1: "bg-emerald-600 border-emerald-600 text-white",
    2: "bg-emerald-500 border-emerald-500 text-white",
    3: "bg-amber-500 border-amber-500 text-white",
    4: "bg-orange-500 border-orange-500 text-white",
    5: "bg-red-600 border-red-600 text-white",
  };
  const goodMap: Record<number, string> = {
    1: "bg-red-600 border-red-600 text-white",
    2: "bg-orange-500 border-orange-500 text-white",
    3: "bg-amber-500 border-amber-500 text-white",
    4: "bg-emerald-500 border-emerald-500 text-white",
    5: "bg-emerald-600 border-emerald-600 text-white",
  };

  return mode === "hard" ? hardMap[v] : goodMap[v];
}

const DistanceStepper = memo(function DistanceStepper({
  plannedMeters,
  valueMeters,
  onChange,
  disabled,
}: {
  plannedMeters: number;
  valueMeters: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const step = 100;
  const min = 0;
  const max = 30000;

  const displayMeters = Number.isFinite(Number(valueMeters)) ? Number(valueMeters) : plannedMeters;
  const delta = displayMeters - plannedMeters;

  return (
    <div className={cn("mt-4 rounded-3xl border px-4 py-3", disabled ? "bg-zinc-50 border-zinc-200" : "bg-white border-zinc-200")}>
      <div className="flex items-center justify-between">
        <div className={cn("text-xs font-semibold", disabled ? "text-zinc-400" : "text-zinc-700")}>Ajuster kilométrage</div>
        <div className={cn("text-xs", disabled ? "text-zinc-400" : "text-zinc-600")}>
          {delta === 0 ? "" : delta > 0 ? `+${delta}m` : `${delta}m`}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={disabled || displayMeters - step < min}
          onClick={() => onChange(displayMeters - step)}
          className={cn(
            "h-11 w-11 rounded-2xl border flex items-center justify-center",
            disabled ? "bg-zinc-100 border-zinc-200 text-zinc-400" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50"
          )}
          aria-label="-100m"
        >
          <Minus className="h-5 w-5" />
        </button>

        <div className="min-w-[120px] text-center">
          <div className={cn("text-lg font-semibold", disabled ? "text-zinc-400" : "text-zinc-900")}>{displayMeters}m</div>
          <div className={cn("text-xs", disabled ? "text-zinc-400" : "text-zinc-500")}>({fmtKm(metersToKm(displayMeters))} km)</div>
        </div>

        <button
          type="button"
          disabled={disabled || displayMeters + step > max}
          onClick={() => onChange(displayMeters + step)}
          className={cn(
            "h-11 w-11 rounded-2xl border flex items-center justify-center",
            disabled ? "bg-zinc-100 border-zinc-200 text-zinc-400" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50"
          )}
          aria-label="+100m"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
});

function initPresenceDefaults(): PresenceDefaults {
  const init: PresenceDefaults = {};
  for (let i = 0; i < 7; i++) init[i] = { AM: true, PM: true };
  return init;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampToStep(value: number, step: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / step) * step;
}

export default function Dashboard() {
  const { user, userId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: sessions } = useQuery({
    queryKey: ["sessions", userId ?? user],
    queryFn: () => api.getSessions(user!, userId),
    enabled: !!user,
  });

  const { data: assignments } = useQuery({
    queryKey: ["assignments", user],
    queryFn: () => api.getAssignments(user!, userId),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: number) => api.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast({ title: "Séance supprimée", description: "La saisie a été supprimée." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la séance.", variant: "destructive" });
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.syncSession({ ...data, athlete_name: user!, athlete_id: userId ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({ title: "Séance enregistrée", description: "Vos données ont été synchronisées." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la séance.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast({ title: "Séance mise à jour", description: "Votre saisie a été mise à jour." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la séance.", variant: "destructive" });
    },
  });

  // --- Local settings (client-side only, no backend change) ---
  const storagePrefix = `swim-dashboard-v2:${userId ?? user ?? "anon"}`;
  const storagePresenceKey = `${storagePrefix}:presenceDefaults`;
  const storageAttendanceKey = `${storagePrefix}:attendanceOverrides`;
  const storageStableKey = `${storagePrefix}:stableFields`; // duration, etc.

  const [presenceDefaults, setPresenceDefaults] = useState<PresenceDefaults>(() => initPresenceDefaults());
  const [attendanceOverrideBySessionId, setAttendanceOverrideBySessionId] = useState<AttendanceOverrides>({});
  const [stableDurationMin, setStableDurationMin] = useState<number>(90); // backend expects duration; not shown in maquette

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedPresence = safeJsonParse<PresenceDefaults>(window.localStorage.getItem(storagePresenceKey));
    if (savedPresence) setPresenceDefaults(savedPresence);

    const savedAttendance = safeJsonParse<AttendanceOverrides>(window.localStorage.getItem(storageAttendanceKey));
    if (savedAttendance) setAttendanceOverrideBySessionId(savedAttendance);

    const savedStable = safeJsonParse<{ duration?: number }>(window.localStorage.getItem(storageStableKey));
    if (savedStable?.duration && Number.isFinite(savedStable.duration) && savedStable.duration >= 30 && savedStable.duration <= 240) {
      setStableDurationMin(savedStable.duration);
    }
  }, [storagePresenceKey, storageAttendanceKey, storageStableKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storagePresenceKey, JSON.stringify(presenceDefaults));
  }, [presenceDefaults, storagePresenceKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageAttendanceKey, JSON.stringify(attendanceOverrideBySessionId));
  }, [attendanceOverrideBySessionId, storageAttendanceKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageStableKey, JSON.stringify({ duration: stableDurationMin }));
  }, [stableDurationMin, storageStableKey]);

  // --- UI state (from maquette) ---
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedISO, setSelectedISO] = useState(() => toISODate(new Date()));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // auto-close drawer once day becomes fully completed
  const [autoCloseArmed, setAutoCloseArmed] = useState(false);

  // perf: startTransition for heavy state updates
  const [isPending, startTransition] = useTransition();

  // --- Backend data shaping ---
  const swimAssignments = useMemo(() => {
    const list = Array.isArray(assignments) ? assignments : [];
    return list.filter((a: any) => a?.session_type === "swim");
  }, [assignments]);

  const assignmentsByIso = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of swimAssignments) {
      const iso = assignmentIso(a);
      if (!iso) continue;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(a);
    }
    // stable ordering for deterministic AM/PM mapping
    for (const [iso, list] of map.entries()) {
      list.sort((x: any, y: any) => Number(x?.id ?? 0) - Number(y?.id ?? 0));
      map.set(iso, list);
    }
    return map;
  }, [swimAssignments]);

  const logsBySessionId = useMemo(() => {
    const list = Array.isArray(sessions) ? sessions : [];
    const map: Record<string, any> = {};
    for (const s of list) {
      const iso = String(s?.date ?? "").slice(0, 10);
      const slot: SlotKey = s?.slot === "Soir" ? "PM" : "AM";
      map[`${iso}__${slot}`] = s;
    }
    return map;
  }, [sessions]);

  // PERF: cache planned sessions by date (recomputed when assignments change)
  const sessionsCacheRef = useRef<Map<string, PlannedSession[]>>(new Map());
  useEffect(() => {
    sessionsCacheRef.current.clear();
  }, [assignmentsByIso]);

  const getSessionsForISO = useCallback(
    (iso: string): PlannedSession[] => {
      const cache = sessionsCacheRef.current;
      if (cache.has(iso)) return cache.get(iso)!;

      const list: PlannedSession[] = [
        {
          id: `${iso}__AM`,
          iso,
          slotKey: "AM",
          title: "Séance vide",
          km: null,
          details: [],
          isEmpty: true,
        },
        {
          id: `${iso}__PM`,
          iso,
          slotKey: "PM",
          title: "Séance vide",
          km: null,
          details: [],
          isEmpty: true,
        },
      ];

      const dayAssignments = assignmentsByIso.get(iso) ?? [];
      const usedSlots = new Set<SlotKey>();

      dayAssignments.forEach((a: any, idx: number) => {
        const slotKey = pickAssignmentSlotKey(a, idx);
        if (usedSlots.has(slotKey)) return;

        const slotIndex = slotKey === "AM" ? 0 : 1;
        const plannedKm = assignmentPlannedKm(a);
        const details = Array.isArray(a?.details) ? a.details.map(String) : safeLinesFromText(a?.description);

        list[slotIndex] = {
          id: `${iso}__${slotKey}`,
          iso,
          slotKey,
          title: String(a?.title ?? "Séance coach"),
          km: plannedKm,
          details,
          assignmentId: typeof a?.id === "number" ? a.id : Number(a?.id) || undefined,
          isEmpty: false,
        };

        usedSlots.add(slotKey);
      });

      cache.set(iso, list);
      return list;
    },
    [assignmentsByIso]
  );

  const getSessionStatus = useCallback(
    (session: PlannedSession, dateObj: Date) => {
      const weekday = weekdayMondayIndex(dateObj);
      const expectedByDefault = Boolean(presenceDefaults?.[weekday]?.[session.slotKey]);
      const override = attendanceOverrideBySessionId[session.id];

      if (override === "present") return { status: "present" as const, expected: true, expectedByDefault };
      if (override === "absent") return { status: "absent" as const, expected: true, expectedByDefault };

      if (expectedByDefault) return { status: "present" as const, expected: true, expectedByDefault };

      // Non prévue par défaut: affichée "Absent" (sans override)
      return { status: "not_expected" as const, expected: false, expectedByDefault };
    },
    [attendanceOverrideBySessionId, presenceDefaults]
  );

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);

  const gridDates = useMemo(() => {
    const startIndex = weekdayMondayIndex(monthStart);
    const gridStart = addDays(monthStart, -startIndex);

    const dates: Date[] = [];
    for (let i = 0; i < 42; i++) dates.push(addDays(gridStart, i));
    return dates;
  }, [monthStart]);

  const completionByISO = useMemo(() => {
    const map: Record<string, { completed: number; total: number }> = {};

    for (const d of gridDates) {
      const iso = toISODate(d);
      const planned = getSessionsForISO(iso);

      let total = 0;
      let completed = 0;

      for (const s of planned) {
        const st = getSessionStatus(s, d);
        if (!st.expected) continue;
        total += 1;

        const hasLog = Boolean(logsBySessionId[s.id]);
        const isAbsent = st.status === "absent";
        if (hasLog || isAbsent) completed += 1;
      }

      map[iso] = { completed, total };
    }

    return map;
  }, [gridDates, getSessionsForISO, getSessionStatus, logsBySessionId]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedISO]);

  const sessionsForSelectedDay = useMemo(() => getSessionsForISO(selectedISO), [getSessionsForISO, selectedISO]);

  const selectedDayStatus = completionByISO[selectedISO] || { completed: 0, total: 2 };

  // Auto-close day drawer once it becomes fully completed (armed only if it wasn't complete at open)
  useEffect(() => {
    if (!drawerOpen) return;
    if (!autoCloseArmed) return;
    if (selectedDayStatus.total > 0 && selectedDayStatus.completed >= selectedDayStatus.total) {
      setDrawerOpen(false);
      setActiveSessionId(null);
      setDetailsOpen(false);
      setAutoCloseArmed(false);
    }
  }, [drawerOpen, autoCloseArmed, selectedDayStatus.completed, selectedDayStatus.total]);

  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessionsForSelectedDay.find((s) => s.id === activeSessionId) || null;
  }, [activeSessionId, sessionsForSelectedDay]);

  const activeLog = useMemo(() => {
    if (!activeSessionId) return null;
    return logsBySessionId[activeSessionId] || null;
  }, [activeSessionId, logsBySessionId]);

  const feedbackDraft = useMemo<DraftState>(() => {
    const base = activeLog || {};
    return {
      difficulty: base?.effort ?? null,
      fatigue_end: base?.fatigue ?? base?.feeling ?? null,
      performance: base?.performance ?? base?.feeling ?? null,
      engagement: base?.engagement ?? base?.feeling ?? null,
      comment: String(base?.comments ?? ""),
      distanceMeters: Number.isFinite(Number(base?.distance)) ? Number(base.distance) : null,
    };
  }, [activeLog]);

  const [draftState, setDraftState] = useState<DraftState>(() => ({
    difficulty: null,
    fatigue_end: null,
    performance: null,
    engagement: null,
    comment: "",
    distanceMeters: null,
  }));

  useEffect(() => {
    // init distance on planned value if none exists yet
    if (activeSession) {
      const plannedMeters = kmToMeters(activeSession.km ?? 0);
      setDraftState((prev) => ({
        ...prev,
        ...feedbackDraft,
        distanceMeters: feedbackDraft.distanceMeters == null ? plannedMeters : feedbackDraft.distanceMeters,
      }));
      return;
    }
    setDraftState((prev) => ({ ...prev, ...feedbackDraft }));
  }, [feedbackDraft, activeSession]);

  const openDay = useCallback(
    (iso: string) => {
      setSelectedISO(iso);
      setDrawerOpen(true);
      setActiveSessionId(null);
      setDetailsOpen(false);

      const st = completionByISO[iso] || { completed: 0, total: 2 };
      setAutoCloseArmed(st.total > 0 && st.completed < st.total);
    },
    [completionByISO]
  );

  const closeDay = useCallback(() => {
    setDrawerOpen(false);
    setActiveSessionId(null);
    setDetailsOpen(false);
    setAutoCloseArmed(false);
  }, []);

  const prevMonth = useCallback(() => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const jumpToday = useCallback(() => {
    const t = new Date();
    setMonthCursor(startOfMonth(t));
    openDay(toISODate(t));
  }, [openDay]);

  const openSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setDetailsOpen(false);
  }, []);

  const markAbsent = useCallback(
    (sessionId: string) => {
      startTransition(() => {
        setAttendanceOverrideBySessionId((prev) => ({ ...prev, [sessionId]: "absent" }));
      });

      const existing = logsBySessionId[sessionId];
      if (existing?.id) deleteMutation.mutate(Number(existing.id));
    },
    [deleteMutation, logsBySessionId, startTransition]
  );

  const markPresent = useCallback(
    (sessionId: string) => {
      startTransition(() => {
        setAttendanceOverrideBySessionId((prev) => ({ ...prev, [sessionId]: "present" }));
      });
    },
    [startTransition]
  );

  const clearOverride = useCallback(
    (sessionId: string) => {
      startTransition(() => {
        setAttendanceOverrideBySessionId((prev) => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      });
    },
    [startTransition]
  );

  const dayOffAll = useCallback(() => {
    const idsToOff = sessionsForSelectedDay
      .map((s) => (getSessionStatus(s, selectedDate).expected ? s.id : null))
      .filter(Boolean) as string[];

    if (idsToOff.length === 0) return;

    startTransition(() => {
      setAttendanceOverrideBySessionId((prev) => {
        const next = { ...prev };
        for (const id of idsToOff) next[id] = "absent";
        return next;
      });

      setActiveSessionId(null);
      setDetailsOpen(false);
    });

    // delete existing backend logs for these slots
    idsToOff.forEach((sid) => {
      const existing = logsBySessionId[sid];
      if (existing?.id) deleteMutation.mutate(Number(existing.id));
    });
  }, [sessionsForSelectedDay, getSessionStatus, selectedDate, startTransition, logsBySessionId, deleteMutation]);

  const saveFeedback = useCallback(() => {
    if (!activeSessionId) return;
    if (!user) return;

    const allFilled = INDICATORS.every((i) => Number.isInteger(draftState[i.key]));
    if (!allFilled) return;

    const { iso, slotKey } = parseSessionId(activeSessionId);
    const slotLabel = slotKey === "PM" ? "Soir" : "Matin";

    const distance = clampToStep(Number(draftState.distanceMeters ?? 0), 100);
    const duration = clampToStep(Number(stableDurationMin), 15);

    const payload = {
      date: iso,
      slot: slotLabel,
      distance,
      duration,
      effort: Number(draftState.difficulty),
      feeling: Number(draftState.fatigue_end),
      performance: Number(draftState.performance),
      engagement: Number(draftState.engagement),
      comments: String(draftState.comment || "").slice(0, 400),
      athlete_name: user!,
      athlete_id: userId ?? undefined,
    };

    const existing = logsBySessionId[activeSessionId];

    startTransition(() => {
      setAttendanceOverrideBySessionId((prev) => ({ ...prev, [activeSessionId]: "present" }));
    });

    if (existing?.id) {
      updateMutation.mutate({ ...payload, id: existing.id });
    } else {
      mutation.mutate(payload);
    }

    // Close detail panel (like maquette)
    setActiveSessionId(null);
    setDetailsOpen(false);
  }, [activeSessionId, user, userId, draftState, stableDurationMin, logsBySessionId, startTransition, updateMutation, mutation]);

  const toggleDefaultPresence = useCallback((weekdayIdx: number, slotKey: SlotKey) => {
    setPresenceDefaults((prev) => ({
      ...prev,
      [weekdayIdx]: { ...prev[weekdayIdx], [slotKey]: !prev[weekdayIdx][slotKey] },
    }));
  }, []);

  const globalKm = useMemo(() => {
    const list = Array.isArray(sessions) ? sessions : [];
    let sumMeters = 0;

    for (const s of list) {
      const iso = String(s?.date ?? "").slice(0, 10);
      const slotKey: SlotKey = s?.slot === "Soir" ? "PM" : "AM";
      const sid = `${iso}__${slotKey}`;

      // ignore logs explicitly marked absent client-side
      if (attendanceOverrideBySessionId[sid] === "absent") continue;

      const weekday = weekdayMondayIndex(new Date(iso));
      const expected = Boolean(presenceDefaults?.[weekday]?.[slotKey]) || attendanceOverrideBySessionId[sid] === "present";
      if (!expected) continue;

      if (Number.isFinite(Number(s?.distance))) sumMeters += Number(s.distance);
    }

    return fmtKm(metersToKm(sumMeters));
  }, [sessions, attendanceOverrideBySessionId, presenceDefaults]);

  const dayKm = useMemo(() => {
    const planned = sessionsForSelectedDay;
    let sumMeters = 0;

    for (const p of planned) {
      const st = getSessionStatus(p, selectedDate);
      if (!st.expected) continue;
      if (st.status === "absent") continue;

      const log = logsBySessionId[p.id];
      if (log && Number.isFinite(Number(log?.distance))) sumMeters += Number(log.distance);
    }

    return fmtKm(metersToKm(sumMeters));
  }, [sessionsForSelectedDay, getSessionStatus, selectedDate, logsBySessionId]);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/*
        Mobile: keep a persistent header to anchor the club's visual identity.
        Desktop keeps the original in-flow header.
      */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center">
              <Waves className="h-5 w-5 text-zinc-900" />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-zinc-900">Suivi</div>
              <div className="text-[11px] text-zinc-500">{globalKm} km</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton onClick={() => setInfoOpen(true)} label="Infos">
              <Info className="h-5 w-5" />
            </IconButton>
            <IconButton onClick={() => setSettingsOpen(true)} label="Paramètres">
              <Settings2 className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 sm:px-4 pt-20 pb-5 sm:py-8">
        {/* Header épuré (desktop) */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center">
              <Waves className="h-5 w-5 text-zinc-900" />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-zinc-900">Suivi</div>
              <div className="text-[11px] text-zinc-500">{globalKm} km</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton onClick={() => setInfoOpen(true)} label="Infos">
              <Info className="h-5 w-5" />
            </IconButton>
            <IconButton onClick={() => setSettingsOpen(true)} label="Paramètres">
              <Settings2 className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        {/* Calendrier épuré */}
        <div className="mt-4 rounded-3xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-zinc-200">
            <div className="flex items-center gap-1">
              <IconButton onClick={prevMonth} label="Mois précédent">
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <IconButton onClick={nextMonth} label="Mois suivant">
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </div>

            <div className="min-w-0 text-center">
              <div className="text-base font-semibold text-zinc-900 capitalize truncate">{monthLabelFR(monthCursor)}</div>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    selectedDayStatus.total > 0 && selectedDayStatus.completed >= 1 ? "bg-emerald-600" : "bg-zinc-300"
                  )}
                />
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    selectedDayStatus.total > 0 && selectedDayStatus.completed >= 2 ? "bg-emerald-600" : "bg-zinc-300"
                  )}
                />
              </div>
            </div>

            <IconButton onClick={jumpToday} label="Aller à aujourd’hui" tone="neutral">
              <Circle className="h-5 w-5" />
            </IconButton>
          </div>

          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEKDAYS_FR_SHORT.map((wd, idx) => (
                <div key={wd + idx} className="px-0.5 pb-1 text-[10px] font-semibold text-zinc-400 text-center">
                  <span className="sm:hidden">{wd}</span>
                  <span className="hidden sm:inline">{WEEKDAYS_FR[idx]}</span>
                </div>
              ))}

              {gridDates.map((d) => {
                const iso = toISODate(d);
                const inMonth = d.getMonth() === monthCursor.getMonth();
                const isSel = iso === selectedISO;
                const status = completionByISO[iso] || { completed: 0, total: 2 };
                const isToday = isSameDay(d, today);
                return (
                  <CalendarCell
                    key={iso}
                    date={d}
                    inMonth={inMonth}
                    isToday={isToday}
                    isSelected={isSel}
                    status={status}
                    onClick={() => openDay(iso)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Modale infos */}
        <Modal open={infoOpen} title="Codes" onClose={() => setInfoOpen(false)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2">
              <span className="font-semibold">Orange</span>
              <span className="text-zinc-700">À compléter</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="font-semibold">Vert</span>
              <span className="text-zinc-700">Validé → km</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
              <span className="font-semibold">Bleu</span>
              <span className="text-zinc-700">Absent / Non prévu</span>
            </div>
            <div className="text-xs text-zinc-500">Les km comptent uniquement après validation.</div>
          </div>
        </Modal>

        {/* Paramètres (compact) */}
        <Modal open={settingsOpen} title="Présence" onClose={() => setSettingsOpen(false)}>
          <div className="space-y-3">
            <div className="text-xs text-zinc-500">Toggle hebdo (séances attendues).</div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="grid grid-cols-[1fr_110px_110px] bg-zinc-50 border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500">
                <div>Jour</div>
                <div className="text-center">Matin</div>
                <div className="text-center">Soir</div>
              </div>
              {WEEKDAYS_FR.map((wd, idx) => (
                <div key={wd} className={cn("grid grid-cols-[1fr_110px_110px] items-center px-3 py-2", idx !== 6 && "border-b border-zinc-100")}>
                  <div className="text-sm font-medium text-zinc-900">{wd}</div>
                  {SLOTS.map((s) => {
                    const on = Boolean(presenceDefaults?.[idx]?.[s.key]);
                    return (
                      <div key={s.key} className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => toggleDefaultPresence(idx, s.key)}
                          className={cn(
                            "w-24 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                            on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50"
                          )}
                          aria-label={`${wd} ${s.label}`}
                        >
                          {on ? "On" : "Off"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Hidden stable duration (backend requirement) */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-xs font-semibold text-zinc-700">Durée (valeur par défaut)</div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 w-9 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-center"
                  onClick={() => setStableDurationMin((v) => Math.max(30, v - 15))}
                  aria-label="Diminuer la durée"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold text-zinc-900">{stableDurationMin} min</div>
                <button
                  type="button"
                  className="h-9 w-9 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-center"
                  onClick={() => setStableDurationMin((v) => Math.min(240, v + 15))}
                  aria-label="Augmenter la durée"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Durée envoyée au back-end (non affichée dans la maquette).
              </div>
            </div>
          </div>
        </Modal>

        {/* Drawer Jour */}
        <Drawer open={drawerOpen} title={dayLabelFR(selectedDate)} onClose={closeDay}>
          {/* Header jour minimal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl border border-zinc-200 bg-white flex items-center justify-center">
                <Waves className="h-5 w-5 text-zinc-900" />
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-zinc-900">{dayKm} km</div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      selectedDayStatus.total > 0 && selectedDayStatus.completed >= 1 ? "bg-emerald-600" : "bg-zinc-300"
                    )}
                  />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      selectedDayStatus.total > 0 && selectedDayStatus.completed >= 2 ? "bg-emerald-600" : "bg-zinc-300"
                    )}
                  />
                </div>
              </div>
            </div>

            <IconButton onClick={dayOffAll} label="OFF (absent journée)" tone="dark" disabled={isPending}>
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
                ? "bg-emerald-50 border-emerald-200"
                : isAbsentLike
                ? "bg-sky-50 border-sky-200"
                : needsAction
                ? "bg-orange-50 border-orange-200"
                : "bg-white border-zinc-200";

              const SlotIcon = SLOTS.find((x) => x.key === s.slotKey)?.Icon || Circle;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSession(s.id)}
                  className={cn("w-full rounded-3xl border px-3 py-3 text-left transition", bg, "hover:shadow-sm")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-2xl border flex items-center justify-center",
                          hasLog
                            ? "border-emerald-200 bg-emerald-100"
                            : isAbsentLike
                            ? "border-sky-200 bg-sky-100"
                            : needsAction
                            ? "border-orange-200 bg-orange-100"
                            : "border-zinc-200 bg-zinc-100"
                        )}
                      >
                        <SlotIcon className="h-5 w-5 text-zinc-900" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">{s.title}</div>
                        <div className="mt-1 flex items-center gap-2">
                          {s.isEmpty ? <Chip>Vide</Chip> : <Chip>{fmtKm(s.km)} km</Chip>}
                          {hasLog && (
                            <span className="inline-flex items-center text-emerald-800">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                          {isAbsentLike && !hasLog && (
                            <span className="inline-flex items-center text-sky-800">
                              <UserX className="h-4 w-4" />
                            </span>
                          )}
                          {needsAction && (
                            <span className="inline-flex items-center text-orange-900">
                              <Circle className="h-4 w-4" />
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
                            markPresent(s.id);
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
                            markAbsent(s.id);
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
                transition={{ duration: 0.18 }}
                className="mt-4 rounded-3xl border border-zinc-200 bg-white overflow-hidden"
              >
                {(() => {
                  const st = getSessionStatus(activeSession, selectedDate);
                  const isAbsentOverride = st.status === "absent";
                  const isNotExpected = st.status === "not_expected";
                  const hasLog = Boolean(logsBySessionId[activeSession.id]);
                  const canRate = st.expected && !isAbsentOverride;

                  const leftActionLabel = isAbsentOverride ? "Annuler" : isNotExpected ? "Je suis venu" : "Absent";

                  const leftActionFn = isAbsentOverride
                    ? () => clearOverride(activeSession.id)
                    : isNotExpected
                    ? () => markPresent(activeSession.id)
                    : () => markAbsent(activeSession.id);

                  const plannedMeters = kmToMeters(activeSession.km ?? 0);

                  return (
                    <>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-900">{activeSession.title}</div>
                          <div className="mt-1 flex items-center gap-2">
                            {activeSession.isEmpty ? <Chip>Vide</Chip> : <Chip>{fmtKm(activeSession.km)} km</Chip>}
                            {hasLog ? (
                              <span className="inline-flex items-center text-emerald-800">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : isAbsentOverride || isNotExpected ? (
                              <span className="inline-flex items-center text-sky-800">
                                <UserX className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-orange-900">
                                <Circle className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        </div>

                        <IconButton
                          onClick={() => {
                            setActiveSessionId(null);
                            setDetailsOpen(false);
                          }}
                          label="Retour"
                        >
                          <X className="h-5 w-5" />
                        </IconButton>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-3">
                        <button
                          type="button"
                          onClick={leftActionFn}
                          className={cn(
                            "rounded-2xl px-3 py-3 text-sm font-semibold border transition inline-flex items-center justify-center gap-2",
                            isNotExpected ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800" : "bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50"
                          )}
                        >
                          {isNotExpected ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                          {leftActionLabel}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDetailsOpen((v) => !v)}
                          className="rounded-2xl px-3 py-3 text-sm font-semibold border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center justify-center gap-2"
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
                            transition={{ duration: 0.16 }}
                            className="mx-3 mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                          >
                            {activeSession.details?.length ? (
                              <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-800">
                                {activeSession.details.map((line, idx) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-sm text-zinc-600">
                                {activeSession.assignmentId ? "Séance coach — détails dans la fiche." : "Aucun détail pour ce créneau."}
                              </div>
                            )}

                            {activeSession.assignmentId ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => setLocation(`/swim-session?assignmentId=${activeSession.assignmentId}`)}
                                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
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
                            {isAbsentOverride ? "Absent: aucun ressenti." : "Non prévu: appuyez “Je suis venu”."}
                          </div>
                        )}

                        <div className="space-y-4">
                          {INDICATORS.map((ind) => {
                            const selected = draftState[ind.key];
                            return (
                              <div key={ind.key} className="space-y-2">
                                <div className={cn("text-sm font-semibold", !canRate ? "text-zinc-500" : "text-zinc-900")}>{ind.label}</div>
                                <div className="flex items-center gap-2">
                                  {[1, 2, 3, 4, 5].map((n) => {
                                    const isSel = selected === n;
                                    return (
                                      <button
                                        key={n}
                                        type="button"
                                        disabled={!canRate}
                                        onClick={() => setDraftState((p) => ({ ...p, [ind.key]: n }))}
                                        className={cn(
                                          "h-11 w-11 rounded-2xl border text-sm font-semibold transition",
                                          !canRate
                                            ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                                            : isSel
                                            ? valueTone(ind.mode, n)
                                            : "bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50"
                                        )}
                                      >
                                        {n}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          <div className="space-y-2">
                            <div className={cn("text-sm font-semibold", !canRate ? "text-zinc-500" : "text-zinc-900")}>Commentaire</div>
                            <textarea
                              value={draftState.comment}
                              onChange={(e) => setDraftState((p) => ({ ...p, comment: e.target.value }))}
                              disabled={!canRate}
                              rows={3}
                              placeholder="Sensations, points techniques…"
                              className={cn(
                                "w-full resize-none rounded-3xl border px-4 py-3 text-sm outline-none",
                                !canRate
                                  ? "bg-zinc-100 text-zinc-400 border-zinc-200"
                                  : "bg-white text-zinc-900 border-zinc-200 focus:ring-2 focus:ring-zinc-900/10"
                              )}
                            />
                          </div>
                        </div>

                        {/* Stepper distance (±100m) */}
                        <DistanceStepper
                          plannedMeters={plannedMeters}
                          valueMeters={draftState.distanceMeters}
                          onChange={(m) => setDraftState((p) => ({ ...p, distanceMeters: m }))}
                          disabled={!canRate}
                        />

                        <div className="mt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={saveFeedback}
                            disabled={isPending || !canRate || !INDICATORS.every((i) => Number.isInteger(draftState[i.key]))}
                            className={cn(
                              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                              isPending || !canRate
                                ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                                : INDICATORS.every((i) => Number.isInteger(draftState[i.key]))
                                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                                : "bg-emerald-200 text-emerald-900/70 cursor-not-allowed"
                            )}
                          >
                            Valider
                          </button>
                          <div className="text-xs text-zinc-500">→ km</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </Drawer>
      </div>
    </div>
  );
}

// --- Self-tests (dev only) ---
function runSelfTests() {
  console.assert(fmtKm(3.0) === "3", "fmtKm should drop trailing .0");
  console.assert(fmtKm(4.25) === "4.25", "fmtKm should keep decimals");
  console.assert(fmtKm("bad") === "—", "fmtKm should handle NaN");

  const p = parseSessionId("2026-01-09__AM");
  console.assert(p.iso === "2026-01-09", "parseSessionId should extract iso");
  console.assert(p.slotKey === "AM", "parseSessionId should extract slotKey");

  const monday = new Date(2026, 0, 5);
  console.assert(weekdayMondayIndex(monday) === 0, "weekdayMondayIndex should map Monday to 0");

  console.assert(valueTone("hard", 5).includes("red"), "hard 5 should be red-ish");
  console.assert(valueTone("good", 5).includes("emerald"), "good 5 should be green-ish");

  console.assert(kmToMeters(1.2) === 1200, "kmToMeters should convert");
  console.assert(metersToKm(1200) === 1.2, "metersToKm should convert");
}

if (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env.DEV) {
  runSelfTests();
}

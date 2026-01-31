import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Maquette mobile-first — Pointage shifts
 *
 * Objectifs:
 * - Saisie ultra rapide (bottom sheet ouvert par défaut)
 * - Début/Fin via roues (heures + minutes par pas de 5)
 * - Trajet = attribut du shift "travail" (isTravel)
 * - Lieux issus d'une liste fixe mais éditable (UI "coach")
 * - Dashboard : sélection d'une période (Du / Au)
 */

type Shift = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  placeId: string;
  isTravel: boolean;
  comment?: string;
};

type Place = {
  id: string;
  name: string;
  archived?: boolean;
};

type Tab = "POINTAGE" | "DASHBOARD";

const pad2 = (n: number) => String(n).padStart(2, "0");

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function uid() {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function minutesToHM(totalMinutes: number): string {
  const m = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(h)}:${pad2(mm)}`;
}

function addMinutesToHM(hm: string, minutes: number): string {
  return minutesToHM(hmToMinutes(hm) + minutes);
}

function durationMinutes(start: string, end: string): number {
  const s = hmToMinutes(start);
  const e = hmToMinutes(end);
  return e >= s ? e - s : 24 * 60 - s + e;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${pad2(m)}`;
}

function startOfWeekISO(d: Date) {
  const day = (d.getDay() + 6) % 7; // monday=0
  const copy = new Date(d);
  copy.setDate(d.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date) {
  const copy = new Date(d);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function splitHM(hm: string): { h: number; m: number } {
  const [h0, m0] = hm.split(":").map((x) => Number(x));
  const h = clamp(Number.isFinite(h0) ? h0 : 0, 0, 23);
  const m = clamp(Number.isFinite(m0) ? m0 : 0, 0, 59);
  return { h, m };
}

function clampTo5(m: number): number {
  const rounded = Math.round(m / 5) * 5;
  return clamp(rounded, 0, 55);
}

function nowRounded5HM(): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  const rounded = Math.round(m / 5) * 5;
  const carry = rounded === 60 ? 1 : 0;
  const mm = rounded === 60 ? 0 : rounded;
  const hh = (h + carry) % 24;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function ymdStr(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function withinRangeYMD(d: string, from: string, to: string) {
  const dd = ymdToDate(d).getTime();
  const f = ymdToDate(from).getTime();
  const t = ymdToDate(to).getTime();
  const lo = Math.min(f, t);
  const hi = Math.max(f, t);
  return dd >= lo && dd <= hi;
}

const seedPlaces: Place[] = [
  { id: "p1", name: "Piscine" },
  { id: "p2", name: "Bureau" },
  { id: "p3", name: "Client A" },
  { id: "p4", name: "Client B" },
  { id: "p5", name: "Dépôt" },
  { id: "p6", name: "Télétravail" },
];

/**
 * WheelPicker optimisé mobile:
 * - compact
 * - fluide (rAF + état local, commit à la fin du scroll)
 * - contraste fort sur la valeur sélectionnée
 * - lock horizontal (pan-y)
 */
function WheelPicker({
  value,
  values,
  onChange,
  label,
  width = 68,
  itemHeight = 28,
  visibleCount = 3,
  format,
  snapOnOpenKey,
}: {
  value: number;
  values: number[];
  onChange: (v: number) => void;
  label?: string;
  width?: number;
  itemHeight?: number;
  visibleCount?: number;
  format?: (v: number) => string;
  snapOnOpenKey?: string | number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const paddingTopBottom = Math.floor(visibleCount / 2) * itemHeight;

  const [localValue, setLocalValue] = useState<number>(value);
  const localRef = useRef<number>(value);
  const valueRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const endTimerRef = useRef<number | null>(null);
  const interactingRef = useRef<boolean>(false);

  useEffect(() => {
    valueRef.current = value;
    localRef.current = value;
    setLocalValue(value);

    const el = ref.current;
    if (!el) return;
    if (interactingRef.current) return;
    const idx = Math.max(0, values.indexOf(value));
    el.scrollTo({ top: idx * itemHeight, behavior: "instant" as any });
  }, [value, values, itemHeight]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, values.indexOf(value));
    el.scrollTo({ top: idx * itemHeight, behavior: "instant" as any });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapOnOpenKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const idx = Math.round(el.scrollTop / itemHeight);
      const v = values[Math.max(0, Math.min(values.length - 1, idx))];
      localRef.current = v;
      setLocalValue(v);
    };

    const commit = () => {
      const v = localRef.current;
      if (v !== valueRef.current) onChange(v);
      interactingRef.current = false;
    };

    const onScroll = () => {
      interactingRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);

      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
      endTimerRef.current = window.setTimeout(commit, 140);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    };
  }, [itemHeight, onChange, values]);

  return (
    <div style={{ width, flex: `0 0 ${width}px`, minWidth: 0 }}>
      {label && (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, fontWeight: 800 }}>{label}</div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: paddingTopBottom,
            background: "linear-gradient(#fff, rgba(255,255,255,0))",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: paddingTopBottom,
            background: "linear-gradient(rgba(255,255,255,0), #fff)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            top: paddingTopBottom,
            height: itemHeight,
            background: "rgba(17,17,17,0.14)",
            borderRadius: 10,
            boxShadow: "inset 0 0 0 1px rgba(17,17,17,0.25)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div
          ref={ref}
          style={{
            height: itemHeight * visibleCount,
            overflowY: "auto",
            overflowX: "hidden",
            scrollSnapType: "y mandatory",
            scrollSnapStop: "always",
            WebkitOverflowScrolling: "touch",
            paddingTop: paddingTopBottom,
            paddingBottom: paddingTopBottom,
            touchAction: "pan-y",
            overscrollBehavior: "contain",
          }}
        >
          {values.map((v) => {
            const selected = v === localValue;
            return (
              <div
                key={v}
                style={{
                  height: itemHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  scrollSnapAlign: "center",
                  fontWeight: selected ? 900 : 700,
                  fontSize: 15,
                  color: selected ? "#111" : "#9ca3af",
                  userSelect: "none",
                }}
              >
                {format ? format(v) : String(v)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FloatingField({
  label,
  valuePresent,
  children,
}: {
  label: string;
  valuePresent: boolean;
  children: (args: { onFocus: () => void; onBlur: () => void; id: string }) => React.ReactNode;
}) {
  const id = useMemo(() => `ff-${uid()}`, []);
  const [focused, setFocused] = useState(false);
  const active = focused || valuePresent;

  return (
    <div style={{ position: "relative" }}>
      <label
        htmlFor={id}
        style={{
          position: "absolute",
          left: 12,
          top: active ? 6 : 14,
          transformOrigin: "left top",
          transform: active ? "scale(0.85)" : "scale(1)",
          transition: "all 140ms ease",
          color: active ? "#111" : "#6b7280",
          fontWeight: active ? 900 : 800,
          fontSize: 12,
          background: "#fff",
          padding: active ? "0 6px" : "0 0",
          borderRadius: 6,
          pointerEvents: "none",
        }}
      >
        {label}
      </label>
      {children({
        id,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      })}
    </div>
  );
}

function FloatingInput({
  label,
  type,
  value,
  onChange,
  style,
}: {
  label: string;
  type: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <FloatingField label={label} valuePresent={!!value}>
      {({ id, onFocus, onBlur }) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            width: "100%",
            padding: "20px 12px 10px",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            fontSize: 16,
            outline: "none",
            boxSizing: "border-box",
            background: "#fff",
            ...style,
          }}
        />
      )}
    </FloatingField>
  );
}

function FloatingSelect({
  label,
  value,
  onChange,
  children,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <FloatingField label={label} valuePresent={!!value}>
      {({ id, onFocus, onBlur }) => (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            width: "100%",
            padding: "20px 12px 10px",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            fontSize: 16,
            outline: "none",
            background: "#fff",
            boxSizing: "border-box",
            ...style,
          }}
        >
          {children}
        </select>
      )}
    </FloatingField>
  );
}

function FloatingTextarea({
  label,
  value,
  onChange,
  minHeight = 96,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
}) {
  return (
    <FloatingField label={label} valuePresent={!!value}>
      {({ id, onFocus, onBlur }) => (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            width: "100%",
            padding: "22px 12px 10px",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            background: "#fff",
            minHeight,
            resize: "vertical",
          }}
        />
      )}
    </FloatingField>
  );
}

// —— Micro “tests” runtime (sans framework) ——
(() => {
  if (typeof console === "undefined") return;
  console.assert(minutesToHM(0) === "00:00", "minutesToHM(0)");
  console.assert(minutesToHM(65) === "01:05", "minutesToHM(65)");
  console.assert(addMinutesToHM("23:50", 20) === "00:10", "wrap midnight");
  console.assert(durationMinutes("23:50", "00:10") === 20, "duration across midnight");
  console.assert(durationMinutes("08:00", "08:00") === 0, "zero duration");
  console.assert(addMinutesToHM("00:00", -5) === "23:55", "negative add wrap");
  console.assert(clampTo5(58) === 55, "clampTo5 upper");
  console.assert(clampTo5(2) === 0, "clampTo5 lower");
  console.assert(durationMinutes("10:00", "09:55") === 23 * 60 + 55, "duration wraps (end < start)");
  console.assert(minutesToHM(24 * 60 + 5) === "00:05", "minutesToHM wraps");
  console.assert(hmToMinutes("00:00") === 0, "hmToMinutes 00:00");
  console.assert(hmToMinutes("10:05") === 605, "hmToMinutes 10:05");
  // nouveaux tests
  console.assert(withinRangeYMD("2026-01-05", "2026-01-01", "2026-01-31") === true, "withinRangeYMD in");
  console.assert(withinRangeYMD("2026-02-01", "2026-01-01", "2026-01-31") === false, "withinRangeYMD out");
})();

export default function ShiftAppMock() {
  const [tab, setTab] = useState<Tab>("POINTAGE");

  const [places, setPlaces] = useState<Place[]>(seedPlaces);
  const [recentPlaceIds, setRecentPlaceIds] = useState<string[]>(["p1"]);
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const d = todayYMD();
    return [
      {
        id: uid(),
        date: d,
        start: "12:30",
        end: "17:30",
        placeId: "p1",
        isTravel: false,
        comment: "",
      },
      {
        id: uid(),
        date: d,
        start: "18:10",
        end: "19:00",
        placeId: "p2",
        isTravel: true,
        comment: "",
      },
    ];
  });

  const [sheetOpen, setSheetOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managePlacesOpen, setManagePlacesOpen] = useState(false);
  const [compactTotals, setCompactTotals] = useState(true);

  // Dashboard period (defaults: début du mois -> aujourd'hui)
  const now = useMemo(() => new Date(), []);
  const [dashFrom, setDashFrom] = useState<string>(ymdStr(startOfMonth(now)));
  const [dashTo, setDashTo] = useState<string>(todayYMD());

  const initialNow = useMemo(() => nowRounded5HM(), []);
  const [date, setDate] = useState(todayYMD());

  const [startHour, setStartHour] = useState(splitHM(initialNow).h);
  const [startMin, setStartMin] = useState(clampTo5(splitHM(initialNow).m));
  const [endHour, setEndHour] = useState(splitHM(addMinutesToHM(initialNow, 60)).h);
  const [endMin, setEndMin] = useState(clampTo5(splitHM(addMinutesToHM(initialNow, 60)).m));

  const [placeId, setPlaceId] = useState<string>(recentPlaceIds[0] ?? "");
  const [isTravel, setIsTravel] = useState(false);
  const [commentEnabled, setCommentEnabled] = useState(false);
  const [comment, setComment] = useState("");

  const [placeQuery, setPlaceQuery] = useState("");
  const [newPlaceName, setNewPlaceName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activePlaces = useMemo(() => places.filter((p) => !p.archived), [places]);

  const filteredPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return activePlaces;
    return activePlaces.filter((p) => p.name.toLowerCase().includes(q));
  }, [placeQuery, activePlaces]);

  const archivedPlaces = useMemo(() => places.filter((p) => p.archived), [places]);

  const recentPlaces = useMemo(() => {
    const map = new Map(places.map((p) => [p.id, p] as const));
    return recentPlaceIds
      .map((id) => map.get(id))
      .filter((p): p is Place => !!p && !p.archived);
  }, [recentPlaceIds, places]);

  useEffect(() => {
    if (!placeId) return;
    const p = places.find((x) => x.id === placeId && !x.archived);
    if (!p) {
      const firstActive = places.find((x) => !x.archived);
      setPlaceId(firstActive?.id ?? "");
    }
  }, [places, placeId]);

  // Re-snap wheels when opening sheet
  const snapKey = useMemo(() => (sheetOpen ? Date.now() : 0), [sheetOpen]);

  // Important: quand on édite un shift, ne PAS réinitialiser les roues à "maintenant".
  const prevSheetOpen = useRef<boolean>(sheetOpen);
  useEffect(() => {
    const wasOpen = prevSheetOpen.current;
    prevSheetOpen.current = sheetOpen;
    if (sheetOpen && !wasOpen && !editingId) {
      const n = nowRounded5HM();
      const { h, m } = splitHM(n);
      setStartHour(h);
      setStartMin(clampTo5(m));
      const end = addMinutesToHM(n, 60);
      const e = splitHM(end);
      setEndHour(e.h);
      setEndMin(clampTo5(e.m));
    }
  }, [sheetOpen, editingId]);

  const startHM = useMemo(() => `${pad2(startHour)}:${pad2(startMin)}`, [startHour, startMin]);
  const endHM = useMemo(() => `${pad2(endHour)}:${pad2(endMin)}`, [endHour, endMin]);

  const totals = useMemo(() => {
    const now2 = new Date();
    const weekStart = startOfWeekISO(now2);
    const today = todayYMD();

    let todayWork = 0,
      todayTravel = 0;
    let weekWork = 0,
      weekTravel = 0;
    let monthWork = 0,
      monthTravel = 0;

    for (const s of shifts) {
      const mins = durationMinutes(s.start, s.end);
      const sd = ymdToDate(s.date);

      const addWork = !s.isTravel ? mins : 0;
      const addTravel = s.isTravel ? mins : 0;

      if (s.date === today) {
        todayWork += addWork;
        todayTravel += addTravel;
      }

      if (sd >= weekStart) {
        weekWork += addWork;
        weekTravel += addTravel;
      }

      if (isSameMonth(sd, now2)) {
        monthWork += addWork;
        monthTravel += addTravel;
      }
    }

    return { todayWork, todayTravel, weekWork, weekTravel, monthWork, monthTravel };
  }, [shifts]);

  const placeName = useMemo(() => {
    const map = new Map(places.map((p) => [p.id, p.name] as const));
    return (id: string) => map.get(id) ?? "(Lieu supprimé)";
  }, [places]);

  const grouped = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    for (const [k, list] of map) {
      list.sort((a, b) => hmToMinutes(a.start) - hmToMinutes(b.start));
      map.set(k, list);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return keys.map((k) => {
      const items = map.get(k)!;
      const totalDay = items.reduce((acc, s) => acc + durationMinutes(s.start, s.end), 0);
      return { date: k, items, totalDay };
    });
  }, [shifts]);

  const dashboardTotals = useMemo(() => {
    const inRange = shifts.filter((s) => withinRangeYMD(s.date, dashFrom, dashTo));
    const work = inRange.reduce((acc, s) => acc + (!s.isTravel ? durationMinutes(s.start, s.end) : 0), 0);
    const travel = inRange.reduce((acc, s) => acc + (s.isTravel ? durationMinutes(s.start, s.end) : 0), 0);
    return {
      count: inRange.length,
      work,
      travel,
      total: work + travel,
    };
  }, [shifts, dashFrom, dashTo]);

  function openAdd() {
    setEditingId(null);
    setDate(todayYMD());
    setIsTravel(false);
    setCommentEnabled(false);
    setComment("");
    setPlaceId(recentPlaceIds[0] ?? activePlaces[0]?.id ?? "");
    setSheetOpen(true);
  }

  function saveShift() {
    if (!placeId) {
      alert("Choisis un lieu.");
      return;
    }

    if (editingId) {
      setShifts((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, date, start: startHM, end: endHM, placeId, isTravel, comment: commentEnabled ? comment.trim() : "" }
            : s
        )
      );
    } else {
      const s: Shift = {
        id: uid(),
        date,
        start: startHM,
        end: endHM,
        placeId,
        isTravel,
        comment: commentEnabled ? comment.trim() : "",
      };
      setShifts((prev) => [...prev, s]);
    }

    setRecentPlaceIds((prev) => [placeId, ...prev.filter((x) => x !== placeId)].slice(0, 5));
    setEditingId(null);
    setSheetOpen(false);
  }

  function removeShift(id: string) {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function editShift(s: Shift) {
    setEditingId(s.id);
    setDate(s.date);

    const sh = splitHM(s.start);
    const eh = splitHM(s.end);

    setStartHour(sh.h);
    setStartMin(clampTo5(sh.m));
    setEndHour(eh.h);
    setEndMin(clampTo5(eh.m));

    setPlaceId(s.placeId);
    setIsTravel(s.isTravel);
    setCommentEnabled(!!s.comment);
    setComment(s.comment ?? "");

    setSheetOpen(true);
  }

  function addPlace() {
    const name = newPlaceName.trim();
    if (!name) return;

    const exists = places.some((p) => !p.archived && p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert("Ce lieu existe déjà.");
      return;
    }

    const p: Place = { id: uid(), name };
    setPlaces((prev) => [p, ...prev]);
    setNewPlaceName("");
    setRecentPlaceIds((prev) => [p.id, ...prev.filter((x) => x !== p.id)].slice(0, 5));
  }

  function archivePlace(id: string) {
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true } : p)));
    setRecentPlaceIds((prev) => prev.filter((x) => x !== id));
  }

  function unarchivePlace(id: string) {
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, archived: false } : p)));
  }

  function startRename(p: Place) {
    setRenamingId(p.id);
    setRenameValue(p.name);
  }

  function commitRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) return;

    const exists = places.some(
      (p) => p.id !== renamingId && !p.archived && p.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      alert("Un autre lieu porte déjà ce nom.");
      return;
    }

    setPlaces((prev) => prev.map((p) => (p.id === renamingId ? { ...p, name } : p)));
    setRenamingId(null);
    setRenameValue("");
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      padding: 16,
      maxWidth: 920,
      margin: "0 auto",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      color: "#111",
      overflowX: "hidden",
    },
    topbar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },
    brand: { fontWeight: 900, letterSpacing: 0.2 },
    tabs: {
      display: "flex",
      gap: 8,
      background: "#fff",
      border: "1px solid #eee",
      borderRadius: 999,
      padding: 4,
      flex: "0 0 auto",
    },
    tabBtn: (active: boolean) => ({
      border: "none",
      borderRadius: 999,
      padding: "8px 12px",
      background: active ? "#111" : "transparent",
      color: active ? "#fff" : "#111",
      fontWeight: 800,
      fontSize: 13,
      cursor: "pointer",
    }),
    pillBtn: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      borderRadius: 999,
      padding: "8px 10px",
      fontSize: 13,
      cursor: "pointer",
      fontWeight: 700,
    },
    card: {
      border: "1px solid #eee",
      borderRadius: 16,
      padding: 12,
      background: "#fff",
      boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
      marginBottom: 12,
    },
    small: { fontSize: 12, color: "#6b7280" },
    strong: { fontWeight: 900 },
    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
    listCard: {
      border: "1px solid #eee",
      borderRadius: 16,
      background: "#fff",
      boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
      overflow: "hidden",
      marginBottom: 72,
    },
    dayHeader: {
      padding: "10px 12px",
      background: "#fafafa",
      borderBottom: "1px solid #eee",
      fontWeight: 900,
      fontSize: 13,
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
    },
    item: {
      padding: 12,
      borderBottom: "1px solid #f1f1f1",
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    },
    badge: (travel: boolean) => ({
      fontSize: 11,
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid #eee",
      background: travel ? "#fff7ed" : "#eff6ff",
      whiteSpace: "nowrap" as const,
      height: "fit-content",
    }),
    itemMain: { flex: 1, minWidth: 0 },
    itemTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" },
    itemTime: { fontWeight: 900 },
    itemPlace: { fontSize: 13, color: "#374151", marginTop: 2 },
    itemComment: { fontSize: 12, color: "#6b7280", marginTop: 6 },
    actions: { display: "flex", gap: 6, flexWrap: "wrap" as const, justifyContent: "flex-end" },
    btn: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      borderRadius: 10,
      padding: "6px 10px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    },
    fab: {
      position: "fixed",
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 999,
      border: "none",
      background: "#dc2626",
      color: "#fff",
      fontSize: 26,
      fontWeight: 900,
      boxShadow: "0 8px 20px rgba(220,38,38,0.25)",
      cursor: "pointer",
      zIndex: 10,
    },
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      padding: 12,
      zIndex: 50,
      overflow: "hidden",
    },
    sheet: {
      width: "100%",
      maxWidth: 820,
      background: "#fff",
      borderRadius: 20,
      boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
      overflow: "hidden",
    },
    grabber: { width: 44, height: 5, borderRadius: 999, background: "#e5e7eb", margin: "10px auto 6px" },
    sheetHeader: {
      padding: "0 12px 10px",
      fontWeight: 900,
    },
    sheetBody: { padding: 12, overflowX: "hidden" },
    labelStrong: { fontSize: 12, fontWeight: 900, color: "#111", marginBottom: 6 },
    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid #e5e7eb",
      fontSize: 16,
      outline: "none",
      boxSizing: "border-box",
    },
    seg: { display: "flex", gap: 8 },
    segBtn: (active: boolean) => ({
      flex: 1,
      padding: "10px 10px",
      borderRadius: 14,
      border: `1px solid ${active ? "#111" : "#e5e7eb"}`,
      background: active ? "#111" : "#fff",
      color: active ? "#fff" : "#111",
      fontSize: 13,
      fontWeight: 900,
      cursor: "pointer",
      textAlign: "center" as const,
    }),
    quickRow: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 10 },
    quickBtn: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      borderRadius: 999,
      padding: "8px 10px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 800,
    },
    footer: { display: "flex", gap: 10, padding: 12, borderTop: "1px solid #eee" },
    primary: {
      flex: 1,
      border: "none",
      background: "#dc2626",
      color: "#fff",
      borderRadius: 14,
      padding: "12px 14px",
      fontSize: 14,
      fontWeight: 900,
      cursor: "pointer",
    },
    ghost: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      borderRadius: 14,
      padding: "12px 14px",
      fontSize: 14,
      fontWeight: 900,
      cursor: "pointer",
    },
    divider: { height: 1, background: "#eee", margin: "10px 0" },
    kpiCard: {
      border: "1px dashed #e5e7eb",
      borderRadius: 16,
      padding: 14,
      background: "#fff",
      boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
      marginBottom: 12,
    },
  };

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes5 = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  const fmtLongDate = useMemo(
    () => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    []
  );

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.brand}>ADMINISTRATIF</div>
        <div style={styles.tabs}>
          <button style={styles.tabBtn(tab === "POINTAGE")} onClick={() => setTab("POINTAGE")}>
            Pointage
          </button>
          <button style={styles.tabBtn(tab === "DASHBOARD")} onClick={() => setTab("DASHBOARD")}>
            Dashboard
          </button>
        </div>
      </div>

      {tab === "POINTAGE" ? (
        <React.Fragment>
          <div style={styles.card}>
            <div style={styles.rowBetween}>
              <div>
                <div style={styles.small}>Aujourd’hui</div>
                <div style={styles.strong}>{formatDuration(totals.todayWork + totals.todayTravel)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={styles.pillBtn} onClick={() => setCompactTotals((v) => !v)}>
                {compactTotals ? "Totaux ▾" : "Totaux ▴"}
              </button>
              <button style={styles.pillBtn} onClick={() => setManagePlacesOpen(true)}>
                Gérer les lieux
              </button>
            </div>

            {!compactTotals && (
              <React.Fragment>
                <div style={styles.divider} />
                <div style={styles.rowBetween}>
                  <div>
                    <div style={styles.small}>Semaine</div>
                    <div style={styles.strong}>
                      Travail {formatDuration(totals.weekWork)} • Trajet {formatDuration(totals.weekTravel)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={styles.small}>Total</div>
                    <div style={styles.strong}>{formatDuration(totals.weekWork + totals.weekTravel)}</div>
                  </div>
                </div>
                <div style={{ height: 10 }} />
                <div style={styles.rowBetween}>
                  <div>
                    <div style={styles.small}>Mois</div>
                    <div style={styles.strong}>
                      Travail {formatDuration(totals.monthWork)} • Trajet {formatDuration(totals.monthTravel)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={styles.small}>Total</div>
                    <div style={styles.strong}>{formatDuration(totals.monthWork + totals.monthTravel)}</div>
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>

          <div style={styles.listCard}>
            {grouped.length === 0 ? (
              <div style={{ padding: 16, color: "#6b7280", fontSize: 13 }}>Aucun shift pour l’instant.</div>
            ) : (
              grouped.map((g) => (
                <div key={g.date}>
                  <div style={styles.dayHeader}>
                    <span style={{ textTransform: "capitalize" }}>{fmtLongDate.format(ymdToDate(g.date))}</span>
                    <span style={{ color: "#111" }}>{formatDuration(g.totalDay)}</span>
                  </div>

                  {g.items.map((s) => {
                    const mins = durationMinutes(s.start, s.end);
                    return (
                      <div key={s.id} style={styles.item}>
                        <div style={styles.badge(s.isTravel)}>{s.isTravel ? "Trajet" : "Travail"}</div>
                        <div style={styles.itemMain}>
                          <div style={styles.itemTop}>
                            <div style={styles.itemTime}>
                              {s.start} → {s.end} <span style={styles.small}>({formatDuration(mins)})</span>
                            </div>
                            <div style={styles.actions}>
                              <button style={styles.btn} onClick={() => editShift(s)} type="button">
                                Modifier
                              </button>
                              <button style={styles.btn} onClick={() => removeShift(s.id)} type="button">
                                Suppr.
                              </button>
                            </div>
                          </div>
                          <div style={styles.itemPlace}>{placeName(s.placeId)}</div>
                          {!!s.comment && <div style={styles.itemComment}>{s.comment}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <button style={styles.fab} onClick={openAdd} aria-label="Ajouter un shift" type="button">
            +
          </button>

          {sheetOpen && (
            <div style={styles.overlay} onClick={() => {
              setSheetOpen(false);
              setEditingId(null);
            }}>
              <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div style={styles.grabber} />

                <div
                  style={{
                    ...styles.sheetHeader,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gridTemplateRows: "auto auto",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div style={{ justifySelf: "start" }}>{editingId ? "Modifier shift" : "Nouveau shift"}</div>
                  <button
                    style={{ ...styles.btn, justifySelf: "end" }}
                    onClick={() => setManagePlacesOpen(true)}
                    type="button"
                  >
                    Lieux
                  </button>
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      justifySelf: "center",
                      fontSize: 14,
                      fontWeight: 900,
                      textAlign: "center",
                    }}
                  >
                    {startHM} → {endHM} • Durée {formatDuration(durationMinutes(startHM, endHM))}
                  </div>
                </div>

                <div style={{ ...styles.sheetBody, maxHeight: "72vh", overflowY: "auto" }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={styles.seg}>
                      <button style={styles.segBtn(!isTravel)} onClick={() => setIsTravel(false)} type="button">
                        Travail
                      </button>
                      <button style={styles.segBtn(isTravel)} onClick={() => setIsTravel(true)} type="button">
                        Trajet pro
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <FloatingInput label="Date" type="date" value={date} onChange={setDate} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <div>
                      <div style={styles.labelStrong}>Début</div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-end",
                          justifyContent: "center",
                          flexWrap: "wrap",
                          overflow: "hidden",
                          maxWidth: "100%",
                        }}
                      >
                        <WheelPicker
                          value={startHour}
                          values={hours}
                          onChange={setStartHour}
                          format={(v) => pad2(v)}
                          snapOnOpenKey={snapKey}
                        />
                        <WheelPicker
                          value={startMin}
                          values={minutes5}
                          onChange={(m) => setStartMin(m)}
                          format={(v) => pad2(v)}
                          snapOnOpenKey={snapKey}
                        />
                      </div>
                      <button
                        type="button"
                        style={{
                          ...styles.btn,
                          height: 32,
                          borderRadius: 999,
                          padding: "4px 10px",
                          minWidth: 110,
                          margin: "10px auto 0",
                          display: "block",
                        }}
                        onClick={() => {
                          const n = nowRounded5HM();
                          const s = splitHM(n);
                          setStartHour(s.h);
                          setStartMin(clampTo5(s.m));
                        }}
                      >
                        Maintenant
                      </button>
                    </div>

                    <div>
                      <div style={styles.labelStrong}>Fin</div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-end",
                          justifyContent: "center",
                          flexWrap: "wrap",
                          overflow: "hidden",
                          maxWidth: "100%",
                        }}
                      >
                        <WheelPicker
                          value={endHour}
                          values={hours}
                          onChange={setEndHour}
                          format={(v) => pad2(v)}
                          snapOnOpenKey={snapKey}
                        />
                        <WheelPicker
                          value={endMin}
                          values={minutes5}
                          onChange={(m) => setEndMin(m)}
                          format={(v) => pad2(v)}
                          snapOnOpenKey={snapKey}
                        />
                      </div>
                      <button
                        type="button"
                        style={{
                          ...styles.btn,
                          height: 32,
                          borderRadius: 999,
                          padding: "4px 10px",
                          minWidth: 110,
                          margin: "10px auto 0",
                          display: "block",
                        }}
                        onClick={() => {
                          const n = nowRounded5HM();
                          const e = splitHM(n);
                          setEndHour(e.h);
                          setEndMin(clampTo5(e.m));
                        }}
                      >
                        Maintenant
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {recentPlaces.length > 0 && (
                      <div style={{ ...styles.quickRow, marginTop: 0, justifyContent: "flex-start" }}>
                        {recentPlaces.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            style={{ ...styles.quickBtn, borderColor: placeId === p.id ? "#111" : "#e5e7eb" }}
                            type="button"
                            onClick={() => setPlaceId(p.id)}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 10 }}>
                      <FloatingSelect label="Lieu" value={placeId} onChange={setPlaceId}>
                        {activePlaces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </FloatingSelect>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {!commentEnabled ? (
                      <button
                        type="button"
                        style={{ ...styles.btn, width: "100%", padding: "10px 12px", borderRadius: 14 }}
                        onClick={() => setCommentEnabled(true)}
                      >
                        + Ajouter un commentaire (optionnel)
                      </button>
                    ) : (
                      <React.Fragment>
                        <FloatingTextarea label="Commentaire" value={comment} onChange={setComment} />
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            style={styles.btn}
                            onClick={() => {
                              setCommentEnabled(false);
                              setComment("");
                            }}
                          >
                            Retirer le commentaire
                          </button>
                        </div>
                      </React.Fragment>
                    )}
                  </div>
                </div>

                <div style={styles.footer}>
                  <button
                    style={styles.ghost}
                    onClick={() => {
                      setSheetOpen(false);
                      setEditingId(null);
                    }}
                    type="button"
                  >
                    Annuler
                  </button>
                  <button style={styles.primary} onClick={saveShift} type="button">
                    {editingId ? "Enregistrer" : "Ajouter"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {managePlacesOpen && (
            <div style={styles.overlay} onClick={() => setManagePlacesOpen(false)}>
              <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div style={styles.grabber} />

                <div
                  style={{
                    ...styles.sheetHeader,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>Gérer les lieux</div>
                  <button style={styles.btn} onClick={() => setManagePlacesOpen(false)} type="button">
                    Fermer
                  </button>
                </div>

                <div style={{ ...styles.sheetBody, maxHeight: "72vh", overflowY: "auto" }}>
                  <div style={styles.small}>
                    Liste fixe éditable : ajoute/renomme/masque un lieu. (En prod : permissions « coach »)
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={styles.labelStrong}>Ajouter un lieu</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        style={{ ...styles.input, flex: "1 1 220px" }}
                        value={newPlaceName}
                        onChange={(e) => setNewPlaceName(e.target.value)}
                        placeholder="Ex: Gymnase, Client C…"
                      />
                      <button
                        style={{ ...styles.primary, flex: "0 0 auto", padding: "12px 16px" }}
                        onClick={addPlace}
                        type="button"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={styles.labelStrong}>Rechercher</div>
                    <input
                      style={styles.input}
                      value={placeQuery}
                      onChange={(e) => setPlaceQuery(e.target.value)}
                      placeholder="Filtrer la liste…"
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={styles.labelStrong}>Lieux actifs</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {filteredPlaces.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 14,
                            padding: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          {renamingId === p.id ? (
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <input
                                style={styles.input}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                              />
                            </div>
                          ) : (
                            <div style={{ fontWeight: 900, flex: "1 1 160px" }}>{p.name}</div>
                          )}

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {renamingId === p.id ? (
                              <React.Fragment>
                                <button style={styles.btn} onClick={commitRename} type="button">
                                  OK
                                </button>
                                <button
                                  style={styles.btn}
                                  type="button"
                                  onClick={() => {
                                    setRenamingId(null);
                                    setRenameValue("");
                                  }}
                                >
                                  Annuler
                                </button>
                              </React.Fragment>
                            ) : (
                              <React.Fragment>
                                <button style={styles.btn} onClick={() => startRename(p)} type="button">
                                  Renommer
                                </button>
                                <button style={styles.btn} onClick={() => archivePlace(p.id)} type="button">
                                  Masquer
                                </button>
                              </React.Fragment>
                            )}
                          </div>
                        </div>
                      ))}
                      {filteredPlaces.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>Aucun résultat.</div>}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={styles.labelStrong}>Lieux masqués</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {archivedPlaces.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            border: "1px dashed #e5e7eb",
                            borderRadius: 14,
                            padding: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 900, color: "#6b7280", flex: "1 1 160px" }}>{p.name}</div>
                          <button style={styles.btn} onClick={() => unarchivePlace(p.id)} type="button">
                            Réactiver
                          </button>
                        </div>
                      ))}
                      {archivedPlaces.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>Aucun lieu masqué.</div>}
                    </div>
                  </div>
                </div>

                <div style={styles.footer}>
                  <button style={styles.ghost} onClick={() => setManagePlacesOpen(false)} type="button">
                    Fermer
                  </button>
                  <button
                    style={styles.primary}
                    onClick={() => {
                      if (!placeId) {
                        const first = places.find((p) => !p.archived);
                        if (first) setPlaceId(first.id);
                      }
                      setManagePlacesOpen(false);
                    }}
                    type="button"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div style={styles.kpiCard}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Dashboard KPI</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <FloatingInput label="Du" type="date" value={dashFrom} onChange={setDashFrom} style={{ minWidth: 180 }} />
              <FloatingInput label="Au" type="date" value={dashTo} onChange={setDashTo} style={{ minWidth: 180 }} />
            </div>
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
              Période sélectionnée : {fmtLongDate.format(ymdToDate(dashFrom))} → {fmtLongDate.format(ymdToDate(dashTo))}
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Résumé période</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={styles.kpiCard}>
                <div style={styles.small}>Total</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{formatDuration(dashboardTotals.total)}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Travail + trajet</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.small}>Shifts</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{dashboardTotals.count}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Nombre sur la période</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.small}>Travail</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{formatDuration(dashboardTotals.work)}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Heures de travail</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.small}>Trajet</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{formatDuration(dashboardTotals.travel)}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Heures de trajet</div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Graphiques (à venir)</div>
            <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.4 }}>
              • Bar chart : heures par jour (période)
              <br />• Donut : % trajet vs travail
              <br />• Top lieux : heures cumulées
              <br />• Variations : période vs période-1
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

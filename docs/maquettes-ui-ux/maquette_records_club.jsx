import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Table2,
  LayoutGrid,
  Printer,
  Download,
  ChevronDown,
  Check,
  Info,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Mobile-first records viewer mock (club swimming)
 * - Filters: sexe, bassin (25/50), âge par année (8- ... 17+), nage, recherche
 * - Vue Mobile (liste) et vue Tableau (export/impression)
 * - Export: CSV (tableau) + PDF A3 (4 pages) via impression navigateur
 *
 * NOTE: Version JS (pas de syntaxe TypeScript) pour éviter les erreurs "Unexpected token" selon le setup Vite.
 */

// --- Domain
const SEXES = [
  { key: "M", label: "Garçons" },
  { key: "F", label: "Filles" },
];

const POOLS = [
  { key: "25", label: "25 m" },
  { key: "50", label: "50 m" },
];

// Catégories par année d'âge (format club) : 8 ans et - … 17 ans et +
const AGE_YEARS = [
  { key: "U8", label: "8 ans et -" },
  { key: "9", label: "9 ans" },
  { key: "10", label: "10 ans" },
  { key: "11", label: "11 ans" },
  { key: "12", label: "12 ans" },
  { key: "13", label: "13 ans" },
  { key: "14", label: "14 ans" },
  { key: "15", label: "15 ans" },
  { key: "16", label: "16 ans" },
  { key: "17P", label: "17 ans et +" },
];

// Filtre d'âge (par défaut : toutes catégories)
const AGE_FILTERS = [{ key: "ALL", label: "Toutes catégories" }, ...AGE_YEARS];

const STROKES = [
  { key: "FREE", label: "Nage libre" },
  { key: "BACK", label: "Dos" },
  { key: "BREAST", label: "Brasse" },
  { key: "FLY", label: "Papillon" },
  { key: "IM", label: "4 nages" },
];

// Ordre demandé en mode "Tous" : Crawl / Dos / Brasse / Pap / 4N
const STROKE_ORDER = {
  FREE: 0, // Crawl
  BACK: 1,
  BREAST: 2,
  FLY: 3,
  IM: 4,
};

function getStrokeRank(strokeKey) {
  return STROKE_ORDER[strokeKey] ?? 99;
}

const EVENTS = [
  // Libre
  { id: "50_FREE", label: "50 m NL", stroke: "FREE" },
  { id: "100_FREE", label: "100 m NL", stroke: "FREE" },
  { id: "200_FREE", label: "200 m NL", stroke: "FREE" },
  { id: "400_FREE", label: "400 m NL", stroke: "FREE" },
  { id: "800_FREE", label: "800 m NL", stroke: "FREE" },
  { id: "1500_FREE", label: "1500 m NL", stroke: "FREE" },

  // Dos
  { id: "50_BACK", label: "50 m Dos", stroke: "BACK" },
  { id: "100_BACK", label: "100 m Dos", stroke: "BACK" },
  { id: "200_BACK", label: "200 m Dos", stroke: "BACK" },

  // Brasse
  { id: "50_BREAST", label: "50 m Brasse", stroke: "BREAST" },
  { id: "100_BREAST", label: "100 m Brasse", stroke: "BREAST" },
  { id: "200_BREAST", label: "200 m Brasse", stroke: "BREAST" },

  // Pap
  { id: "50_FLY", label: "50 m Pap", stroke: "FLY" },
  { id: "100_FLY", label: "100 m Pap", stroke: "FLY" },
  { id: "200_FLY", label: "200 m Pap", stroke: "FLY" },

  // 4N
  { id: "200_IM", label: "200 m 4N", stroke: "IM" },
  { id: "400_IM", label: "400 m 4N", stroke: "IM" },
];

function getDistanceFromEventId(eventId) {
  const m = String(eventId).match(/^([0-9]+)/);
  return m ? Number(m[1]) : 0;
}

function formatTime(ms) {
  // ms -> mm:ss.cc (centi)
  const totalCenti = Math.round(ms / 10);
  const centi = totalCenti % 100;
  const totalSec = Math.floor(totalCenti / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad2 = (n) => String(n).padStart(2, "0");
  if (min > 0) return `${min}:${pad2(sec)}.${pad2(centi)}`;
  return `${sec}.${pad2(centi)}`;
}

function randomPick(arr, seed) {
  const i = Math.abs(Math.sin(seed) * 10000) % arr.length;
  return arr[Math.floor(i)];
}

function seededTime(eventId, sex, ageKey, poolKey) {
  const dist = getDistanceFromEventId(eventId);
  const base =
    dist === 50
      ? 29000
      : dist === 100
        ? 64000
        : dist === 200
          ? 140000
          : dist === 400
            ? 305000
            : dist === 800
              ? 635000
              : dist === 1500
                ? 1200000
                : 160000;

  const sexAdj = sex === "M" ? -1200 : 900;
  const ageIndex = AGE_YEARS.findIndex((a) => a.key === ageKey);
  const ageAdj = ageIndex >= 0 ? (AGE_YEARS.length - 1 - ageIndex) * 420 : 0;
  const poolAdj = poolKey === "25" ? -600 : 0;
  const noise =
    ((eventId.charCodeAt(0) + sex.charCodeAt(0) + ageKey.charCodeAt(0)) % 19) * 35;

  return Math.max(18000, base + sexAdj + ageAdj + poolAdj + noise);
}

function makeMockRecords() {
  const names = [
    "Léa Martin",
    "Hugo Bernard",
    "Inès Dubois",
    "Nathan Leroy",
    "Chloé Simon",
    "Lucas Moreau",
    "Emma Petit",
    "Jules Garcia",
  ];
  const clubs = ["CN Ville", "AS Natation", "Dauphins", "Aqua Team"];

  const rows = [];

  for (const pool of POOLS) {
    for (const sex of SEXES) {
      for (const age of AGE_YEARS) {
        for (const ev of EVENTS) {
          const ms = seededTime(ev.id, sex.key, age.key, pool.key);
          const seed = ms + ev.id.length + sex.key.length + age.key.length;
          const athlete = randomPick(names, seed);
          const club = randomPick(clubs, seed * 1.3);
          const year = 2020 + (seed % 6);
          const month = 1 + (seed % 12);
          const day = 1 + (seed % 28);
          rows.push({
            id: `${pool.key}_${sex.key}_${age.key}_${ev.id}`,
            pool: pool.key,
            sex: sex.key,
            age: age.key,
            eventId: ev.id,
            eventLabel: ev.label,
            stroke: ev.stroke,
            distance: getDistanceFromEventId(ev.id),
            timeMs: ms,
            points: Math.max(200, Math.round(1100 - ms / 350)),
            athlete,
            club,
            date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
          });
        }
      }
    }
  }

  return rows;
}

const MOCK = makeMockRecords();

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function sortEventsForDisplay(a, b, strokeFilter) {
  if (strokeFilter === "ALL") {
    const rs = getStrokeRank(a.stroke) - getStrokeRank(b.stroke);
    if (rs !== 0) return rs;
  }
  const d = a.distance - b.distance;
  if (d !== 0) return d;
  return (a.label ?? "").localeCompare(b.label ?? "", "fr");
}

// --- UI helpers
function PillToggle({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-2xl border bg-background p-1 shadow-sm">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={classNames(
              "px-3 py-1.5 text-sm rounded-xl transition",
              active
                ? "bg-foreground text-background shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function QuickStrokeFilters({ value, onChange }) {
  const quick = [
    { key: "FREE", label: "Crawl" },
    { key: "BACK", label: "Dos" },
    { key: "BREAST", label: "Brasse" },
    { key: "FLY", label: "Pap" },
    { key: "IM", label: "4N" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {quick.map((q) => {
        const active = value === q.key;
        return (
          <Button
            key={q.key}
            variant={active ? "default" : "outline"}
            className="h-10 rounded-2xl"
            onClick={() => onChange(active ? "ALL" : q.key)}
          >
            {q.label}
          </Button>
        );
      })}

      <Button
        variant={value === "ALL" ? "secondary" : "ghost"}
        className="h-10 rounded-2xl"
        onClick={() => onChange("ALL")}
      >
        Tous
      </Button>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-6 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function A3Bundle({ records }) {
  const pages = [
    { sex: "M", pool: "25", title: "Records Hommes — Bassin 25 m" },
    { sex: "M", pool: "50", title: "Records Hommes — Bassin 50 m" },
    { sex: "F", pool: "25", title: "Records Femmes — Bassin 25 m" },
    { sex: "F", pool: "50", title: "Records Femmes — Bassin 50 m" },
  ];

  const ages = AGE_YEARS;
  const events = [...EVENTS]
    .map((e) => ({ ...e, distance: getDistanceFromEventId(e.id) }))
    .sort((a, b) => sortEventsForDisplay(a, b, "ALL"));

  function buildCells(sex, pool) {
    const cells = new Map();
    for (const r of records) {
      if (r.sex !== sex) continue;
      if (r.pool !== pool) continue;
      const key = `${r.eventId}__${r.age}`;
      const existing = cells.get(key);
      if (!existing || r.timeMs < existing.timeMs) cells.set(key, r);
    }
    return cells;
  }

  return (
    <div className="a3bundle">
      {pages.map((p) => {
        const cells = buildCells(p.sex, p.pool);
        return (
          <section key={`${p.sex}_${p.pool}`} className="a3page">
            <div className="a3header">
              <div className="text-xl font-semibold">{p.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Colonnes = années d’âge · Export A3 paysage
              </div>
            </div>

            <div className="a3tablewrap">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 border-b">
                      Épreuve
                    </th>
                    {ages.map((a) => (
                      <th
                        key={a.key}
                        className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 border-b"
                      >
                        {a.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => (
                    <tr
                      key={ev.id}
                      className={idx % 2 === 0 ? "bg-background" : "bg-muted/10"}
                    >
                      <td className="px-3 py-2 border-b align-top">
                        <div className="text-xs font-semibold">{ev.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {STROKES.find((s) => s.key === ev.stroke)?.label}
                        </div>
                      </td>
                      {ages.map((a) => {
                        const r = cells.get(`${ev.id}__${a.key}`);
                        return (
                          <td key={a.key} className="px-3 py-2 border-b align-top">
                            {r ? (
                              <div className="leading-tight">
                                <div className="text-xs font-semibold tabular-nums">
                                  {formatTime(r.timeMs)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {r.athlete}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {r.date} · {r.points} pts
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// --- Main component
export default function RecordsClubMaquette() {
  const [sex, setSex] = useState("M");
  const [pool, setPool] = useState("25");
  const [age, setAge] = useState("ALL");
  const [stroke, setStroke] = useState("ALL");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("cards");

  const strokeOptions = useMemo(
    () => [{ key: "ALL", label: "Tous" }, ...STROKES],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = MOCK.filter((r) => {
      if (r.sex !== sex) return false;
      if (r.pool !== pool) return false;
      if (stroke !== "ALL" && r.stroke !== stroke) return false;
      if (q && !r.eventLabel.toLowerCase().includes(q)) return false;
      if (age !== "ALL" && r.age !== age) return false;
      return true;
    });

    // "Toutes catégories" en liste: 1 record par épreuve (meilleur temps sur toutes les années)
    if (age === "ALL" && view === "cards") {
      const bestByEvent = new Map();
      for (const r of base) {
        const existing = bestByEvent.get(r.eventId);
        if (!existing || r.timeMs < existing.timeMs) bestByEvent.set(r.eventId, r);
      }
      return [...bestByEvent.values()].sort((a, b) =>
        sortEventsForDisplay(
          { stroke: a.stroke, distance: a.distance, label: a.eventLabel },
          { stroke: b.stroke, distance: b.distance, label: b.eventLabel },
          "ALL"
        )
      );
    }

    return base.sort((a, b) =>
      sortEventsForDisplay(
        { stroke: a.stroke, distance: a.distance, label: a.eventLabel },
        { stroke: b.stroke, distance: b.distance, label: b.eventLabel },
        stroke
      )
    );
  }, [sex, pool, age, stroke, query, view]);

  const gridModel = useMemo(() => {
    const ages = AGE_YEARS;
    const events = EVENTS.filter((ev) => (stroke === "ALL" ? true : ev.stroke === stroke))
      .map((e) => ({ ...e, distance: getDistanceFromEventId(e.id) }))
      .sort((a, b) => sortEventsForDisplay(a, b, stroke));

    const cells = new Map();
    for (const r of MOCK) {
      if (r.sex !== sex) continue;
      if (r.pool !== pool) continue;
      if (stroke !== "ALL" && r.stroke !== stroke) continue;
      const key = `${r.eventId}__${r.age}`;
      const existing = cells.get(key);
      if (!existing || r.timeMs < existing.timeMs) cells.set(key, r);
    }

    return { ages, events, cells };
  }, [sex, pool, stroke]);

  const subtitle = useMemo(() => {
    const sexLabel = SEXES.find((s) => s.key === sex)?.label ?? sex;
    const poolLabel = POOLS.find((p) => p.key === pool)?.label ?? pool;
    const ageLabel = AGE_FILTERS.find((a) => a.key === age)?.label ?? age;
    const strokeLabel = strokeOptions.find((s) => s.key === stroke)?.label ?? stroke;
    return `${sexLabel} · ${poolLabel} · ${ageLabel} · ${strokeLabel}`;
  }, [sex, pool, age, stroke, strokeOptions]);

  function handlePrint() {
    window.print();
  }

  function handlePrintA3Bundle() {
    // Génère un PDF A3 en 4 pages (via la boîte d’impression du navigateur)
    document.documentElement.dataset.print = "a3bundle";
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        delete document.documentElement.dataset.print;
      }, 250);
    }, 50);
  }

  function handleExportCsv() {
    const { ages, events, cells } = gridModel;
    const header = ["Épreuve", ...ages.map((a) => a.label)].join(";");
    const rows = events.map((ev) => {
      const cols = ages.map((a) => {
        const r = cells.get(`${ev.id}__${a.key}`);
        return r ? formatTime(r.timeMs) : "";
      });
      return [ev.label, ...cols].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `records_${sex}_${pool}_${stroke}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --- Lightweight self-tests (development only)
  useEffect(() => {
    // Test 1: event sort order in ALL is stroke order then distance
    const list = [...EVENTS]
      .map((e) => ({ ...e, distance: getDistanceFromEventId(e.id), label: e.label }))
      .sort((a, b) => sortEventsForDisplay(a, b, "ALL"));

    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const rp = getStrokeRank(prev.stroke);
      const rc = getStrokeRank(cur.stroke);
      console.assert(rp <= rc, "Stroke order violated", prev, cur);
      if (rp === rc) {
        console.assert(prev.distance <= cur.distance, "Distance order violated", prev, cur);
      }
    }

    // Test 2: bestByEvent returns 1 row per event when age=ALL
    const base = MOCK.filter((r) => r.sex === "M" && r.pool === "25");
    const bestByEvent = new Map();
    for (const r of base) {
      const existing = bestByEvent.get(r.eventId);
      if (!existing || r.timeMs < existing.timeMs) bestByEvent.set(r.eventId, r);
    }
    console.assert(bestByEvent.size === EVENTS.length, "Expected 1 record per event in ALL", bestByEvent.size);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Print-only bundle (A3 · 4 pages) */}
        <div className="print-bundle hidden print:block">
          <A3Bundle records={MOCK} />
        </div>

        <div className="app-shell">
          {/* Header */}
          <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto w-full max-w-6xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-tight">Records du club</div>
                  <div className="mt-0.5 text-sm text-muted-foreground truncate">{subtitle}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePrint}
                        className="rounded-xl"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Imprimer</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setView("grid");
                          setAge("ALL");
                        }}
                        className="rounded-xl"
                      >
                        <Table2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vue tableau</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="rounded-xl">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl">
                      <DropdownMenuLabel>Export</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setView("grid");
                          setAge("ALL");
                          setTimeout(handleExportCsv, 50);
                        }}
                        className="cursor-pointer"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        CSV (tableau)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setView("grid");
                          setAge("ALL");
                          setTimeout(handlePrint, 50);
                        }}
                        className="cursor-pointer"
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        PDF via impression
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handlePrintA3Bundle} className="cursor-pointer">
                        <Printer className="mr-2 h-4 w-4" />
                        PDF A3 (4 pages)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PillToggle value={sex} onChange={setSex} options={SEXES} />
                  <PillToggle value={pool} onChange={setPool} options={POOLS} />

                  <div className="ml-auto flex items-center gap-2">
                    <Tabs value={view} onValueChange={setView}>
                      <TabsList className="rounded-2xl">
                        <TabsTrigger value="cards" className="rounded-xl">
                          <LayoutGrid className="mr-2 h-4 w-4" />
                          Mobile
                        </TabsTrigger>
                        <TabsTrigger value="grid" className="rounded-xl">
                          <Table2 className="mr-2 h-4 w-4" />
                          Tableau
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher une épreuve (ex: 100 NL)"
                      className="h-11 rounded-2xl pl-10"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={age} onValueChange={setAge}>
                      <SelectTrigger className="h-11 w-full rounded-2xl">
                        <SelectValue placeholder="Catégorie d'âge" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {AGE_FILTERS.map((a) => (
                          <SelectItem key={a.key} value={a.key}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <Select value={stroke} onValueChange={setStroke}>
                      <SelectTrigger className="h-11 w-full rounded-2xl">
                        <SelectValue placeholder="Nage" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {strokeOptions.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="-mt-1">
                  <QuickStrokeFilters value={stroke} onChange={setStroke} />
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <main className="mx-auto w-full max-w-6xl px-4 py-5">
            <AnimatePresence mode="wait">
              {view === "cards" ? (
                <motion.div
                  key="cards"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {filtered.length === 0 ? (
                    <EmptyState
                      title="Aucun record à afficher"
                      subtitle="Essayez de modifier les filtres (âge, nage, bassin) ou la recherche."
                    />
                  ) : (
                    <div className="rounded-2xl border bg-background">
                      <div className="divide-y">
                        {filtered.map((r) => (
                          <button
                            key={r.id}
                            className="w-full px-4 py-3 text-left hover:bg-muted/30 active:bg-muted/40 transition"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{r.eventLabel}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground truncate">
                                  {AGE_FILTERS.find((a) => a.key === r.age)?.label ?? r.age} · {r.athlete} · {r.date}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div className="text-sm font-semibold tabular-nums">{formatTime(r.timeMs)}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{r.points} pts</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-muted-foreground">
                      Vue tableau pensée pour l’export / impression (épreuves en lignes, âges en colonnes).
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={handleExportCsv}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimer
                      </Button>
                    </div>
                  </div>

                  <Card className="rounded-2xl">
                    <CardContent className="p-0">
                      <div className="overflow-auto">
                        <table className="min-w-[900px] w-full border-separate border-spacing-0">
                          <thead className="sticky top-0 bg-background">
                            <tr>
                              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 border-b">
                                Épreuve
                              </th>
                              {gridModel.ages.map((a) => (
                                <th
                                  key={a.key}
                                  className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 border-b"
                                >
                                  {a.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gridModel.events.map((ev, idx) => (
                              <tr
                                key={ev.id}
                                className={classNames(
                                  idx % 2 === 0 ? "bg-muted/20" : "bg-background",
                                  "hover:bg-muted/30"
                                )}
                              >
                                <td className="px-4 py-3 border-b align-top">
                                  <div className="text-sm font-medium">{ev.label}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {STROKES.find((s) => s.key === ev.stroke)?.label}
                                  </div>
                                </td>
                                {gridModel.ages.map((a) => {
                                  const r = gridModel.cells.get(`${ev.id}__${a.key}`);
                                  return (
                                    <td key={a.key} className="px-4 py-3 border-b align-top">
                                      {r ? (
                                        <div className="space-y-1">
                                          <div className="text-sm font-semibold tabular-nums">{formatTime(r.timeMs)}</div>
                                          <div className="text-xs text-muted-foreground">{r.athlete}</div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="rounded-xl">
                                              {r.points} pts
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{r.date}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      <span>
                        Astuce: pour l’impression, utilisez la fonction navigateur “Imprimer → Enregistrer en PDF”.
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Print styles */}
          <style>{`
            @media print {
              header, .sticky, button, input, [role='tablist'] { display: none !important; }
              main { padding: 0 !important; }
              body { background: white !important; }
              table { font-size: 10px; }
              th, td { padding: 6px 8px !important; }

              html[data-print='a3bundle'] .app-shell { display: none !important; }
              html[data-print='a3bundle'] .print-bundle { display: block !important; }

              @page { size: A3 landscape; margin: 10mm; }

              .a3page { page-break-after: always; break-after: page; }
              .a3page:last-child { page-break-after: auto; break-after: auto; }
              .a3header { padding: 16px 20px 10px; }
              .a3tablewrap { padding: 0 20px 20px; }
              .a3bundle table { font-size: 9.5px; }
            }
          `}</style>
        </div>
      </div>
    </TooltipProvider>
  );
}

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ClubRecord, type ClubPerformanceRanked } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp, Download, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportRecordsPdf } from "@/lib/export-records-pdf";

// ── Constants ──

const POOLS = [
  { key: "25", label: "25 m" },
  { key: "50", label: "50 m" },
];

const SEXES = [
  { key: "M", label: "G" },
  { key: "F", label: "F" },
];

const AGE_YEARS = [
  { key: "8", label: "8-" },
  { key: "9", label: "9" },
  { key: "10", label: "10" },
  { key: "11", label: "11" },
  { key: "12", label: "12" },
  { key: "13", label: "13" },
  { key: "14", label: "14" },
  { key: "15", label: "15" },
  { key: "16", label: "16" },
  { key: "17", label: "17+" },
];

const STROKES = [
  { key: "ALL", label: "Toutes" },
  { key: "FREE", label: "NL" },
  { key: "BACK", label: "Dos" },
  { key: "BREAST", label: "Brasse" },
  { key: "FLY", label: "Pap" },
  { key: "IM", label: "4N" },
];

const EVENTS = [
  { id: "50_FREE", label: "50 NL", stroke: "FREE" },
  { id: "100_FREE", label: "100 NL", stroke: "FREE" },
  { id: "200_FREE", label: "200 NL", stroke: "FREE" },
  { id: "400_FREE", label: "400 NL", stroke: "FREE" },
  { id: "800_FREE", label: "800 NL", stroke: "FREE" },
  { id: "1500_FREE", label: "1500 NL", stroke: "FREE" },
  { id: "50_BACK", label: "50 Dos", stroke: "BACK" },
  { id: "100_BACK", label: "100 Dos", stroke: "BACK" },
  { id: "200_BACK", label: "200 Dos", stroke: "BACK" },
  { id: "50_BREAST", label: "50 Br", stroke: "BREAST" },
  { id: "100_BREAST", label: "100 Br", stroke: "BREAST" },
  { id: "200_BREAST", label: "200 Br", stroke: "BREAST" },
  { id: "50_FLY", label: "50 Pap", stroke: "FLY" },
  { id: "100_FLY", label: "100 Pap", stroke: "FLY" },
  { id: "200_FLY", label: "200 Pap", stroke: "FLY" },
  { id: "100_IM", label: "100 4N", stroke: "IM" },
  { id: "200_IM", label: "200 4N", stroke: "IM" },
  { id: "400_IM", label: "400 4N", stroke: "IM" },
];

// ── Helpers ──

const formatTime = (ms?: number | null) => {
  if (!ms && ms !== 0) return "-";
  const totalCenti = Math.round(ms / 10);
  const centi = totalCenti % 100;
  const totalSec = Math.floor(totalCenti / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad2 = (v: number) => String(v).padStart(2, "0");
  if (min > 0) return `${min}:${pad2(sec)}.${pad2(centi)}`;
  return `${sec}.${pad2(centi)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
};

const formatLastUpdate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (
    d.toLocaleDateString("fr-FR") +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
};

const getStroke = (code: string) => code.replace(/^\d+_/, "");

const getAgeLabel = (age: number) =>
  age === 8 ? "≤8" : age === 17 ? "≥17" : String(age);

// ── Segmented Control ──

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === o.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Pill Strip (horizontal scroll) ──

function PillStrip({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 no-scrollbar">
      <div className="flex gap-1.5 w-max">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              value === o.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Component ──

export default function RecordsClub() {
  const [pool, setPool] = useState("25");
  const [sex, setSex] = useState("M");
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [strokeFilter, setStrokeFilter] = useState("ALL");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const ageValue = ageFilter === "ALL" ? null : Number(ageFilter);

  // Last import log
  const { data: lastImportLogs } = useQuery({
    queryKey: ["last-import"],
    queryFn: () => api.getImportLogs({ limit: 1 }),
  });

  // Records (best per event/pool/sex/age)
  const {
    data: records = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["club-records", pool, sex, ageFilter],
    queryFn: () =>
      api.getClubRecords({
        pool_m: Number(pool),
        sex,
        age: ageValue,
      }),
  });

  // Ranking for expanded row
  const { data: rankingData, isFetching: rankingLoading } = useQuery({
    queryKey: ["club-ranking", expandedKey],
    queryFn: () => {
      if (!expandedKey) return [] as ClubPerformanceRanked[];
      const [eventCode, poolM, sexVal, ageVal] = expandedKey.split("__");
      return api.getClubRanking({
        event_code: eventCode,
        pool_m: Number(poolM),
        sex: sexVal,
        age: ageVal === "ALL" ? null : Number(ageVal),
      });
    },
    enabled: !!expandedKey,
  });

  const eventMap = useMemo(
    () => new Map(EVENTS.map((e) => [e.id, e.label])),
    [],
  );
  const eventOrder = useMemo(
    () => new Map(EVENTS.map((e, i) => [e.id, i])),
    [],
  );

  const filteredRecords = useMemo(() => {
    const base =
      strokeFilter === "ALL"
        ? records
        : records.filter((r) => getStroke(r.event_code) === strokeFilter);
    return [...base].sort((a, b) => {
      const oA = eventOrder.get(a.event_code) ?? 999;
      const oB = eventOrder.get(b.event_code) ?? 999;
      if (oA !== oB) return oA - oB;
      if (a.age !== b.age) return a.age - b.age;
      return a.time_ms - b.time_ms;
    });
  }, [records, strokeFilter, eventOrder]);

  // Group records by event for "toutes catégories" (ALL ages)
  const groupedByEvent = useMemo(() => {
    if (ageValue !== null) return null;
    const map = new Map<string, ClubRecord[]>();
    for (const r of filteredRecords) {
      const list = map.get(r.event_code) ?? [];
      list.push(r);
      map.set(r.event_code, list);
    }
    return map;
  }, [filteredRecords, ageValue]);

  const toggleExpand = useCallback(
    (record: ClubRecord) => {
      const key = `${record.event_code}__${pool}__${sex}__${record.age}`;
      setExpandedKey((prev) => (prev === key ? null : key));
    },
    [pool, sex],
  );

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const allRecords = await api.getClubRecords({});
      await exportRecordsPdf(allRecords);
    } catch {
      // Silently fail
    } finally {
      setExporting(false);
    }
  }, []);

  const agePills = useMemo(
    () => [{ key: "ALL", label: "Tous" }, ...AGE_YEARS],
    [],
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="sticky top-0 z-overlay -mx-4 backdrop-blur-md bg-background/90 border-b border-primary/15">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-3.5 w-3.5" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold uppercase italic tracking-tight text-primary">Records du club</h1>
              {lastImportLogs &&
                lastImportLogs.length > 0 &&
                lastImportLogs[0].status === "success" && (
                  <p className="text-[10px] text-muted-foreground -mt-0.5">
                    MAJ :{" "}
                    {formatLastUpdate(
                      lastImportLogs[0].completed_at ?? lastImportLogs[0].started_at,
                    ) ?? "-"}
                  </p>
                )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting}
            className="border-primary/20 text-primary hover:bg-primary/5"
          >
            <Download className="h-4 w-4 mr-1" />
            {exporting ? "..." : "PDF"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Pool + Sex on same line */}
        <div className="flex items-center gap-2">
          <SegmentedControl options={POOLS} value={pool} onChange={setPool} />
          <SegmentedControl options={SEXES} value={sex} onChange={setSex} />
        </div>

        {/* Age — horizontal scroll */}
        <PillStrip options={agePills} value={ageFilter} onChange={setAgeFilter} />

        {/* Strokes — horizontal scroll */}
        <PillStrip options={STROKES} value={strokeFilter} onChange={setStrokeFilter} />
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="font-semibold">Impossible de charger les données</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "Une erreur s'est produite"}
          </p>
          <Button onClick={() => refetch()} className="mt-4">
            Réessayer
          </Button>
        </div>
      )}

      {!isLoading && !error && filteredRecords.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun record pour ces filtres.
        </p>
      )}

      {!isLoading && !error && filteredRecords.length > 0 && (
        <>
          {ageValue !== null ? (
            /* Single age: flat card list */
            <div className="space-y-2">
              {filteredRecords.map((record) => {
                const key = `${record.event_code}__${pool}__${sex}__${record.age}`;
                const label =
                  record.event_label ||
                  eventMap.get(record.event_code) ||
                  record.event_code;
                return (
                  <RecordCard
                    key={`${record.event_code}-${record.age}`}
                    record={record}
                    label={label}
                    isExpanded={expandedKey === key}
                    onToggle={toggleExpand}
                    rankingData={expandedKey === key ? rankingData : undefined}
                    rankingLoading={rankingLoading}
                  />
                );
              })}
            </div>
          ) : (
            /* All ages: grouped by event */
            <div className="space-y-4">
              {groupedByEvent &&
                [...groupedByEvent.entries()].map(([eventCode, recs]) => {
                  const label =
                    recs[0]?.event_label ||
                    eventMap.get(eventCode) ||
                    eventCode;
                  return (
                    <EventGroup
                      key={eventCode}
                      label={label}
                      records={recs}
                      expandedKey={expandedKey}
                      onToggle={toggleExpand}
                      pool={pool}
                      sex={sex}
                      rankingData={rankingData}
                      rankingLoading={rankingLoading}
                    />
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Record Card (single-age mode) ──

function RecordCard({
  record,
  label,
  isExpanded,
  onToggle,
  rankingData,
  rankingLoading,
}: {
  record: ClubRecord;
  label: string;
  isExpanded: boolean;
  onToggle: (r: ClubRecord) => void;
  rankingData?: ClubPerformanceRanked[];
  rankingLoading: boolean;
}) {
  const originalAgeLabel = record.original_age ? getAgeLabel(record.original_age) : null;
  const isCascaded = record.original_age != null && record.original_age !== record.age;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(record)}
        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-primary font-bold tabular-nums text-sm">
              {formatTime(record.time_ms)}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {record.athlete_name}
            {isCascaded && originalAgeLabel && (
              <span className="ml-1 opacity-70">({originalAgeLabel} ans)</span>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
            {formatDate(record.record_date)}
          </span>
        </div>
      </button>

      {isExpanded && (
        <RankingList
          record={record}
          label={label}
          rankingData={rankingData}
          rankingLoading={rankingLoading}
          isCascaded={isCascaded}
          originalAgeLabel={originalAgeLabel}
        />
      )}
    </div>
  );
}

// ── Event Group (all-ages mode) ──

function EventGroup({
  label,
  records,
  expandedKey,
  onToggle,
  pool,
  sex,
  rankingData,
  rankingLoading,
}: {
  label: string;
  records: ClubRecord[];
  expandedKey: string | null;
  onToggle: (r: ClubRecord) => void;
  pool: string;
  sex: string;
  rankingData?: ClubPerformanceRanked[];
  rankingLoading: boolean;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-foreground">{label}</h3>
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {records.map((record) => {
          const key = `${record.event_code}__${pool}__${sex}__${record.age}`;
          const isExpanded = expandedKey === key;
          const ageLabel = getAgeLabel(record.age);
          const originalAgeLabel = record.original_age
            ? getAgeLabel(record.original_age)
            : null;
          const isCascaded =
            record.original_age != null && record.original_age !== record.age;

          return (
            <div key={`${record.event_code}-${record.age}`}>
              <button
                type="button"
                onClick={() => onToggle(record)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors"
              >
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 min-w-[28px] text-center">
                  {ageLabel}
                </Badge>
                <span className="font-mono text-primary font-semibold tabular-nums text-sm shrink-0">
                  {formatTime(record.time_ms)}
                </span>
                <span className="text-sm text-foreground truncate flex-1">
                  {record.athlete_name}
                  {isCascaded && originalAgeLabel && (
                    <span className="ml-1 text-xs text-muted-foreground font-normal">
                      ({originalAgeLabel}a)
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                  {formatDate(record.record_date)}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <RankingList
                  record={record}
                  label={label}
                  rankingData={rankingData}
                  rankingLoading={rankingLoading}
                  isCascaded={isCascaded}
                  originalAgeLabel={originalAgeLabel}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ranking List (replaces nested tables) ──

function RankingList({
  record,
  label,
  rankingData,
  rankingLoading,
  isCascaded,
  originalAgeLabel,
}: {
  record: ClubRecord;
  label: string;
  rankingData?: ClubPerformanceRanked[];
  rankingLoading: boolean;
  isCascaded: boolean;
  originalAgeLabel: string | null;
}) {
  const ageLabel = getAgeLabel(record.age);

  const rows = useMemo(() => {
    const agePerfs = rankingData ?? [];
    if (!isCascaded) return agePerfs;

    const recordEntry: ClubPerformanceRanked = {
      id: -1,
      athlete_name: record.athlete_name,
      swimmer_iuf: record.swimmer_iuf ?? null,
      sex: record.sex,
      pool_m: record.pool_m,
      event_code: record.event_code,
      event_label: record.event_label,
      age: record.original_age ?? record.age,
      actual_age: record.original_age ?? record.age,
      time_ms: record.time_ms,
      record_date: record.record_date,
    };

    return [recordEntry, ...agePerfs];
  }, [rankingData, record, isCascaded]);

  return (
    <div className="border-t border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Classement — {label} ({ageLabel} ans)
      </p>

      {rankingLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-5 w-full rounded bg-muted animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune donnée de classement.</p>
      ) : (
        <div className="space-y-0.5">
          {rows.map((perf, idx) => {
            const isRecordHolder = idx === 0 && isCascaded && perf.id === -1;
            return (
              <div
                key={perf.id === -1 ? "record-holder" : perf.id}
                className={cn(
                  "flex items-center gap-2 text-xs py-1 rounded-md px-1",
                  idx === 0 && "font-semibold text-primary",
                  isRecordHolder && "bg-primary/5",
                )}
              >
                <span className="w-5 text-center shrink-0">
                  {idx === 0 ? (
                    <Trophy className="inline h-3 w-3 text-yellow-500" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="font-mono tabular-nums w-16 shrink-0">
                  {formatTime(perf.time_ms)}
                </span>
                <span className="flex-1 truncate">
                  {perf.athlete_name}
                  {isRecordHolder && originalAgeLabel && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      (record {originalAgeLabel}a)
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {perf.actual_age ?? perf.age}a
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

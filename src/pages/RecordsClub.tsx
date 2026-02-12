import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ClubRecord, type ClubPerformanceRanked } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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

// ── Component ──

export default function RecordsClub() {
  const [pool, setPool] = useState("25");
  const [sex, setSex] = useState("M");
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [strokeFilter, setStrokeFilter] = useState("ALL");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const toggleExpand = (record: ClubRecord) => {
    const key = `${record.event_code}__${pool}__${sex}__${record.age}`;
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold uppercase italic text-primary">
            Records du club
          </h1>
        </div>
        {lastImportLogs &&
          lastImportLogs.length > 0 &&
          lastImportLogs[0].status === "success" && (
            <p className="text-xs text-muted-foreground">
              MAJ :{" "}
              {formatLastUpdate(
                lastImportLogs[0].completed_at ?? lastImportLogs[0].started_at,
              ) ?? "-"}
            </p>
          )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Pool toggle */}
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          {POOLS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPool(p.key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                pool === p.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Sex toggle */}
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          {SEXES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSex(s.key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                sex === s.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Age pills */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setAgeFilter("ALL")}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
              ageFilter === "ALL"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            Tous
          </button>
          {AGE_YEARS.map((a) => (
            <button
              key={a.key}
              onClick={() => setAgeFilter(a.key)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                ageFilter === a.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke tabs */}
      <Tabs value={strokeFilter} onValueChange={setStrokeFilter}>
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
          {STROKES.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="shrink-0 text-xs">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 w-full rounded bg-muted animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <p>Impossible de charger les records.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
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
            /* Single age mode: flat table */
            <RecordsTable
              records={filteredRecords}
              eventMap={eventMap}
              expandedKey={expandedKey}
              onToggle={toggleExpand}
              pool={pool}
              sex={sex}
              rankingData={rankingData}
              rankingLoading={rankingLoading}
              showAge={false}
            />
          ) : (
            /* All ages mode: grouped by event */
            <div className="space-y-6">
              {groupedByEvent &&
                [...groupedByEvent.entries()].map(([eventCode, recs]) => {
                  const label =
                    recs[0]?.event_label ||
                    eventMap.get(eventCode) ||
                    eventCode;
                  return (
                    <div key={eventCode}>
                      <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                        {label}
                      </h3>
                      <RecordsTable
                        records={recs}
                        eventMap={eventMap}
                        expandedKey={expandedKey}
                        onToggle={toggleExpand}
                        pool={pool}
                        sex={sex}
                        rankingData={rankingData}
                        rankingLoading={rankingLoading}
                        showAge
                        hideEventColumn
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Records Table Sub-component ──

function RecordsTable({
  records,
  eventMap,
  expandedKey,
  onToggle,
  pool,
  sex,
  rankingData,
  rankingLoading,
  showAge,
  hideEventColumn,
}: {
  records: ClubRecord[];
  eventMap: Map<string, string>;
  expandedKey: string | null;
  onToggle: (r: ClubRecord) => void;
  pool: string;
  sex: string;
  rankingData?: ClubPerformanceRanked[];
  rankingLoading: boolean;
  showAge: boolean;
  hideEventColumn?: boolean;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {!hideEventColumn && (
              <TableHead className="w-[110px]">Épreuve</TableHead>
            )}
            <TableHead className="w-[85px]">Temps</TableHead>
            <TableHead>Détenteur</TableHead>
            {showAge && <TableHead className="w-[50px]">Âge</TableHead>}
            <TableHead className="hidden w-[85px] sm:table-cell">
              Date
            </TableHead>
            <TableHead className="w-[32px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const key = `${record.event_code}__${pool}__${sex}__${record.age}`;
            const isExpanded = expandedKey === key;
            const label =
              record.event_label ||
              eventMap.get(record.event_code) ||
              record.event_code;

            return (
              <RecordRow
                key={`${record.event_code}-${record.age}`}
                record={record}
                label={label}
                isExpanded={isExpanded}
                onToggle={onToggle}
                rankingData={isExpanded ? rankingData : undefined}
                rankingLoading={rankingLoading}
                showAge={showAge}
                hideEventColumn={hideEventColumn}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Single Record Row (with expandable ranking) ──

function RecordRow({
  record,
  label,
  isExpanded,
  onToggle,
  rankingData,
  rankingLoading,
  showAge,
  hideEventColumn,
}: {
  record: ClubRecord;
  label: string;
  isExpanded: boolean;
  onToggle: (r: ClubRecord) => void;
  rankingData?: ClubPerformanceRanked[];
  rankingLoading: boolean;
  showAge: boolean;
  hideEventColumn?: boolean;
}) {
  const colSpan =
    (hideEventColumn ? 0 : 1) + 3 + (showAge ? 1 : 0) + 1;

  const ageLabel =
    record.age === 8 ? "≤8" : record.age === 17 ? "≥17" : String(record.age);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => onToggle(record)}
      >
        {!hideEventColumn && (
          <TableCell className="font-medium text-xs">{label}</TableCell>
        )}
        <TableCell className="font-mono text-primary font-semibold tabular-nums text-sm">
          {formatTime(record.time_ms)}
        </TableCell>
        <TableCell className="text-sm">{record.athlete_name}</TableCell>
        {showAge && (
          <TableCell>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {ageLabel}
            </Badge>
          </TableCell>
        )}
        <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
          {formatDate(record.record_date)}
        </TableCell>
        <TableCell className="px-1">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            <div className="bg-muted/30 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Classement — {label}
                {!showAge &&
                  ` (${ageLabel} ans)`}
              </p>

              {rankingLoading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-6 w-full rounded bg-muted animate-pulse motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : !rankingData || rankingData.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune donnée de classement.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="w-8 py-1 text-left">#</th>
                      <th className="py-1 text-left">Nageur</th>
                      <th className="w-[80px] py-1 text-left">Temps</th>
                      {showAge && (
                        <th className="w-[40px] py-1 text-left">Âge</th>
                      )}
                      <th className="hidden w-[80px] py-1 text-left sm:table-cell">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingData.map((perf, idx) => (
                      <tr
                        key={perf.id}
                        className={cn(
                          "border-t border-border/50",
                          idx === 0 && "font-semibold text-primary",
                        )}
                      >
                        <td className="py-1">
                          {idx === 0 ? (
                            <Trophy className="inline h-3 w-3 text-yellow-500" />
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="py-1">{perf.athlete_name}</td>
                        <td className="py-1 font-mono tabular-nums">
                          {formatTime(perf.time_ms)}
                        </td>
                        {showAge && (
                          <td className="py-1 text-muted-foreground">
                            {perf.age}
                          </td>
                        )}
                        <td className="hidden py-1 text-muted-foreground sm:table-cell">
                          {formatDate(perf.record_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

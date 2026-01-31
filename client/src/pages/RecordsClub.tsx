import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ClubRecord } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SEXES = [
  { key: "M", label: "Garçons" },
  { key: "F", label: "Filles" },
];

const POOLS = [
  { key: "25", label: "25 m" },
  { key: "50", label: "50 m" },
];

const AGE_YEARS = [
  { key: "8", label: "8 ans et -" },
  { key: "9", label: "9 ans" },
  { key: "10", label: "10 ans" },
  { key: "11", label: "11 ans" },
  { key: "12", label: "12 ans" },
  { key: "13", label: "13 ans" },
  { key: "14", label: "14 ans" },
  { key: "15", label: "15 ans" },
  { key: "16", label: "16 ans" },
  { key: "17", label: "17 ans et +" },
];

const AGE_FILTERS = [{ key: "ALL", label: "Toutes catégories" }, ...AGE_YEARS];

const STROKES = [
  { key: "ALL", label: "Toutes" },
  { key: "FREE", label: "Nage libre" },
  { key: "BACK", label: "Dos" },
  { key: "BREAST", label: "Brasse" },
  { key: "FLY", label: "Papillon" },
  { key: "IM", label: "4 nages" },
];

const EVENTS = [
  { id: "50_FREE", label: "50 m NL", stroke: "FREE" },
  { id: "100_FREE", label: "100 m NL", stroke: "FREE" },
  { id: "200_FREE", label: "200 m NL", stroke: "FREE" },
  { id: "400_FREE", label: "400 m NL", stroke: "FREE" },
  { id: "800_FREE", label: "800 m NL", stroke: "FREE" },
  { id: "1500_FREE", label: "1500 m NL", stroke: "FREE" },
  { id: "50_BACK", label: "50 m Dos", stroke: "BACK" },
  { id: "100_BACK", label: "100 m Dos", stroke: "BACK" },
  { id: "200_BACK", label: "200 m Dos", stroke: "BACK" },
  { id: "50_BREAST", label: "50 m Brasse", stroke: "BREAST" },
  { id: "100_BREAST", label: "100 m Brasse", stroke: "BREAST" },
  { id: "200_BREAST", label: "200 m Brasse", stroke: "BREAST" },
  { id: "50_FLY", label: "50 m Pap", stroke: "FLY" },
  { id: "100_FLY", label: "100 m Pap", stroke: "FLY" },
  { id: "200_FLY", label: "200 m Pap", stroke: "FLY" },
  { id: "200_IM", label: "200 m 4N", stroke: "IM" },
  { id: "400_IM", label: "400 m 4N", stroke: "IM" },
];

const formatTime = (ms?: number | null) => {
  if (!ms && ms !== 0) return "-";
  const totalCenti = Math.round(ms / 10);
  const centi = totalCenti % 100;
  const totalSec = Math.floor(totalCenti / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad2 = (value: number) => String(value).padStart(2, "0");
  if (min > 0) return `${min}:${pad2(sec)}.${pad2(centi)}`;
  return `${sec}.${pad2(centi)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
};

const getStrokeFromEventCode = (eventCode: string) => eventCode.replace(/^\d+_/, "");

const getEventLabel = (record: ClubRecord, eventMap: Map<string, string>) =>
  record.event_label || eventMap.get(record.event_code) || record.event_code;

export default function RecordsClub() {
  const [pool, setPool] = useState("25");
  const [sex, setSex] = useState("M");
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [strokeFilter, setStrokeFilter] = useState("ALL");

  const ageValue = ageFilter === "ALL" ? null : Number(ageFilter);

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["club-records", pool, sex, ageFilter],
    queryFn: () =>
      api.getClubRecords({
        pool_m: Number(pool),
        sex,
        age: ageValue,
      }),
  });

  const eventMap = useMemo(() => new Map(EVENTS.map((event) => [event.id, event.label])), []);
  const eventOrder = useMemo(() => new Map(EVENTS.map((event, index) => [event.id, index])), []);

  const filteredRecords = useMemo(() => {
    const base = strokeFilter === "ALL"
      ? records
      : records.filter((record) => getStrokeFromEventCode(record.event_code) === strokeFilter);
    return [...base].sort((a, b) => {
      const orderA = eventOrder.get(a.event_code) ?? 999;
      const orderB = eventOrder.get(b.event_code) ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      if (a.age !== b.age) return a.age - b.age;
      return a.time_ms - b.time_ms;
    });
  }, [records, strokeFilter, eventOrder]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Records du club</h1>
        <p className="text-sm text-muted-foreground">
          Retrouvez les meilleures performances par épreuve, sexe, bassin et catégorie d’âge.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={pool} onValueChange={setPool}>
              <SelectTrigger>
                <SelectValue placeholder="Bassin" />
              </SelectTrigger>
              <SelectContent>
                {POOLS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger>
                <SelectValue placeholder="Sexe" />
              </SelectTrigger>
              <SelectContent>
                {SEXES.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ageFilter} onValueChange={setAgeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Catégorie d'âge" />
              </SelectTrigger>
              <SelectContent>
                {AGE_FILTERS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={strokeFilter} onValueChange={setStrokeFilter}>
            <TabsList className="flex w-full justify-start gap-2 overflow-x-auto">
              {STROKES.map((stroke) => (
                <TabsTrigger key={stroke.key} value={stroke.key} className="shrink-0">
                  {stroke.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading && <div className="text-sm text-muted-foreground">Chargement des records...</div>}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Impossible de charger les records. Réessayez plus tard.
          </div>
        )}
        {!isLoading && !error && filteredRecords.length === 0 && (
          <div className="text-sm text-muted-foreground">Aucun record disponible pour ces filtres.</div>
        )}

        {filteredRecords.map((record) => (
          <Card key={`${record.event_code}-${record.age}-${record.sex}-${record.pool_m}`} className="shadow-sm">
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {getEventLabel(record, eventMap)}
                  </div>
                  <div className="text-2xl font-semibold text-primary">
                    {formatTime(record.time_ms)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <div className="font-semibold text-foreground">{record.athlete_name}</div>
                  <div>{formatDate(record.record_date)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{record.sex === "M" ? "Garçons" : "Filles"}</Badge>
                <Badge variant="outline">{record.pool_m} m</Badge>
                <Badge variant="outline">{record.age} ans</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

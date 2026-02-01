
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { useAuth } from "@/lib/auth";
import { scoreToColor } from "@/lib/score";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const kpiBadgeClass = "rounded-full px-3 py-1 text-sm font-mono font-bold";

const getContrastTextColor = (color: string) => {
  const match = color.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) {
    return "#000";
  }
  const [, hRaw, sRaw, lRaw] = match;
  const h = Number(hRaw);
  const s = Number(sRaw) / 100;
  const l = Number(lRaw) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
  } else if (h >= 120 && h < 180) {
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 155 ? "#000" : "#fff";
};

type SwimKpiCompactGridProps = {
  avgRpe: number | null;
  avgPerformance: number | null;
  avgEngagement: number | null;
  avgFatigue: number | null;
};

export function SwimKpiCompactGrid({
  avgRpe,
  avgPerformance,
  avgEngagement,
  avgFatigue,
}: SwimKpiCompactGridProps) {
  const metrics = [
    { key: "rpe", title: "Difficulté Moy", value: avgRpe, invert: true },
    { key: "performance", title: "Performance Moy", value: avgPerformance, invert: false },
    { key: "engagement", title: "Engagement Moy", value: avgEngagement, invert: false },
    { key: "fatigue", title: "Fatigue Moy", value: avgFatigue, invert: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metrics.map((metric) => {
        const color =
          scoreToColor(metric.value ?? null, { invert: metric.invert }) ?? "hsl(var(--muted-foreground))";
        return (
          <Card key={metric.key}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground">{metric.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Badge
                className={kpiBadgeClass}
                style={{
                  backgroundColor: color,
                  color: getContrastTextColor(color),
                }}
              >
                {metric.value ? metric.value.toFixed(1) : "-"}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Progress() {
  const { user, userId, role, selectedAthleteId, selectedAthleteName } = useAuth();
  const hasCoachSelection =
    (role === "coach" || role === "admin") &&
    (selectedAthleteId !== null || !!selectedAthleteName);
  const athleteName = hasCoachSelection ? selectedAthleteName : user;
  const athleteId = hasCoachSelection ? selectedAthleteId : userId;
  const athleteKey = athleteId ?? athleteName;
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [swimPeriodDays, setSwimPeriodDays] = useState(30);
  const [strengthPeriodDays, setStrengthPeriodDays] = useState(30);
  const { data: sessions } = useQuery({
    queryKey: ["sessions", athleteKey],
    queryFn: () => api.getSessions(athleteName!, athleteId),
    enabled: !!athleteName,
  });
  const strengthHistoryQuery = useInfiniteQuery({
    queryKey: ["strength_history", athleteKey, "progress", historyStatus, historyFrom, historyTo],
    queryFn: ({ pageParam = 0 }) =>
      api.getStrengthHistory(athleteName!, {
        athleteId,
        limit: 10,
        offset: pageParam,
        order: "desc",
        status: historyStatus === "all" ? undefined : historyStatus,
        from: historyFrom || undefined,
        to: historyTo || undefined,
      }),
    enabled: !!athleteName,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
    },
    initialPageParam: 0,
  });
  const strengthRuns = strengthHistoryQuery.data?.pages.flatMap((page) => page.runs) ?? [];
  const strengthRangeFrom = startOfDay(subDays(new Date(), strengthPeriodDays)).toISOString();
  const strengthRangeTo = endOfDay(new Date()).toISOString();
  const { data: strengthHistorySummary } = useQuery({
    queryKey: [
      "strength_history_summary",
      athleteKey,
      "progress",
      strengthPeriodDays,
      strengthRangeFrom,
      strengthRangeTo,
    ],
    queryFn: () =>
      api.getStrengthHistory(athleteName!, {
        athleteId,
        limit: 200,
        order: "desc",
        from: strengthRangeFrom,
        to: strengthRangeTo,
      }),
    enabled: !!athleteName,
  });
  const { data: strengthAggregate } = useQuery({
    queryKey: [
      "strength_history_aggregate",
      athleteKey,
      "progress",
      strengthPeriodDays,
      strengthRangeFrom,
      strengthRangeTo,
    ],
    queryFn: () =>
      api.getStrengthHistoryAggregate(athleteName!, {
        athleteId,
        period: "day",
        limit: 200,
        order: "asc",
        from: strengthRangeFrom,
        to: strengthRangeTo,
      }),
    enabled: !!athleteName,
  });
  const strengthRunsPeriod = strengthHistorySummary?.runs ?? [];
  const exerciseSummary = strengthHistorySummary?.exercise_summary ?? [];
  const strengthAggregatePeriods = strengthAggregate?.periods ?? [];

  // Process Swim Data
  const processData = (days: number) => {
    if (!sessions) return [];
    const cutoff = subDays(new Date(), days);
    const filtered = sessions.filter(s => new Date(s.date) >= cutoff).reverse();

    const grouped = new Map();
    filtered.forEach(s => {
        const dateStr = format(new Date(s.date), "dd/MM");
        if (!grouped.has(dateStr)) {
          grouped.set(dateStr, {
            date: dateStr,
            distance: 0,
            effort: 0,
            rpe: 0,
            performance: 0,
            engagement: 0,
            fatigue: 0,
            count: 0,
            rpeCount: 0,
            performanceCount: 0,
            engagementCount: 0,
            fatigueCount: 0,
          });
        }
        const entry = grouped.get(dateStr);
        entry.distance += s.distance;
        entry.effort += s.effort;
        entry.count += 1;
        if (s.rpe !== null && s.rpe !== undefined) {
          entry.rpe += s.rpe;
          entry.rpeCount += 1;
        }
        if (s.performance !== null && s.performance !== undefined) {
          entry.performance += s.performance;
          entry.performanceCount += 1;
        }
        if (s.engagement !== null && s.engagement !== undefined) {
          entry.engagement += s.engagement;
          entry.engagementCount += 1;
        }
        if (s.fatigue !== null && s.fatigue !== undefined) {
          entry.fatigue += s.fatigue;
          entry.fatigueCount += 1;
        }
    });

    return Array.from(grouped.values()).map(item => ({
        ...item,
        effort: Math.round(item.effort / item.count * 10) / 10,
        rpe: item.rpeCount ? Math.round(item.rpe / item.rpeCount * 10) / 10 : null,
        performance: item.performanceCount ? Math.round(item.performance / item.performanceCount * 10) / 10 : null,
        engagement: item.engagementCount ? Math.round(item.engagement / item.engagementCount * 10) / 10 : null,
        fatigue: item.fatigueCount ? Math.round(item.fatigue / item.fatigueCount * 10) / 10 : null,
    }));
  };

  const swimSessionsPeriod = sessions
    ? sessions.filter((session) => new Date(session.date) >= subDays(new Date(), swimPeriodDays))
    : [];
  const swimSessionsCount = swimSessionsPeriod.length;
  const swimSessionsTotals = swimSessionsPeriod.reduce(
    (acc, session) => {
      acc.distance += session.distance;
      acc.duration += session.duration;
      if (session.rpe !== null && session.rpe !== undefined) {
        acc.rpeSum += session.rpe;
        acc.rpeCount += 1;
      }
      if (session.performance !== null && session.performance !== undefined) {
        acc.performanceSum += session.performance;
        acc.performanceCount += 1;
      }
      if (session.engagement !== null && session.engagement !== undefined) {
        acc.engagementSum += session.engagement;
        acc.engagementCount += 1;
      }
      if (session.fatigue !== null && session.fatigue !== undefined) {
        acc.fatigueSum += session.fatigue;
        acc.fatigueCount += 1;
      }
      return acc;
    },
    {
      distance: 0,
      duration: 0,
      rpeSum: 0,
      rpeCount: 0,
      performanceSum: 0,
      performanceCount: 0,
      engagementSum: 0,
      engagementCount: 0,
      fatigueSum: 0,
      fatigueCount: 0,
    },
  );
  const swimSessionsAvgRpe = swimSessionsTotals.rpeCount
    ? swimSessionsTotals.rpeSum / swimSessionsTotals.rpeCount
    : null;
  const swimSessionsAvgPerformance = swimSessionsTotals.performanceCount
    ? swimSessionsTotals.performanceSum / swimSessionsTotals.performanceCount
    : null;
  const swimSessionsAvgEngagement = swimSessionsTotals.engagementCount
    ? swimSessionsTotals.engagementSum / swimSessionsTotals.engagementCount
    : null;
  const swimSessionsAvgFatigue = swimSessionsTotals.fatigueCount
    ? swimSessionsTotals.fatigueSum / swimSessionsTotals.fatigueCount
    : null;
  const swimSessionsAvgDuration = swimSessionsCount
    ? swimSessionsTotals.duration / swimSessionsCount
    : 0;
  const swimSessionsAvgDistance = swimSessionsCount
    ? swimSessionsTotals.distance / swimSessionsCount
    : 0;

  const swimData = processData(swimPeriodDays);

  const isLowScorePositive = (metricKey: string) =>
    metricKey === "rpe" || metricKey === "effort" || metricKey === "fatigue";

  const getRunRpeValue = (run: any) => {
    const logs = Array.isArray(run?.logs) ? run.logs : [];
    const rpeValues: number[] = logs
      .map((log: any) => (log?.rpe !== null && log?.rpe !== undefined ? Number(log.rpe) : null))
      .filter((value: number | null): value is number => value !== null && Number.isFinite(value));
    if (rpeValues.length > 0) {
      return rpeValues.reduce((acc, value) => acc + value, 0) / rpeValues.length;
    }
    const fallback = run?.feeling ?? run?.rpe ?? null;
    const fallbackValue = fallback !== null && fallback !== undefined ? Number(fallback) : null;
    return fallbackValue !== null && Number.isFinite(fallbackValue) ? fallbackValue : null;
  };

  const formatRunRpe = (value: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    return value.toFixed(1);
  };

  // Strength Data (Simplified)
  const strengthData = [...strengthRunsPeriod]
    .sort((a, b) => {
      const aDate = new Date(a.started_at || a.date || a.created_at || 0).getTime();
      const bDate = new Date(b.started_at || b.date || b.created_at || 0).getTime();
      return aDate - bDate;
    })
    .map((run) => ({
      date: format(new Date(run.started_at || run.date || run.created_at || new Date()), "dd/MM"),
      feeling: getRunRpeValue(run),
    }));
  const strengthAggregateData = strengthAggregatePeriods.map((item) => ({
    date: item.period,
    label: format(new Date(item.period), "dd/MM"),
    tonnage: Math.round(item.tonnage ?? 0),
    volume: Math.round(item.volume ?? 0),
  }));
  const strengthTonnagePeriod = strengthAggregatePeriods.reduce((acc, item) => acc + (item.tonnage ?? 0), 0);
  const strengthVolumePeriod = strengthAggregatePeriods.reduce((acc, item) => acc + (item.volume ?? 0), 0);
  const strengthSessionsCount = strengthRunsPeriod.length;
  const strengthRpeValues = strengthRunsPeriod
    .map((run) => getRunRpeValue(run))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const strengthAvgFeeling = strengthRpeValues.length
    ? strengthRpeValues.reduce((acc, value) => acc + value, 0) / strengthRpeValues.length
    : null;

  const exerciseVolumeData = [...exerciseSummary]
    .map((entry) => ({
      exerciseId: Number(entry.exercise_id),
      name: entry.exercise_name || `Exercice ${entry.exercise_id}`,
      totalSets: Number(entry.total_sets ?? 0),
      totalReps: Number(entry.total_reps ?? 0),
      totalVolume: Number(entry.total_volume ?? 0),
      maxWeight: entry.max_weight !== null && entry.max_weight !== undefined ? Number(entry.max_weight) : null,
      lastPerformedAt: entry.last_performed_at ?? null,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume);
  const topExerciseVolume = exerciseVolumeData.slice(0, 8);

  const formatExerciseDate = (dateValue: string | null) => {
    if (!dateValue) return "-";
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return "-";
    return format(parsed, "dd/MM/yyyy");
  };

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Progression</h1>
      
      <Tabs defaultValue="swim" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="swim">Natation</TabsTrigger>
          <TabsTrigger value="strength">Musculation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="swim" className="space-y-6 animate-in fade-in">
             <div className="flex flex-wrap items-center justify-end gap-2">
               <span className="text-xs uppercase text-muted-foreground">Période</span>
               <Select value={String(swimPeriodDays)} onValueChange={(value) => setSwimPeriodDays(Number(value))}>
                 <SelectTrigger className="h-8 w-[140px]">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="7">7 jours</SelectItem>
                   <SelectItem value="30">30 jours</SelectItem>
                   <SelectItem value="365">365 jours</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Volume ({swimPeriodDays}j)</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold font-mono">{swimSessionsTotals.distance.toLocaleString()}m</CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Séances ({swimPeriodDays}j)</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold font-mono">{swimSessionsCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Distance Moy</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold font-mono">{Math.round(swimSessionsAvgDistance).toLocaleString()}m</CardContent>
                </Card>
             </div>

             <SwimKpiCompactGrid
               avgRpe={swimSessionsAvgRpe}
               avgPerformance={swimSessionsAvgPerformance}
               avgEngagement={swimSessionsAvgEngagement}
               avgFatigue={swimSessionsAvgFatigue}
             />
             
             <Card>
                <CardHeader><CardTitle>Volume Quotidien</CardTitle></CardHeader>
                <CardContent className="h-[250px] w-full">
                    {swimData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Aucune donnée disponible.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={swimData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: "transparent" }} />
                                <Bar dataKey="distance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
             </Card>

             <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { key: "rpe", title: "RPE" },
                  { key: "performance", title: "Performance" },
                  { key: "engagement", title: "Engagement" },
                  { key: "fatigue", title: "Fatigue" },
                ].map((metric) => (
                  <Card key={metric.key}>
                    <CardHeader>
                      <CardTitle>{metric.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[240px] w-full">
                      {swimData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Aucune donnée disponible.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={swimData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 5]} tickLine={false} axisLine={false} fontSize={10} />
                            <Tooltip
                              cursor={{ fill: "transparent" }}
                              formatter={(value) => [value ?? "-", metric.title]}
                            />
                            <Bar dataKey={metric.key} radius={[4, 4, 0, 0]}>
                              {swimData.map((entry, index) => (
                                <Cell
                                  key={`${metric.key}-${entry.date}-${index}`}
                                  fill={scoreToColor(
                                    entry[metric.key as keyof typeof entry] as number | null,
                                    { invert: isLowScorePositive(metric.key) },
                                  )}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                ))}
             </div>
        </TabsContent>

        <TabsContent value="strength" className="space-y-6 animate-in fade-in">
             <div className="flex flex-wrap items-center justify-end gap-2">
               <span className="text-xs uppercase text-muted-foreground">Période</span>
               <Select
                 value={String(strengthPeriodDays)}
                 onValueChange={(value) => setStrengthPeriodDays(Number(value))}
               >
                 <SelectTrigger className="h-8 w-[140px]">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="7">7 jours</SelectItem>
                   <SelectItem value="30">30 jours</SelectItem>
                   <SelectItem value="365">365 jours</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Tonnage ({strengthPeriodDays}j)</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold font-mono">{Math.round(strengthTonnagePeriod).toLocaleString()} kg</CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Volume ({strengthPeriodDays}j)</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold font-mono">{Math.round(strengthVolumePeriod).toLocaleString()} reps</CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Séances ({strengthPeriodDays}j)</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold font-mono">{strengthSessionsCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Ressenti Moy</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                        <Badge
                        className={kpiBadgeClass}
                        style={{
                          backgroundColor:
                            scoreToColor(strengthAvgFeeling ?? null, {
                              invert: isLowScorePositive("rpe"),
                            }) ?? "hsl(var(--muted-foreground))",
                          color: getContrastTextColor(
                            scoreToColor(strengthAvgFeeling ?? null, {
                              invert: isLowScorePositive("rpe"),
                            }) ?? "hsl(var(--muted-foreground))",
                          ),
                        }}
                      >
                        {strengthAvgFeeling !== null ? strengthAvgFeeling.toFixed(1) : "-"}
                      </Badge>
                    </CardContent>
                </Card>
             </div>
             <Card>
                <CardHeader><CardTitle>Tonnage & Volume ({strengthPeriodDays}j)</CardTitle></CardHeader>
                <CardContent className="h-[250px] w-full">
                    {strengthAggregateData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Aucune donnée disponible.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={strengthAggregateData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="tonnage" name="Tonnage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="volume" name="Volume" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="tonnage" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="volume" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
             </Card>
             <Card>
                <CardHeader><CardTitle>Ressenti Séances</CardTitle></CardHeader>
                <CardContent className="h-[250px] w-full">
                    {strengthData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Aucune donnée disponible.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={strengthData}>
                                 <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                 <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                                 <YAxis domain={[0, 10]} hide />
                                 <Tooltip />
                                 <Line type="monotone" dataKey="feeling" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
             </Card>
             <Card>
                <CardHeader><CardTitle>Volume par exercice</CardTitle></CardHeader>
                <CardContent className="h-[260px] w-full">
                    {topExerciseVolume.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Aucune donnée d'exercice disponible.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topExerciseVolume}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} />
                                <Tooltip
                                  cursor={{ fill: "transparent" }}
                                  formatter={(value) => [`${Number(value).toLocaleString()} kg`, "Volume"]}
                                />
                                <Bar dataKey="totalVolume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
             </Card>
             <Card>
                <CardHeader><CardTitle>Stats par exercice</CardTitle></CardHeader>
                <CardContent>
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Exercice</TableHead>
                                    <TableHead className="text-right">Séries</TableHead>
                                    <TableHead className="text-right">Répétitions</TableHead>
                                    <TableHead className="text-right">Volume</TableHead>
                                    <TableHead className="text-right">Charge max</TableHead>
                                    <TableHead className="text-right">Dernière séance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {exerciseVolumeData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                            Aucun exercice enregistré.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    exerciseVolumeData.map((entry) => (
                                        <TableRow key={entry.exerciseId}>
                                            <TableCell className="font-medium">{entry.name}</TableCell>
                                            <TableCell className="text-right font-mono">{entry.totalSets}</TableCell>
                                            <TableCell className="text-right font-mono">{entry.totalReps}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {entry.totalVolume.toLocaleString()} kg
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {entry.maxWeight !== null ? `${entry.maxWeight} kg` : "-"}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {formatExerciseDate(entry.lastPerformedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
             </Card>
             <Card>
                <CardHeader><CardTitle>Historique récent</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {strengthRuns.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-6">
                            Aucun historique disponible.
                        </div>
                    )}
                    {strengthRuns.map((run) => (
                        <div key={run.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
                            <div>
                                <div className="text-sm font-semibold">
                                    {format(new Date(run.started_at || run.date || run.created_at || new Date()), "dd/MM/yyyy")}
                                </div>
                                <div className="text-xs uppercase text-muted-foreground">
                                    {run.status || "Séance"}
                                </div>
                            </div>
                            <div className="text-sm font-mono font-semibold">
                                {formatRunRpe(getRunRpeValue(run))}/10
                            </div>
                        </div>
                    ))}
                    {strengthHistoryQuery.hasNextPage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => strengthHistoryQuery.fetchNextPage()}
                          disabled={strengthHistoryQuery.isFetchingNextPage}
                        >
                          {strengthHistoryQuery.isFetchingNextPage ? "Chargement..." : "Charger plus"}
                        </Button>
                    )}
                </CardContent>
             </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

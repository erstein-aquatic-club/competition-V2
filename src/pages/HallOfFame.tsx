
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Medal, Trophy, Crown, Dumbbell, Waves, Heart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HallOfFameValue } from "@/pages/hallOfFame/HallOfFameValue";
import {
  formatHallOfFameValue,
  getValueRange,
  normalizeHallOfFameScore,
  toRelativeScore,
} from "@/pages/hallOfFame/valueUtils";
import { Link } from "wouter";

export default function HallOfFame() {
  const { data } = useQuery({
    queryKey: ["hall-of-fame"],
    queryFn: () => api.getHallOfFame()
  });

  const rawSwimDistance = (data as { distance?: any[] } | undefined)?.distance ?? [];
  const rawSwimPerformance = (data as { performance?: any[] } | undefined)?.performance ?? [];
  const rawSwimEngagement = (data as { engagement?: any[] } | undefined)?.engagement ?? [];
  const strengthStats = (data as { strength?: any[] } | undefined)?.strength ?? [];
  const swimDistance = rawSwimDistance.map((item: any) => ({
    ...item,
    total_distance: Number(item.total_distance ?? 0),
  }));
  const swimPerformance = rawSwimPerformance.map((item: any) => ({
    ...item,
    avg_effort: normalizeHallOfFameScore(item.avg_effort),
  }));
  const swimEngagement = rawSwimEngagement.map((item: any) => ({
    ...item,
    avg_engagement: normalizeHallOfFameScore(item.avg_engagement),
  }));
  const strengthTonnage = [...strengthStats]
    .sort((a, b) => Number(b.total_volume ?? 0) - Number(a.total_volume ?? 0))
    .slice(0, 5);
  const strengthReps = [...strengthStats]
    .sort((a, b) => Number(b.total_reps ?? 0) - Number(a.total_reps ?? 0))
    .slice(0, 5);
  const distanceRange = getValueRange(swimDistance.map((item: any) => Number(item.total_distance ?? 0)));
  const tonnageRange = getValueRange(strengthTonnage.map((item: any) => Number(item.total_volume ?? 0)));
  const repsRange = getValueRange(strengthReps.map((item: any) => Number(item.total_reps ?? 0)));

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 0) return <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500" />;
    if (rank === 1) return <Medal className="h-5 w-5 text-gray-400 fill-gray-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-amber-700 fill-amber-700" />;
    return <span className="font-mono font-bold text-muted-foreground w-6 text-center">{rank + 1}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Hall of Fame</h1>
        <Link href="/records-club">
          <Button variant="outline">Voir les records du club</Button>
        </Link>
      </div>

      <Tabs defaultValue="swim" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="swim"><Waves className="mr-2 h-4 w-4"/> Bassin</TabsTrigger>
            <TabsTrigger value="strength"><Dumbbell className="mr-2 h-4 w-4"/> Muscu</TabsTrigger>
        </TabsList>

        <TabsContent value="swim" className="space-y-6 pt-4 animate-in slide-in-from-left-4 motion-reduce:animate-none">
             <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-t-4 border-t-yellow-500 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Distance
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {swimDistance.map((item: any, index: number) => {
                      const distanceKm = item.total_distance ? item.total_distance / 1000 : 0;
                      return (
                    <div key={item.athlete_name} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-4 min-w-0">
                        <RankIcon rank={index} />
                        <div className="font-bold uppercase tracking-tight truncate">{item.athlete_name}</div>
                        </div>
                        <div className="shrink-0">
                          <HallOfFameValue
                          value={formatHallOfFameValue(distanceKm, { decimals: 1, suffix: "km" })}
                          toneScore={toRelativeScore(item.total_distance, distanceRange)}
                          />
                        </div>
                    </div>
                      );
                    })}
                    {swimDistance.length === 0 && <div className="text-center text-muted-foreground py-4">Aucune donnée</div>}
                </CardContent>
                </Card>

                <Card className="border-t-4 border-t-orange-500 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-5 w-5 text-orange-500" />
                    Top Intensité (RPE Avg)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {swimPerformance.map((item: any, index: number) => (
                    <div key={item.athlete_name} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-4 min-w-0">
                        <RankIcon rank={index} />
                        <div className="font-bold uppercase tracking-tight truncate">{item.athlete_name}</div>
                        </div>
                        <div className="shrink-0">
                          <HallOfFameValue
                          value={formatHallOfFameValue(item.avg_effort, { decimals: 1 })}
                          toneScore={item.avg_effort}
                          />
                        </div>
                    </div>
                    ))}
                    {swimPerformance.length === 0 && <div className="text-center text-muted-foreground py-4">Aucune donnée</div>}
                </CardContent>
                </Card>

                <Card className="border-t-4 border-t-rose-500 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="h-5 w-5 text-rose-500" />
                    Top Engagement
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {swimEngagement.map((item: any, index: number) => (
                    <div key={`${item.athlete_name}-engagement`} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-4 min-w-0">
                        <RankIcon rank={index} />
                        <div className="font-bold uppercase tracking-tight truncate">{item.athlete_name}</div>
                        </div>
                        <div className="shrink-0">
                          <HallOfFameValue
                          value={formatHallOfFameValue(item.avg_engagement, { decimals: 1 })}
                          toneScore={item.avg_engagement}
                          />
                        </div>
                    </div>
                    ))}
                    {swimEngagement.length === 0 && <div className="text-center text-muted-foreground py-4">Aucune donnée</div>}
                </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="strength" className="space-y-6 pt-4 animate-in slide-in-from-right-4 motion-reduce:animate-none">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-t-4 border-t-emerald-500 shadow-md">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Trophy className="h-5 w-5 text-emerald-500" />
                        Top Tonnage
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {strengthTonnage.map((item: any, index: number) => (
                           <div key={item.athlete_name} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-4 min-w-0">
                              <RankIcon rank={index} />
                              <div className="font-bold uppercase tracking-tight truncate">{item.athlete_name}</div>
                              </div>
                              <div className="shrink-0">
                                <HallOfFameValue
                                  value={formatHallOfFameValue(Number(item.total_volume ?? 0), { suffix: "kg" })}
                                  toneScore={toRelativeScore(Number(item.total_volume ?? 0), tonnageRange)}
                                />
                              </div>
                          </div>
                      ))}
                      {strengthTonnage.length === 0 && <div className="text-center text-muted-foreground py-4">Aucune donnée</div>}
                  </CardContent>
              </Card>

              <Card className="border-t-4 border-t-violet-500 shadow-md">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Trophy className="h-5 w-5 text-violet-500" />
                        Top Volume (Répétitions)
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {strengthReps.map((item: any, index: number) => (
                           <div key={`${item.athlete_name}-reps`} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-4 min-w-0">
                              <RankIcon rank={index} />
                              <div className="font-bold uppercase tracking-tight truncate">{item.athlete_name}</div>
                              </div>
                              <div className="shrink-0">
                                <HallOfFameValue
                                  value={formatHallOfFameValue(Number(item.total_reps ?? 0), { suffix: "reps" })}
                                  toneScore={toRelativeScore(Number(item.total_reps ?? 0), repsRange)}
                                />
                              </div>
                          </div>
                      ))}
                      {strengthReps.length === 0 && <div className="text-center text-muted-foreground py-4">Aucune donnée</div>}
                  </CardContent>
              </Card>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

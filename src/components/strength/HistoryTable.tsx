import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { LocalStrengthRun } from "@/lib/types";

interface HistoryTableProps {
  athleteName: string | null;
  athleteId: number | null;
  athleteKey: number | string | null;
}

export function HistoryTable({ athleteName, athleteId, athleteKey }: HistoryTableProps) {
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  const strengthHistoryQuery = useInfiniteQuery({
    queryKey: ["strength_history", athleteKey, historyStatus, historyFrom, historyTo],
    queryFn: ({ pageParam = 0 }) =>
      api.getStrengthHistory(athleteName!, {
        athleteId: athleteId,
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

  const historyRuns = strengthHistoryQuery.data?.pages.flatMap((page) => page.runs) ?? [];

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="strength-history-status">Statut</Label>
          <Select value={historyStatus} onValueChange={setHistoryStatus}>
            <SelectTrigger id="strength-history-status">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
              <SelectItem value="abandoned">Abandonné</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="strength-history-from">Du</Label>
          <Input
            id="strength-history-from"
            type="date"
            value={historyFrom}
            onChange={(event) => setHistoryFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="strength-history-to">Au</Label>
          <Input
            id="strength-history-to"
            type="date"
            value={historyTo}
            onChange={(event) => setHistoryTo(event.target.value)}
          />
        </div>
      </div>

      {historyRuns.map((run: LocalStrengthRun) => (
        <Card key={run.id} className="group hover:border-primary/50 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex justify-between">
              <CardTitle className="text-base font-bold uppercase">
                {format(
                  new Date(run.started_at || run.date || run.created_at || new Date()),
                  "dd MMM yyyy",
                  { locale: fr }
                )}
              </CardTitle>
              <div className="text-sm font-mono font-bold text-muted-foreground group-hover:text-primary">
                {run.duration ?? 0} min
              </div>
            </div>
            <div className="flex gap-2 text-xs font-bold text-muted-foreground">
              <span>Difficulté {run.feeling ?? run.rpe ?? 0}/5</span>
              <span>•</span>
              <span>{run.logs?.length || 0} Séries</span>
            </div>
          </CardHeader>
        </Card>
      ))}

      {historyRuns.length === 0 && (
        <div className="text-center text-muted-foreground py-10">Aucun historique.</div>
      )}

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
    </div>
  );
}

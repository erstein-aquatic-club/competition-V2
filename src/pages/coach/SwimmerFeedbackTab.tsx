import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const INDICATORS = [
  { key: "effort" as const, label: "Diff.", mode: "hard" as const },
  { key: "feeling" as const, label: "Fat.", mode: "hard" as const },
  { key: "performance" as const, label: "Perf", mode: "good" as const },
  { key: "engagement" as const, label: "Eng.", mode: "good" as const },
];

function indicatorColor(mode: "hard" | "good", value: number | null | undefined): string {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 1 || v > 5) return "bg-muted text-muted-foreground";
  const effective = mode === "hard" ? 6 - v : v;
  if (effective >= 4) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (effective >= 3) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

interface Props {
  athleteId: number;
  athleteName: string;
  onOpenProgression?: () => void;
}

export default function SwimmerFeedbackTab({
  athleteId,
  athleteName,
  onOpenProgression,
}: Props) {
  const [, navigate] = useLocation();
  const { setSelectedAthlete } = useAuth();
  const [limit, setLimit] = useState(20);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", athleteId],
    queryFn: () => api.getSessions(athleteName, athleteId),
  });

  const displayed = sessions.slice(0, limit);
  const hasMore = sessions.length > limit;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-3 animate-pulse motion-reduce:animate-none">
            <div className="h-4 w-32 rounded bg-muted mb-2" />
            <div className="h-3 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun ressenti enregistre.
      </p>
    );
  }

  const handleOpenProgression = () => {
    if (onOpenProgression) {
      onOpenProgression();
      return;
    }
    setSelectedAthlete({ id: athleteId, name: athleteName });
    navigate("/progress");
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs gap-1.5"
        onClick={handleOpenProgression}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        Voir la progression
      </Button>

      {displayed.map((session) => {
        const isExpanded = expandedId === session.id;
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => { setActiveTooltip(null); setExpandedId(isExpanded ? null : session.id); }}
            className="w-full rounded-2xl border bg-card p-3 text-left hover:border-primary/20 transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-foreground">
                  {new Date(session.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">{session.slot}</span>
              </div>
              <div className="flex items-center gap-1">
                {INDICATORS.map((ind) => {
                  const value = session[ind.key] as number | null | undefined;
                  const tooltipId = `${session.id}-${ind.key}`;
                  const isTooltipActive = activeTooltip === tooltipId;
                  return (
                    <span
                      key={ind.key}
                      className="relative group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(isTooltipActive ? null : tooltipId);
                      }}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center h-6 w-6 rounded-lg text-[10px] font-bold cursor-pointer",
                          indicatorColor(ind.mode, value)
                        )}
                      >
                        {value ?? "\u2014"}
                      </span>
                      {/* Tooltip: hover on desktop, tap on mobile */}
                      <span
                        className={cn(
                          "absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-foreground text-background px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap pointer-events-none transition-opacity",
                          "opacity-0 group-hover:opacity-100",
                          isTooltipActive && "opacity-100"
                        )}
                      >
                        {ind.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">
                {session.distance > 0 ? `${session.distance}m` : "\u2014"}
              </span>
              {session.comments && (
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
              )}
            </div>

            {isExpanded && session.comments && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-foreground whitespace-pre-wrap">{session.comments}</p>
              </div>
            )}
          </button>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setLimit((l) => l + 20); }}
          className="w-full rounded-2xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition"
        >
          Charger plus ({sessions.length - limit} restants)
        </button>
      )}
    </div>
  );
}

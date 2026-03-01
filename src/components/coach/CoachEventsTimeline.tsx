import { Calendar, Trophy, MessageSquare, RotateCcw, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCoachEventsTimeline,
  type EventType,
  type EventUrgency,
  type TimelineEvent,
} from "@/hooks/useCoachEventsTimeline";

// ── Config ───────────────────────────────────────────────────

const TYPE_CONFIG: Record<EventType, { icon: typeof Calendar; label: string; dotColor: string; borderColor: string }> = {
  competition: { icon: Trophy, label: "Compétition", dotColor: "bg-blue-500", borderColor: "border-blue-200 dark:border-blue-800" },
  interview: { icon: MessageSquare, label: "Entretien", dotColor: "bg-amber-500", borderColor: "border-amber-200 dark:border-amber-800" },
  cycle_end: { icon: RotateCcw, label: "Fin de cycle", dotColor: "bg-violet-500", borderColor: "border-violet-200 dark:border-violet-800" },
};

const URGENCY_CONFIG: Record<EventUrgency, { label: string; className: string }> = {
  overdue: { label: "En retard", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  imminent: { label: "Imminent", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  upcoming: { label: "À venir", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  future: { label: "Futur", className: "bg-muted text-muted-foreground" },
};

const PERIOD_OPTIONS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "0", label: "Tout" },
];

const TYPE_FILTER_OPTIONS: Array<{ value: EventType | "all"; label: string }> = [
  { value: "all", label: "Tout" },
  { value: "competition", label: "Compétitions" },
  { value: "interview", label: "Entretiens" },
  { value: "cycle_end", label: "Cycles" },
];

// ── Sub-components ───────────────────────────────────────────

function TimelineItem({ event }: { event: TimelineEvent }) {
  const cfg = TYPE_CONFIG[event.type];
  const urgCfg = URGENCY_CONFIG[event.urgency];
  const Icon = cfg.icon;

  const dateFormatted = new Date(event.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {/* Dot on the timeline */}
      <div className="relative flex flex-col items-center">
        <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.dotColor} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Card */}
      <div className={`flex-1 rounded-lg border ${cfg.borderColor} bg-card p-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
            {event.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{event.subtitle}</p>
            )}
          </div>
          <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 ${urgCfg.className}`}>
            {urgCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{dateFormatted}</p>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse motion-reduce:animate-none">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export function CoachEventsTimeline() {
  const {
    events,
    isLoading,
    typeFilter,
    setTypeFilter,
    periodDays,
    setPeriodDays,
    counts,
  } = useCoachEventsTimeline();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Échéances</h2>
        <span className="text-xs text-muted-foreground">{counts.total} événement{counts.total !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex gap-1">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  typeFilter === opt.value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {opt.label}
                {opt.value !== "all" && counts[opt.value as EventType] > 0 && (
                  <span className="ml-1 opacity-60">{counts[opt.value as EventType]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <Select
          value={String(periodDays)}
          onValueChange={(v) => setPeriodDays(Number(v))}
        >
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline body */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune échéance à venir</p>
        </div>
      ) : (
        <div className="relative ml-4 border-l-2 border-border pl-0">
          {events.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

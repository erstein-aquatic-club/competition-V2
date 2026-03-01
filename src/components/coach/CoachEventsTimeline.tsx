import { Calendar, Trophy, MessageSquare, RotateCcw, Filter, Clock } from "lucide-react";
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

const TYPE_CONFIG: Record<
  EventType,
  {
    icon: typeof Calendar;
    label: string;
    dotColor: string;
    glowColor: string;
    accentBorder: string;
    accentBg: string;
  }
> = {
  competition: {
    icon: Trophy,
    label: "Compétition",
    dotColor: "bg-blue-500",
    glowColor: "shadow-[0_0_8px_rgba(59,130,246,0.5)]",
    accentBorder: "border-l-blue-500",
    accentBg: "bg-blue-500/5 dark:bg-blue-500/10",
  },
  interview: {
    icon: MessageSquare,
    label: "Entretien",
    dotColor: "bg-amber-500",
    glowColor: "shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    accentBorder: "border-l-amber-500",
    accentBg: "bg-amber-500/5 dark:bg-amber-500/10",
  },
  cycle_end: {
    icon: RotateCcw,
    label: "Fin de cycle",
    dotColor: "bg-violet-500",
    glowColor: "shadow-[0_0_8px_rgba(139,92,246,0.5)]",
    accentBorder: "border-l-violet-500",
    accentBg: "bg-violet-500/5 dark:bg-violet-500/10",
  },
};

const URGENCY_CONFIG: Record<
  EventUrgency,
  { label: string; className: string; icon?: typeof Clock }
> = {
  overdue: {
    label: "En retard",
    className:
      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: Clock,
  },
  imminent: {
    label: "Imminent",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  upcoming: {
    label: "À venir",
    className:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
  future: {
    label: "Futur",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const PERIOD_OPTIONS = [
  { value: "7", label: "7j" },
  { value: "30", label: "30j" },
  { value: "90", label: "90j" },
  { value: "0", label: "Tout" },
];

const TYPE_FILTER_OPTIONS: Array<{
  value: EventType | "all";
  label: string;
  dotClass?: string;
}> = [
  { value: "all", label: "Tout" },
  { value: "competition", label: "Compétitions", dotClass: "bg-blue-500" },
  { value: "interview", label: "Entretiens", dotClass: "bg-amber-500" },
  { value: "cycle_end", label: "Cycles", dotClass: "bg-violet-500" },
];

const MONTH_NAMES_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// ── Helpers ──────────────────────────────────────────────────

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
}

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByMonth(
  events: TimelineEvent[],
): Array<{ monthKey: string; label: string; events: TimelineEvent[] }> {
  const map = new Map<
    string,
    { label: string; events: TimelineEvent[] }
  >();
  for (const event of events) {
    const key = getMonthKey(event.date);
    if (!map.has(key)) {
      map.set(key, { label: getMonthLabel(event.date), events: [] });
    }
    map.get(key)!.events.push(event);
  }
  return Array.from(map.entries()).map(([monthKey, data]) => ({
    monthKey,
    ...data,
  }));
}

// ── Sub-components ───────────────────────────────────────────

function TimelineItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const cfg = TYPE_CONFIG[event.type];
  const urgCfg = URGENCY_CONFIG[event.urgency];
  const Icon = cfg.icon;

  const dateFormatted = new Date(event.date).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="relative flex gap-4 group">
      {/* Rail connector + dot */}
      <div className="relative flex flex-col items-center">
        {/* Dot */}
        <div
          className={`
            relative z-10 flex h-9 w-9 shrink-0 items-center justify-center
            rounded-full ${cfg.dotColor} text-white
            ${cfg.glowColor}
            transition-shadow duration-300 group-hover:shadow-lg
          `}
        >
          <Icon className="h-4 w-4" />
        </div>
        {/* Connector line */}
        {!isLast && (
          <div className="w-px flex-1 bg-border" />
        )}
      </div>

      {/* Card */}
      <div
        className={`
          flex-1 mb-4 rounded-xl border border-border/60
          ${cfg.accentBg}
          border-l-[3px] ${cfg.accentBorder}
          p-3.5
          shadow-sm dark:shadow-none
          transition-all duration-200
          group-hover:shadow-md group-hover:border-border
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {event.title}
            </p>
            {event.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {event.subtitle}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] leading-none px-2 py-0.5 font-medium ${urgCfg.className}`}
          >
            {urgCfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 opacity-50" />
          <span className="capitalize">{dateFormatted}</span>
        </div>
      </div>
    </div>
  );
}

function MonthHeader({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-4 pt-2 pb-1">
      <div className="flex items-center justify-center w-9">
        <div className="h-2.5 w-2.5 rounded-full bg-border" />
      </div>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
        style={{ fontFamily: "var(--font-display, 'Oswald', sans-serif)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5 ml-0.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex gap-4 animate-pulse motion-reduce:animate-none"
        >
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2.5 pt-1">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
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

  const monthGroups = groupByMonth(events);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2
          className="text-xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display, 'Oswald', sans-serif)" }}
        >
          Échéances
        </h2>
        {counts.total > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {counts.total} événement{counts.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex gap-1">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`
                  flex items-center gap-1.5
                  rounded-full min-h-[36px] px-3 py-1.5
                  text-xs font-medium transition-all duration-150
                  active:scale-95
                  ${
                    typeFilter === opt.value
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted"
                  }
                `}
              >
                {opt.dotClass && (
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${opt.dotClass}`}
                  />
                )}
                {opt.label}
                {opt.value !== "all" &&
                  counts[opt.value as EventType] > 0 && (
                    <span className="opacity-50 tabular-nums">
                      {counts[opt.value as EventType]}
                    </span>
                  )}
              </button>
            ))}
          </div>
        </div>

        <Select
          value={String(periodDays)}
          onValueChange={(v) => setPeriodDays(Number(v))}
        >
          <SelectTrigger className="h-9 w-20 text-xs rounded-full border-border/50">
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <Calendar className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Aucune échéance à venir
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Les compétitions, entretiens et fins de cycles apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="relative">
          {monthGroups.map((group, gi) => (
            <div key={group.monthKey}>
              <MonthHeader label={group.label} />
              {group.events.map((event, ei) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  isLast={
                    gi === monthGroups.length - 1 &&
                    ei === group.events.length - 1
                  }
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

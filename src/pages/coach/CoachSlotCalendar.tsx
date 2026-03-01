import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Plus, Calendar, BookOpen, MapPin, Clock } from "lucide-react";
import { useSlotCalendar, type SlotInstance, type SlotState } from "@/hooks/useSlotCalendar";

// ── Props ──────────────────────────────────────────────────

interface CoachSlotCalendarProps {
  onBack: () => void;
  onOpenLibrary: () => void;
  onOpenSlot: (instance: SlotInstance) => void;
}

// ── Helpers ────────────────────────────────────────────────

const DAY_ABBREVS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];

function formatWeekRange(mondayIso: string, sundayIso: string): string {
  const [, mM, mD] = mondayIso.split("-").map(Number);
  const [, sM, sD] = sundayIso.split("-").map(Number);
  const monday = new Date(Number(mondayIso.split("-")[0]), mM - 1, mD);
  const sunday = new Date(Number(sundayIso.split("-")[0]), sM - 1, sD);
  const mondayMonth = monday.toLocaleDateString("fr-FR", { month: "long" });
  const sundayMonth = sunday.toLocaleDateString("fr-FR", { month: "long" });
  const year = sunday.getFullYear();
  if (mondayMonth === sundayMonth) {
    return `${mD} \u2013 ${sD} ${mondayMonth} ${year}`;
  }
  return `${mD} ${mondayMonth} \u2013 ${sD} ${sundayMonth} ${year}`;
}

function formatDayHeader(isoDate: string): { abbrev: string; label: string } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayIndex = (date.getDay() + 6) % 7; // Monday=0
  const abbrev = DAY_ABBREVS[dayIndex];
  const monthName = date.toLocaleDateString("fr-FR", { month: "long" });
  return { abbrev, label: `${d} ${monthName}` };
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} \u2013 ${end.slice(0, 5)}`;
}

function todayIso(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// ── State config ───────────────────────────────────────────

const STATE_CONFIG: Record<
  SlotState,
  {
    label: string;
    badgeClass: string;
    cardClass: string;
  }
> = {
  empty: {
    label: "Aucune s\u00e9ance",
    badgeClass: "",
    cardClass: "border-dashed border-border/60 bg-card/40",
  },
  draft: {
    label: "Brouillon",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
    cardClass: "border-amber-500/30 bg-card",
  },
  published: {
    label: "Publi\u00e9",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    cardClass: "border-emerald-500/30 bg-card",
  },
  cancelled: {
    label: "Annul\u00e9",
    badgeClass: "bg-muted text-muted-foreground border-border/50",
    cardClass: "border-border/40 bg-muted/30",
  },
};

// ── Sub-components ─────────────────────────────────────────

function SlotCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 animate-pulse motion-reduce:animate-none">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

function DaySkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-5 w-32 rounded-md" />
      <SlotCardSkeleton />
      <SlotCardSkeleton />
    </div>
  );
}

function GroupPill({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border/50 bg-muted/60 text-muted-foreground"
    >
      {color && (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {name}
    </span>
  );
}

function EmptySlotCard({ instance, onTap }: { instance: SlotInstance; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-4 transition-all duration-150 active:scale-[0.98] active:bg-muted/40 hover:border-border"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50">
          <Plus className="h-5 w-5 text-muted-foreground/60" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-muted-foreground/80">Aucune s\u00e9ance</p>
          <p className="text-xs text-muted-foreground/50 mt-0.5">
            {formatTimeRange(instance.slot.start_time, instance.slot.end_time)} &middot; {instance.slot.location}
          </p>
        </div>
      </div>
      {instance.groups.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {instance.groups.map((g) => (
            <GroupPill key={g.id} name={g.group_name} />
          ))}
        </div>
      )}
    </button>
  );
}

function FilledSlotCard({
  instance,
  onTap,
}: {
  instance: SlotInstance;
  onTap: () => void;
}) {
  const cfg = STATE_CONFIG[instance.state];
  const isCancelled = instance.state === "cancelled";

  return (
    <button
      type="button"
      onClick={onTap}
      className={`
        w-full rounded-2xl border p-4 text-left transition-all duration-150
        active:scale-[0.98] hover:shadow-md
        ${cfg.cardClass}
        ${isCancelled ? "opacity-60" : "shadow-sm"}
      `}
    >
      {/* Top row: time + badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 opacity-60" />
          <span className={isCancelled ? "line-through" : ""}>
            {formatTimeRange(instance.slot.start_time, instance.slot.end_time)}
          </span>
        </div>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-medium leading-none ${cfg.badgeClass}`}>
          {cfg.label}
        </Badge>
      </div>

      {/* Session name */}
      {instance.assignment?.session_name && (
        <p className={`text-sm font-semibold mt-2 leading-snug ${isCancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {instance.assignment.session_name}
          {instance.assignment.session_distance != null && instance.assignment.session_distance > 0 && (
            <span className="font-normal text-xs text-muted-foreground ml-1.5">
              {instance.assignment.session_distance}m
            </span>
          )}
        </p>
      )}

      {/* Location */}
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 opacity-50" />
        <span className={isCancelled ? "line-through" : ""}>{instance.slot.location}</span>
      </div>

      {/* Groups */}
      {instance.groups.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {instance.groups.map((g) => (
            <GroupPill key={g.id} name={g.group_name} />
          ))}
        </div>
      )}

      {/* Visible from indicator (draft) */}
      {instance.state === "draft" && instance.assignment?.visible_from && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 italic">
          Visible le {new Date(instance.assignment.visible_from).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </p>
      )}

      {/* Cancellation reason */}
      {isCancelled && instance.override?.reason && (
        <p className="text-[10px] text-muted-foreground mt-2 italic">
          {instance.override.reason}
        </p>
      )}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────

export default function CoachSlotCalendar({
  onBack,
  onOpenLibrary,
  onOpenSlot,
}: CoachSlotCalendarProps) {
  const {
    weekOffset,
    mondayIso,
    sundayIso,
    weekDates,
    instancesByDate,
    isLoading,
    navigateToday,
    prevWeek,
    nextWeek,
  } = useSlotCalendar();

  const today = useMemo(() => todayIso(), []);
  const weekLabel = useMemo(
    () => formatWeekRange(mondayIso, sundayIso),
    [mondayIso, sundayIso],
  );

  return (
    <div className="space-y-0 pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 -mx-4 bg-background/95 backdrop-blur border-b px-4 pb-3 pt-3 space-y-3">
        {/* Top bar: back, title, library link */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Retour
          </Button>
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display, 'Oswald', sans-serif)" }}
          >
            S\u00e9ances
          </h1>
          <Button variant="ghost" size="sm" className="-mr-2 text-primary" onClick={onOpenLibrary}>
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Biblioth\u00e8que
          </Button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={prevWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <p className="flex-1 text-center text-sm font-semibold capitalize tabular-nums">
            {weekLabel}
          </p>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={nextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {weekOffset !== 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs px-3"
              onClick={navigateToday}
            >
              Aujourd'hui
            </Button>
          )}
        </div>
      </div>

      {/* ── Day sections ── */}
      <div className="space-y-5 pt-4">
        {isLoading ? (
          <>
            <DaySkeleton />
            <DaySkeleton />
            <DaySkeleton />
          </>
        ) : (
          weekDates.map((dateIso) => {
            const slots = instancesByDate.get(dateIso) ?? [];
            const isToday = dateIso === today;
            const { abbrev, label } = formatDayHeader(dateIso);

            return (
              <DaySection
                key={dateIso}
                dateIso={dateIso}
                abbrev={abbrev}
                label={label}
                isToday={isToday}
                slots={slots}
                onOpenSlot={onOpenSlot}
              />
            );
          })
        )}
      </div>

      {/* Empty state — no slots at all */}
      {!isLoading &&
        Array.from(instancesByDate.values()).every((arr) => arr.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <Calendar className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Aucun cr\u00e9neau cette semaine
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[260px]">
              Configurez vos cr\u00e9neaux r\u00e9currents dans les param\u00e8tres pour les voir appara\u00eetre ici
            </p>
          </div>
        )}
    </div>
  );
}

// ── DaySection sub-component ──────────────────────────────

function DaySection({
  dateIso,
  abbrev,
  label,
  isToday,
  slots,
  onOpenSlot,
}: {
  dateIso: string;
  abbrev: string;
  label: string;
  isToday: boolean;
  slots: SlotInstance[];
  onOpenSlot: (instance: SlotInstance) => void;
}) {
  if (slots.length === 0) {
    return null; // Hide days with no slots
  }

  return (
    <div
      className={`
        relative rounded-2xl transition-colors
        ${isToday ? "bg-primary/[0.03]" : ""}
      `}
    >
      {/* Today left accent bar */}
      {isToday && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
      )}

      <div className={isToday ? "pl-3" : ""}>
        {/* Day header */}
        <div className="flex items-center gap-2 pb-2">
          <span
            className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}
          >
            {abbrev}
          </span>
          <span
            className={`text-sm font-semibold capitalize ${isToday ? "text-foreground" : "text-foreground/80"}`}
          >
            {label}
          </span>
          {isToday && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Aujourd'hui
            </span>
          )}
        </div>

        {/* Slot cards stack */}
        <div className="space-y-2">
          {slots.map((instance) =>
            instance.state === "empty" ? (
              <EmptySlotCard
                key={`${instance.slot.id}-${instance.date}`}
                instance={instance}
                onTap={() => onOpenSlot(instance)}
              />
            ) : (
              <FilledSlotCard
                key={`${instance.slot.id}-${instance.date}`}
                instance={instance}
                onTap={() => onOpenSlot(instance)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

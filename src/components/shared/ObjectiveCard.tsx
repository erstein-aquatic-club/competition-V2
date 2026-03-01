/**
 * Shared ObjectiveCard — interview-inspired design.
 *
 * Replaces 5 duplicate implementations across:
 *   SwimmerObjectivesView, SwimmerObjectivesTab, CoachObjectivesScreen,
 *   AthleteInterviewsSection, SwimmerInterviewsTab.
 *
 * Design: colored left border (stroke), subtle tinted bg, no outer border,
 * clean text hierarchy, optional progress bar.
 */

import { Badge } from "@/components/ui/badge";
import type { Objective } from "@/lib/api";
import {
  eventLabel,
  formatTime,
  STROKE_COLORS,
  strokeFromCode,
  findBestPerformance,
  computeProgress,
  progressBarColor,
  daysUntil,
} from "@/lib/objectiveHelpers";

// ── Stroke-based subtle background tints ────────────────────────

const STROKE_BG: Record<string, string> = {
  NL: "bg-blue-50/50 dark:bg-blue-950/15",
  DOS: "bg-emerald-50/50 dark:bg-emerald-950/15",
  BR: "bg-rose-50/50 dark:bg-rose-950/15",
  PAP: "bg-violet-50/50 dark:bg-violet-950/15",
  QN: "bg-amber-50/50 dark:bg-amber-950/15",
};

function fmtDate(d: string) {
  const p = d.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}`;
  return d;
}

// ── Types ────────────────────────────────────────────────────────

type Performance = {
  event_code: string;
  pool_length?: number | null;
  time_seconds?: number | null;
  competition_date?: string | null;
};

export type ObjectiveCardProps = {
  objective: Objective;
  /** Performance data for progress calculation (optional). */
  performances?: Performance[];
  /** Makes the card clickable (for edit). */
  onClick?: () => void;
  /** Compact single-line mode for embedded views. */
  compact?: boolean;
  /** Show a "Coach" badge when the objective comes from the coach. */
  showCoachBadge?: boolean;
};

// ── Component ───────────────────────────────────────────────────

export function ObjectiveCard({
  objective,
  performances = [],
  onClick,
  compact = false,
  showCoachBadge = false,
}: ObjectiveCardProps) {
  const hasChrono = !!objective.event_code;
  const stroke = hasChrono ? strokeFromCode(objective.event_code!) : null;
  const borderColor = stroke ? STROKE_COLORS[stroke] ?? "border-l-muted-foreground/30" : "border-l-muted-foreground/30";
  const bgTint = stroke ? STROKE_BG[stroke] ?? "bg-muted/20" : "bg-muted/20";

  const bestPerf = hasChrono
    ? findBestPerformance(performances, objective.event_code!, objective.pool_length)
    : null;

  let delta: number | null = null;
  let progressPct: number | null = null;
  if (bestPerf && objective.target_time_seconds != null && objective.event_code) {
    delta = bestPerf.time - objective.target_time_seconds;
    progressPct = computeProgress(bestPerf.time, objective.target_time_seconds, objective.event_code);
  }

  const hasCompetition = !!objective.competition_name;
  const leftDays = objective.competition_date ? daysUntil(objective.competition_date) : null;

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={[
        "w-full text-left rounded-r-lg border-l-4",
        borderColor,
        bgTint,
        compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
        "transition-colors",
        onClick ? "hover:brightness-95 dark:hover:brightness-110 active:scale-[0.995]" : "",
      ].join(" ")}
      onClick={onClick}
    >
      {/* ── Primary line: event + pool + coach badge ── */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={`font-semibold truncate ${compact ? "text-xs" : "text-sm"}`}>
          {hasChrono ? eventLabel(objective.event_code!) : (objective.text ? "Objectif" : "—")}
        </span>
        {hasChrono && objective.pool_length && (
          <span className="text-muted-foreground/60 text-xs shrink-0">{objective.pool_length}m</span>
        )}
        {showCoachBadge && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-tight ml-auto shrink-0">
            Coach
          </Badge>
        )}
      </div>

      {/* ── Text objective ── */}
      {objective.text && (
        <p className={`text-muted-foreground mt-0.5 ${compact ? "text-[11px] truncate" : "text-xs line-clamp-2"}`}>
          {objective.text}
        </p>
      )}

      {/* ── Times row: target → current + delta ── */}
      {objective.target_time_seconds != null && (
        <div className={`flex items-center gap-3 mt-1.5 font-mono tabular-nums ${compact ? "text-[11px]" : "text-xs"}`}>
          <span className="text-primary font-medium">
            {formatTime(objective.target_time_seconds)}
          </span>
          {bestPerf && (
            <>
              <span className="text-muted-foreground">
                {formatTime(bestPerf.time)}
              </span>
              {delta != null && (
                <span className={delta <= 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {delta <= 0 ? "Atteint" : `+${delta.toFixed(1)}s`}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* ── No performance yet ── */}
      {hasChrono && objective.target_time_seconds != null && !bestPerf && performances.length > 0 && (
        <p className="text-[10px] text-muted-foreground/50 mt-1 italic">
          Pas encore de temps enregistré
        </p>
      )}

      {/* ── Progress bar ── */}
      {progressPct != null && (
        <div className="mt-1.5">
          <div className="h-1 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor(progressPct)}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Competition countdown ── */}
      {hasCompetition && (
        <p className={`text-muted-foreground/60 mt-1 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {objective.competition_name}
          {leftDays != null && leftDays > 0 && <span className="ml-1">· J-{leftDays}</span>}
        </p>
      )}
    </Tag>
  );
}

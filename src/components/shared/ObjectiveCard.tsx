/**
 * Shared ObjectiveCard — athletic minimal design.
 *
 * SVG progress ring as the focal visual element (replaces border + bar).
 * Two-line layout: event + times. Minimal labels. Maximum clarity.
 *
 * Used across: SwimmerObjectivesView, SwimmerObjectivesTab,
 * CoachObjectivesScreen, AthleteInterviewsSection, SwimmerInterviewsTab.
 */

import { Badge } from "@/components/ui/badge";
import type { Objective } from "@/lib/api";
import {
  eventLabel,
  formatTime,
  strokeFromCode,
  findBestPerformance,
  computeProgress,
  daysUntil,
} from "@/lib/objectiveHelpers";

// ── Stroke colors (hex for SVG) ─────────────────────────────────

const RING_HEX: Record<string, string> = {
  NL: "#3b82f6",
  DOS: "#10b981",
  BR: "#f43f5e",
  PAP: "#8b5cf6",
  QN: "#f59e0b",
};
const RING_DEFAULT = "#a1a1aa";

// ── Progress Ring (SVG) ─────────────────────────────────────────

function ProgressRing({
  size = 36,
  strokeWidth = 3,
  progress,
  color,
}: {
  size?: number;
  strokeWidth?: number;
  progress: number | null;
  color: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = progress != null ? Math.min(Math.max(progress, 0), 100) : 0;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/10"
      />
      {/* Filled arc */}
      {progress != null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
      )}
      {/* Center dot when no progress data */}
      {progress == null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
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
  performances?: Performance[];
  onClick?: () => void;
  compact?: boolean;
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
  const ringColor = stroke ? RING_HEX[stroke] ?? RING_DEFAULT : RING_DEFAULT;

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

  // ── Compact (embedded in Suivi) ──
  if (compact) {
    return (
      <Tag
        type={onClick ? "button" : undefined}
        className="w-full text-left flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40 active:scale-[0.995]"
        onClick={onClick}
      >
        <ProgressRing
          size={24}
          strokeWidth={2.5}
          progress={progressPct}
          color={ringColor}
        />
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
          <span className="text-xs font-semibold truncate">
            {hasChrono ? eventLabel(objective.event_code!) : (objective.text ?? "—")}
          </span>
          {hasChrono && objective.pool_length && (
            <span className="text-[10px] text-muted-foreground/50 shrink-0">{objective.pool_length}m</span>
          )}
        </div>
        {objective.target_time_seconds != null && (
          <span className="text-[11px] font-mono tabular-nums text-primary shrink-0">
            {formatTime(objective.target_time_seconds)}
          </span>
        )}
        {delta != null && (
          <span className={`text-[10px] font-mono tabular-nums shrink-0 ${delta <= 0 ? "text-emerald-500 font-semibold" : "text-muted-foreground/60"}`}>
            {delta <= 0 ? "OK" : `+${delta.toFixed(1)}`}
          </span>
        )}
        {showCoachBadge && (
          <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight shrink-0">
            C
          </Badge>
        )}
      </Tag>
    );
  }

  // ── Normal ──
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className="w-full text-left flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/30 active:scale-[0.995]"
      onClick={onClick}
    >
      {/* Ring */}
      <div className="pt-0.5">
        <ProgressRing
          size={36}
          strokeWidth={3}
          progress={progressPct}
          color={ringColor}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Line 1: event + pool */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">
            {hasChrono ? eventLabel(objective.event_code!) : (objective.text ? "Objectif" : "—")}
          </span>
          {hasChrono && objective.pool_length && (
            <span className="text-xs text-muted-foreground/50 shrink-0">{objective.pool_length}m</span>
          )}
          {showCoachBadge && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-tight ml-auto shrink-0">
              Coach
            </Badge>
          )}
        </div>

        {/* Text objective */}
        {objective.text && hasChrono && (
          <p className="text-xs text-muted-foreground line-clamp-1">{objective.text}</p>
        )}

        {/* Line 2: times (target → current + delta) */}
        {objective.target_time_seconds != null && (
          <div className="flex items-baseline gap-2 font-mono tabular-nums text-xs mt-1">
            <span className="text-primary font-medium">
              {formatTime(objective.target_time_seconds)}
            </span>
            {bestPerf && (
              <>
                <span className="text-muted-foreground/40">→</span>
                <span className="text-muted-foreground">
                  {formatTime(bestPerf.time)}
                </span>
                {delta != null && (
                  <span className={delta <= 0 ? "text-emerald-500 font-semibold" : "text-muted-foreground/50"}>
                    {delta <= 0 ? "Atteint" : `+${delta.toFixed(1)}s`}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* No perf yet */}
        {hasChrono && objective.target_time_seconds != null && !bestPerf && performances.length > 0 && (
          <p className="text-[10px] text-muted-foreground/40 mt-0.5 italic">
            Pas encore de temps
          </p>
        )}

        {/* Text-only objective (no chrono) */}
        {!hasChrono && objective.text && (
          <p className="text-xs text-muted-foreground line-clamp-2">{objective.text}</p>
        )}

        {/* Competition countdown */}
        {hasCompetition && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            {objective.competition_name}
            {leftDays != null && leftDays > 0 && <span> · J-{leftDays}</span>}
          </p>
        )}
      </div>
    </Tag>
  );
}

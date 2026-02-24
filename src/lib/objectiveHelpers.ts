/**
 * Shared helpers for objective display and input (used by both coach and swimmer views).
 */

export const FFN_EVENTS = [
  "50NL", "100NL", "200NL", "400NL", "800NL", "1500NL",
  "50DOS", "100DOS", "200DOS",
  "50BR", "100BR", "200BR",
  "50PAP", "100PAP", "200PAP",
  "200QN", "400QN",
];

export function eventLabel(code: string): string {
  const match = code.match(/^(\d+)(NL|DOS|BR|PAP|QN)$/);
  if (!match) return code;
  const names: Record<string, string> = {
    NL: "Nage Libre",
    DOS: "Dos",
    BR: "Brasse",
    PAP: "Papillon",
    QN: "4 Nages",
  };
  return `${match[1]}m ${names[match[2]] || match[2]}`;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const centisecs = Math.round((secs - wholeSecs) * 100);
  return `${mins}:${String(wholeSecs).padStart(2, "0")}:${String(centisecs).padStart(2, "0")}`;
}

export function parseTime(display: string): number | null {
  const match = display.match(/^(\d+):(\d{2})[.::](\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
}

/**
 * Mapping from objective event_code to possible swim_records event_name values.
 * swim_records.event_name comes from FFN import and varies in format.
 */
const EVENT_CODE_TO_NAMES: Record<string, string[]> = {
  "50NL": ["50 NL", "50 Nage Libre"],
  "100NL": ["100 NL", "100 Nage Libre"],
  "200NL": ["200 NL", "200 Nage Libre"],
  "400NL": ["400 NL", "400 Nage Libre"],
  "800NL": ["800 NL", "800 Nage Libre"],
  "1500NL": ["1500 NL", "1500 Nage Libre"],
  "50DOS": ["50 Dos"],
  "100DOS": ["100 Dos"],
  "200DOS": ["200 Dos"],
  "50BR": ["50 Brasse"],
  "100BR": ["100 Brasse"],
  "200BR": ["200 Brasse"],
  "50PAP": ["50 Papillon", "50 Pap"],
  "100PAP": ["100 Papillon", "100 Pap"],
  "200PAP": ["200 Papillon", "200 Pap"],
  "200QN": ["200 4 Nages", "200 4N"],
  "400QN": ["400 4 Nages", "400 4N"],
};

/** Stroke color class (border-left) keyed by stroke suffix. */
export const STROKE_COLORS: Record<string, string> = {
  NL: "border-l-blue-500",
  DOS: "border-l-emerald-500",
  BR: "border-l-red-500",
  PAP: "border-l-violet-500",
  QN: "border-l-amber-500",
};

/** Extract stroke suffix from event_code (e.g. "100DOS" → "DOS"). */
export function strokeFromCode(code: string): string | null {
  const match = code.match(/^(\d+)(NL|DOS|BR|PAP|QN)$/);
  return match ? match[2] : null;
}

/**
 * Find the best (lowest) time_seconds from swim_records matching an objective.
 * Returns null if no matching record exists.
 */
export function findBestTime(
  records: Array<{ event_name: string; pool_length?: number | null; time_seconds?: number | null }>,
  eventCode: string,
  poolLength?: number | null,
): number | null {
  const names = EVENT_CODE_TO_NAMES[eventCode];
  if (!names) return null;
  const lowerNames = names.map((n) => n.toLowerCase());
  let best: number | null = null;
  for (const r of records) {
    if (r.time_seconds == null) continue;
    if (!lowerNames.includes(r.event_name.toLowerCase())) continue;
    if (poolLength != null && r.pool_length != null && r.pool_length !== poolLength) continue;
    if (best === null || r.time_seconds < best) best = r.time_seconds;
  }
  return best;
}

/** Days until a date string (YYYY-MM-DD). Negative if past. */
export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

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

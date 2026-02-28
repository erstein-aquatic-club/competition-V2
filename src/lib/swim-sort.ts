/**
 * Shared swim-sort helpers.
 * Extracted from Records.tsx to eliminate duplication between
 * filteredSwimRecords and groupedPerformances useMemo blocks.
 */

const normalize = (s: string) =>
  s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

/** Returns a numeric stroke sort key (NL=0, Dos=1, Brasse=2, Pap=3, 4N=4, unknown=99) */
export function swimStrokeKey(eventName: string): number {
  const n = normalize(eventName);
  if (n.includes("nl") || n.includes("nage libre")) return 0;
  if (n.includes("dos")) return 1;
  if (n.includes("bra") || n.includes("brasse")) return 2;
  if (n.includes("pap") || n.includes("papillon")) return 3;
  if (n.includes("4n") || n.includes("4 n") || n.includes("4 nages")) return 4;
  return 99;
}

/** Returns the numeric distance extracted from an event name, or Infinity if not found */
export function swimDistance(eventName: string): number {
  const m = eventName.match(/^(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/** Comparator to sort swim events by stroke then distance */
export function compareSwimEvents(a: string, b: string): number {
  const sa = swimStrokeKey(a);
  const sb = swimStrokeKey(b);
  if (sa !== sb) return sa - sb;
  return swimDistance(a) - swimDistance(b);
}

import { describe, it, expect } from "vitest";
import {
  computeUrgency,
  normalizeCompetitions,
  normalizeInterviews,
  normalizeCycleEnds,
  mergeAndSort,
  filterByType,
  filterByPeriod,
} from "../useCoachEventsTimeline";
import type { TimelineEvent } from "../useCoachEventsTimeline";

const TODAY = "2026-03-01";

describe("computeUrgency", () => {
  it("returns overdue for past dates", () => {
    expect(computeUrgency("2026-02-28", TODAY)).toBe("overdue");
  });
  it("returns imminent for ≤7 days", () => {
    expect(computeUrgency("2026-03-05", TODAY)).toBe("imminent");
  });
  it("returns upcoming for ≤30 days", () => {
    expect(computeUrgency("2026-03-20", TODAY)).toBe("upcoming");
  });
  it("returns future for >30 days", () => {
    expect(computeUrgency("2026-06-01", TODAY)).toBe("future");
  });
  it("returns imminent for today", () => {
    expect(computeUrgency("2026-03-01", TODAY)).toBe("imminent");
  });
});

describe("normalizeCompetitions", () => {
  it("maps a competition to TimelineEvent", () => {
    const comps = [
      { id: "c1", name: "Régionaux", date: "2026-03-15", location: "Strasbourg", end_date: null, description: null, created_by: null, created_at: null },
    ];
    const result = normalizeCompetitions(comps, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("comp-c1");
    expect(result[0].type).toBe("competition");
    expect(result[0].title).toBe("Régionaux");
    expect(result[0].subtitle).toBe("Strasbourg");
    expect(result[0].urgency).toBe("upcoming");
  });
  it("returns empty array for empty input", () => {
    expect(normalizeCompetitions([], TODAY)).toEqual([]);
  });
});

describe("normalizeInterviews", () => {
  it("maps a pending interview to TimelineEvent", () => {
    const intvs = [
      { id: "i1", athlete_id: 42, status: "draft_athlete" as const, date: "2026-03-05", athlete_name: "Léa Martin", athlete_successes: null, athlete_difficulties: null, athlete_goals: null, athlete_commitments: null, coach_review: null, coach_objectives: null, coach_actions: null, coach_comment_successes: null, coach_comment_difficulties: null, coach_comment_goals: null, athlete_commitment_review: null, current_cycle_id: null, submitted_at: null, sent_at: null, signed_at: null, created_by: null, created_at: null },
    ];
    const result = normalizeInterviews(intvs, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("intv-i1");
    expect(result[0].type).toBe("interview");
    expect(result[0].title).toBe("Entretien : Léa Martin");
    expect(result[0].subtitle).toBe("En attente nageur");
    expect(result[0].athleteName).toBe("Léa Martin");
    expect(result[0].athleteId).toBe(42);
  });
});

describe("normalizeCycleEnds", () => {
  it("maps a cycle with end_competition_date to TimelineEvent", () => {
    const cycles = [
      { id: "cy1", name: "Prépa Régionaux", end_competition_date: "2026-04-10", end_competition_name: "Championnats", athlete_id: 5, group_id: null, start_competition_id: null, end_competition_id: "c2", start_date: null, notes: null, created_by: null, created_at: null, start_competition_name: null, start_competition_date: null },
    ];
    const result = normalizeCycleEnds(cycles, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cycle-cy1");
    expect(result[0].type).toBe("cycle_end");
    expect(result[0].title).toBe("Fin cycle : Prépa Régionaux");
    expect(result[0].subtitle).toBe("Championnats");
    expect(result[0].urgency).toBe("future");
  });
  it("skips cycles without end_competition_date", () => {
    const cycles = [
      { id: "cy2", name: "Test", end_competition_date: null, end_competition_name: null, athlete_id: null, group_id: null, start_competition_id: null, end_competition_id: "c3", start_date: null, notes: null, created_by: null, created_at: null, start_competition_name: null, start_competition_date: null },
    ];
    expect(normalizeCycleEnds(cycles, TODAY)).toEqual([]);
  });
});

describe("mergeAndSort", () => {
  it("sorts events by date ascending", () => {
    const events: TimelineEvent[] = [
      { id: "a", type: "competition", date: "2026-04-01", title: "A", urgency: "future", metadata: {} },
      { id: "b", type: "interview", date: "2026-03-01", title: "B", urgency: "imminent", metadata: {} },
      { id: "c", type: "cycle_end", date: "2026-03-15", title: "C", urgency: "upcoming", metadata: {} },
    ];
    const sorted = mergeAndSort(events);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });
  it("returns empty for empty input", () => {
    expect(mergeAndSort([])).toEqual([]);
  });
});

describe("filterByType", () => {
  const events: TimelineEvent[] = [
    { id: "1", type: "competition", date: "2026-03-01", title: "A", urgency: "imminent", metadata: {} },
    { id: "2", type: "interview", date: "2026-03-01", title: "B", urgency: "imminent", metadata: {} },
    { id: "3", type: "cycle_end", date: "2026-03-01", title: "C", urgency: "imminent", metadata: {} },
  ];

  it("returns all for 'all' filter", () => {
    expect(filterByType(events, "all")).toHaveLength(3);
  });
  it("filters by competition", () => {
    const filtered = filterByType(events, "competition");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });
  it("filters by interview", () => {
    expect(filterByType(events, "interview")).toHaveLength(1);
  });
});

describe("filterByPeriod", () => {
  const events: TimelineEvent[] = [
    { id: "1", type: "competition", date: "2026-03-05", title: "A", urgency: "imminent", metadata: {} },
    { id: "2", type: "competition", date: "2026-04-15", title: "B", urgency: "future", metadata: {} },
    { id: "3", type: "competition", date: "2026-06-01", title: "C", urgency: "future", metadata: {} },
  ];

  it("returns all when periodDays=0", () => {
    expect(filterByPeriod(events, 0, TODAY)).toHaveLength(3);
  });
  it("filters to 7 days", () => {
    expect(filterByPeriod(events, 7, TODAY)).toHaveLength(1);
  });
  it("filters to 30 days", () => {
    expect(filterByPeriod(events, 30, TODAY)).toHaveLength(1);
  });
  it("filters to 90 days", () => {
    expect(filterByPeriod(events, 90, TODAY)).toHaveLength(2);
  });
});

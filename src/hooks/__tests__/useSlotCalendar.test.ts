import { describe, it, expect } from "vitest";
import {
  getMondayOfWeek,
  materializeSlots,
  computeSlotState,
} from "../useSlotCalendar";

describe("getMondayOfWeek", () => {
  it("returns the Monday for offset 0 (current week)", () => {
    const monday = getMondayOfWeek(0);
    expect(new Date(monday).getDay()).toBe(1); // 1 = Monday
  });
  it("returns next Monday for offset +1", () => {
    const thisMonday = getMondayOfWeek(0);
    const nextMonday = getMondayOfWeek(1);
    const diff = (new Date(nextMonday).getTime() - new Date(thisMonday).getTime()) / 86_400_000;
    expect(diff).toBe(7);
  });
  it("returns previous Monday for offset -1", () => {
    const thisMonday = getMondayOfWeek(0);
    const prevMonday = getMondayOfWeek(-1);
    const diff = (new Date(thisMonday).getTime() - new Date(prevMonday).getTime()) / 86_400_000;
    expect(diff).toBe(7);
  });
});

describe("materializeSlots", () => {
  const slot = {
    id: "slot-1",
    day_of_week: 0, // Monday (0-indexed, 0=Monday)
    start_time: "08:00",
    end_time: "09:30",
    location: "Piscine A",
    is_active: true,
    created_by: null,
    created_at: "",
    assignments: [
      { id: "a1", slot_id: "slot-1", group_id: 1, group_name: "Avenirs", coach_id: 10, coach_name: "Coach A", lane_count: null },
    ],
  };

  it("generates one instance per matching day in the week", () => {
    const instances = materializeSlots([slot], [], [], "2026-03-02");
    expect(instances).toHaveLength(1);
    expect(instances[0].date).toBe("2026-03-02");
    expect(instances[0].state).toBe("empty");
  });

  it("marks instance as cancelled when override exists", () => {
    const overrides = [{ id: "o1", slot_id: "slot-1", override_date: "2026-03-02", status: "cancelled" as const, new_start_time: null, new_end_time: null, new_location: null, reason: null, created_by: null, created_at: "" }];
    const instances = materializeSlots([slot], [], overrides, "2026-03-02");
    expect(instances[0].state).toBe("cancelled");
  });
});

describe("computeSlotState", () => {
  const today = "2026-03-01";

  it("returns 'empty' when no assignment", () => {
    expect(computeSlotState(undefined, today)).toBe("empty");
  });
  it("returns 'published' when visible_from is null", () => {
    expect(computeSlotState({ visible_from: null } as any, today)).toBe("published");
  });
  it("returns 'published' when visible_from <= today", () => {
    expect(computeSlotState({ visible_from: "2026-02-28" } as any, today)).toBe("published");
    expect(computeSlotState({ visible_from: "2026-03-01" } as any, today)).toBe("published");
  });
  it("returns 'draft' when visible_from > today", () => {
    expect(computeSlotState({ visible_from: "2026-03-05" } as any, today)).toBe("draft");
  });
});

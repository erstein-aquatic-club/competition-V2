import { describe, it, expect } from "vitest";
import { deriveScheduledSlot } from "../assignments";

describe("deriveScheduledSlot", () => {
  it("returns 'morning' for start_time before 13:00", () => {
    expect(deriveScheduledSlot("08:00")).toBe("morning");
    expect(deriveScheduledSlot("12:59")).toBe("morning");
  });
  it("returns 'evening' for start_time at or after 13:00", () => {
    expect(deriveScheduledSlot("13:00")).toBe("evening");
    expect(deriveScheduledSlot("18:30")).toBe("evening");
  });
});

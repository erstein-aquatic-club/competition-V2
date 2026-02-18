import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateTimesheetTotals, getShiftDurationMinutes } from "@/pages/timesheetHelpers";

test("getShiftDurationMinutes returns duration only when end time exists", () => {
  const openShift = {
    id: 1,
    coach_id: 1,
    shift_date: "2024-05-12",
    start_time: "08:00:00",
    end_time: null,
    is_travel: false,
  };
  const completedShift = {
    ...openShift,
    id: 2,
    end_time: "10:30:00",
  };

  assert.equal(getShiftDurationMinutes(openShift), null);
  assert.equal(getShiftDurationMinutes(completedShift), 150);
});

test("calculateTimesheetTotals splits travel and work per week and month", () => {
  const shifts = [
    {
      id: 1,
      coach_id: 1,
      shift_date: "2024-05-13",
      start_time: "08:00:00",
      end_time: "10:00:00",
      is_travel: false,
    },
    {
      id: 2,
      coach_id: 1,
      shift_date: "2024-05-14",
      start_time: "11:00:00",
      end_time: "11:30:00",
      is_travel: true,
    },
    {
      id: 3,
      coach_id: 1,
      shift_date: "2024-05-01",
      start_time: "09:00:00",
      end_time: "10:00:00",
      is_travel: false,
    },
    {
      id: 4,
      coach_id: 1,
      shift_date: "2024-06-02",
      start_time: "09:00:00",
      end_time: "10:00:00",
      is_travel: false,
    },
  ];

  const totals = calculateTimesheetTotals(shifts, new Date("2024-05-15T12:00:00"));

  assert.equal(totals.week.workMinutes, 120);
  assert.equal(totals.week.travelMinutes, 30);
  assert.equal(totals.month.workMinutes, 180);
  assert.equal(totals.month.travelMinutes, 30);
});

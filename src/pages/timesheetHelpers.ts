import { isSameMonth, isSameWeek } from "date-fns";

export type TimesheetShift = {
  id: number;
  coach_id: number;
  coach_name?: string | null;
  shift_date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  is_travel: boolean;
};

export type TimesheetTotals = {
  workMinutes: number;
  travelMinutes: number;
  totalMinutes: number;
};

const toDateSafe = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getShiftDurationMinutes = (shift: TimesheetShift) => {
  if (!shift.end_time) return null;
  const start = toDateSafe(shift.start_time);
  const end = toDateSafe(shift.end_time);
  if (!start || !end) return null;
  const diffMinutes = (end.getTime() - start.getTime()) / 60000;
  if (diffMinutes < 0) return null;
  return Math.round(diffMinutes);
};

const buildTotals = (shifts: TimesheetShift[]) =>
  shifts.reduce<TimesheetTotals>(
    (acc, shift) => {
      const duration = getShiftDurationMinutes(shift);
      if (duration === null) return acc;
      if (shift.is_travel) {
        acc.travelMinutes += duration;
      } else {
        acc.workMinutes += duration;
      }
      acc.totalMinutes = acc.workMinutes + acc.travelMinutes;
      return acc;
    },
    { workMinutes: 0, travelMinutes: 0, totalMinutes: 0 },
  );

export const calculateTimesheetTotals = (shifts: TimesheetShift[], referenceDate = new Date()) => {
  const weekShifts = shifts.filter((shift) => {
    const start = toDateSafe(shift.start_time);
    return start ? isSameWeek(start, referenceDate, { weekStartsOn: 1 }) : false;
  });
  const monthShifts = shifts.filter((shift) => {
    const start = toDateSafe(shift.start_time);
    return start ? isSameMonth(start, referenceDate) : false;
  });

  return {
    week: buildTotals(weekShifts),
    month: buildTotals(monthShifts),
  };
};

export const formatMinutes = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  return `${hours}h${String(remaining).padStart(2, "0")}`;
};


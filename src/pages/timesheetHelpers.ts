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
  group_names?: string[] | null;
};

export type TimesheetTotals = {
  workMinutes: number;
  travelMinutes: number;
  totalMinutes: number;
};

/** Parse a time string ("HH:MM" or "HH:MM:SS") into total minutes since midnight. */
const parseTimeMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

/** Build a Date from shift_date + optional time (used for week/month filtering). */
const shiftToDate = (shift: TimesheetShift): Date | null => {
  if (!shift.shift_date) return null;
  const date = new Date(`${shift.shift_date}T${shift.start_time || "00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getShiftDurationMinutes = (shift: TimesheetShift) => {
  if (!shift.end_time) return null;
  const startMin = parseTimeMinutes(shift.start_time);
  const endMin = parseTimeMinutes(shift.end_time);
  if (startMin === null || endMin === null) return null;
  const diff = endMin - startMin;
  if (diff < 0) return null;
  return diff;
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
    const d = shiftToDate(shift);
    return d ? isSameWeek(d, referenceDate, { weekStartsOn: 1 }) : false;
  });
  const monthShifts = shifts.filter((shift) => {
    const d = shiftToDate(shift);
    return d ? isSameMonth(d, referenceDate) : false;
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


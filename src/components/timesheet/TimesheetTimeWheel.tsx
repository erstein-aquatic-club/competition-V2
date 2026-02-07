import React from "react";

const pad2 = (value: number) => String(value).padStart(2, "0");

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const clampToStep = (value: number, step: number) => {
  const rounded = Math.round(value / step) * step;
  return clamp(rounded, 0, 60 - step);
};

export const normalizeTimeValue = (value: string, step = 5) => {
  const [rawHours, rawMinutes] = value.split(":");
  const hoursValue = Number(rawHours);
  const minutesValue = Number(rawMinutes);
  const safeHours = clamp(Number.isFinite(hoursValue) ? hoursValue : 0, 0, 23);
  const safeMinutes = clamp(Number.isFinite(minutesValue) ? minutesValue : 0, 0, 59);
  const steppedMinutes = clampToStep(safeMinutes, step);
  return `${pad2(safeHours)}:${pad2(steppedMinutes)}`;
};

const parseTimeValue = (value: string, step: number) => {
  const normalized = normalizeTimeValue(value, step);
  const [hours, minutes] = normalized.split(":").map((part) => Number(part));
  return { hours, minutes };
};

interface WheelPickerProps {
  value: number;
  values: number[];
  onChange: (value: number) => void;
  width?: number;
  itemHeight?: number;
  visibleCount?: number;
  format?: (value: number) => string;
  snapKey?: string | number;
}

function WheelPicker({
  value,
  values,
  onChange,
  width = 68,
  itemHeight = 28,
  visibleCount = 3,
  format,
  snapKey,
}: WheelPickerProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const padding = Math.floor(visibleCount / 2) * itemHeight;
  const [localValue, setLocalValue] = React.useState(value);
  const localValueRef = React.useRef(value);
  const currentValueRef = React.useRef(value);
  const rafRef = React.useRef<number | null>(null);
  const endTimerRef = React.useRef<number | null>(null);
  const isInteractingRef = React.useRef(false);

  React.useEffect(() => {
    currentValueRef.current = value;
    localValueRef.current = value;
    setLocalValue(value);

    const element = ref.current;
    if (!element || isInteractingRef.current) return;
    const index = Math.max(0, values.indexOf(value));
    element.scrollTo({ top: index * itemHeight, behavior: "instant" as ScrollBehavior });
  }, [itemHeight, value, values]);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const index = Math.max(0, values.indexOf(value));
    element.scrollTo({ top: index * itemHeight, behavior: "instant" as ScrollBehavior });
  }, [itemHeight, snapKey, value, values]);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const compute = () => {
      const index = Math.round(element.scrollTop / itemHeight);
      const nextValue = values[Math.max(0, Math.min(values.length - 1, index))];
      localValueRef.current = nextValue;
      setLocalValue(nextValue);
    };

    const commit = () => {
      const nextValue = localValueRef.current;
      if (nextValue !== currentValueRef.current) {
        onChange(nextValue);
      }
      isInteractingRef.current = false;
    };

    const onScroll = () => {
      isInteractingRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);

      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
      endTimerRef.current = window.setTimeout(commit, 140);
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    };
  }, [itemHeight, onChange, values]);

  return (
    <div style={{ width, minWidth: 0, flex: `0 0 ${width}px` }}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-[2]"
          style={{ height: padding, background: "linear-gradient(#fff, rgba(255,255,255,0))" }}
        />
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 z-[2]"
          style={{ height: padding, background: "linear-gradient(rgba(255,255,255,0), #fff)" }}
        />
        <div
          className="pointer-events-none absolute left-1.5 right-1.5 z-[1] rounded-lg"
          style={{
            top: padding,
            height: itemHeight,
            background: "rgba(17,17,17,0.14)",
            boxShadow: "inset 0 0 0 1px rgba(17,17,17,0.25)",
          }}
        />
        <div
          ref={ref}
          style={{
            height: itemHeight * visibleCount,
            overflowY: "auto",
            overflowX: "hidden",
            scrollSnapType: "y mandatory",
            scrollSnapStop: "always",
            WebkitOverflowScrolling: "touch",
            paddingTop: padding,
            paddingBottom: padding,
            touchAction: "pan-y",
            overscrollBehavior: "contain",
          }}
        >
          {values.map((entry) => {
            const isSelected = entry === localValue;
            return (
              <div
                key={entry}
                className={`flex items-center justify-center text-[15px] font-bold ${
                  isSelected ? "text-foreground" : "text-muted-foreground"
                }`}
                style={{
                  height: itemHeight,
                  scrollSnapAlign: "center",
                  fontWeight: isSelected ? 900 : 700,
                  userSelect: "none",
                }}
              >
                {format ? format(entry) : String(entry)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TimesheetTimeWheelProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  showEmptyButton?: boolean;
  snapKey?: string | number;
}

export function TimesheetTimeWheel({
  label,
  value,
  onChange,
  allowEmpty = false,
  showEmptyButton = true,
  snapKey,
}: TimesheetTimeWheelProps) {
  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = React.useMemo(() => Array.from({ length: 12 }, (_, index) => index * 5), []);
  const displayValue = value || "00:00";
  const parsed = React.useMemo(() => parseTimeValue(displayValue, 5), [displayValue]);
  const [hourValue, setHourValue] = React.useState(parsed.hours);
  const [minuteValue, setMinuteValue] = React.useState(parsed.minutes);

  React.useEffect(() => {
    setHourValue(parsed.hours);
    setMinuteValue(parsed.minutes);
  }, [parsed.hours, parsed.minutes]);

  React.useEffect(() => {
    if (!value) return;
    const normalized = normalizeTimeValue(value, 5);
    const [nextHour, nextMinute] = normalized.split(":");
    setHourValue(Number(nextHour));
    setMinuteValue(Number(nextMinute));
  }, [value]);

  const commit = React.useCallback(
    (nextHour: number, nextMinute: number) => {
      onChange(`${pad2(nextHour)}:${pad2(nextMinute)}`);
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div className="text-xs font-black text-foreground">{label}</div>
      <div className="flex flex-wrap items-end justify-center gap-2">
        <WheelPicker
          value={hourValue}
          values={hours}
          onChange={(nextHour) => {
            setHourValue(nextHour);
            commit(nextHour, minuteValue);
          }}
          format={(entry) => pad2(entry)}
          snapKey={snapKey}
        />
        <WheelPicker
          value={minuteValue}
          values={minutes}
          onChange={(nextMinute) => {
            setMinuteValue(nextMinute);
            commit(hourValue, nextMinute);
          }}
          format={(entry) => pad2(entry)}
          snapKey={snapKey}
        />
      </div>
      {allowEmpty && showEmptyButton ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mx-auto block h-8 min-w-[110px] rounded-full border border-border bg-card px-3 text-xs font-bold text-foreground"
        >
          En cours
        </button>
      ) : null}
    </div>
  );
}

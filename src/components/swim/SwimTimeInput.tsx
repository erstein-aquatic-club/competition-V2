import { useRef } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";
import { cn } from "@/lib/utils";

type TimeParts = {
  minutes: string;
  seconds: string;
  hundredths: string;
};

interface SwimTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  size?: "default" | "compact";
  className?: string;
}

function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function splitTimeValue(value: string): TimeParts {
  const trimmed = value.trim();
  if (!trimmed) {
    return { minutes: "", seconds: "", hundredths: "" };
  }

  const parts = trimmed.split(":");
  if (parts.length >= 3) {
    return {
      minutes: digitsOnly(parts[0] ?? "", 2),
      seconds: digitsOnly(parts[1] ?? "", 2),
      hundredths: digitsOnly(parts[2] ?? "", 2),
    };
  }

  if (parts.length === 2) {
    return {
      minutes: "",
      seconds: digitsOnly(parts[0] ?? "", 2),
      hundredths: digitsOnly(parts[1] ?? "", 2),
    };
  }

  const digits = digitsOnly(trimmed, 6);
  if (digits.length <= 2) {
    return { minutes: "", seconds: digits, hundredths: "" };
  }
  if (digits.length <= 4) {
    return {
      minutes: "",
      seconds: digits.slice(0, -2),
      hundredths: digits.slice(-2),
    };
  }
  return {
    minutes: digits.slice(0, -4),
    seconds: digits.slice(-4, -2),
    hundredths: digits.slice(-2),
  };
}

function buildTimeValue({ minutes, seconds, hundredths }: TimeParts) {
  if (!minutes && !seconds && !hundredths) {
    return "";
  }
  if (minutes) {
    return `${minutes}:${seconds}:${hundredths}`;
  }
  return `${seconds}:${hundredths}`;
}

export function SwimTimeInput({
  value,
  onChange,
  onBlur,
  size = "default",
  className,
}: SwimTimeInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const hundredthRef = useRef<HTMLInputElement>(null);

  const parts = splitTimeValue(value);
  const inputClass = size === "compact"
    ? "h-6 w-8 rounded-md px-1 text-xs"
    : "h-8 w-10 rounded-md px-2 text-sm";
  const separatorClass = size === "compact"
    ? "text-xs"
    : "text-sm";

  const emit = (patch: Partial<TimeParts>) => {
    onChange(
      buildTimeValue({
        ...parts,
        ...patch,
      }),
    );
  };

  const handleFieldBlur = () => {
    if (!onBlur) return;
    window.requestAnimationFrame(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        onBlur();
      }
    });
  };

  const handleChange = (
    key: keyof TimeParts,
    nextValue: string,
    nextRef?: RefObject<HTMLInputElement | null>,
  ) => {
    const sanitized = digitsOnly(nextValue, 2);
    emit({ [key]: sanitized });
    if (sanitized.length === 2 && nextRef?.current) {
      nextRef.current.focus();
      nextRef.current.select();
    }
  };

  const handleBackspace = (
    event: KeyboardEvent<HTMLInputElement>,
    valuePart: string,
    prevRef?: RefObject<HTMLInputElement | null>,
  ) => {
    if (event.key === "Backspace" && valuePart.length === 0 && prevRef?.current) {
      prevRef.current.focus();
      prevRef.current.select();
    }
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  return (
    <div ref={containerRef} className={cn("inline-flex items-center gap-1", className)}>
      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="m"
        value={parts.minutes}
        onChange={(event) => handleChange("minutes", event.target.value, secondRef)}
        onKeyDown={(event) => handleBackspace(event, parts.minutes)}
        onFocus={handleFocus}
        onBlur={handleFieldBlur}
        className={cn(
          "border border-input bg-background text-center tabular-nums outline-none focus:ring-1 focus:ring-ring",
          inputClass,
        )}
        aria-label="Minutes"
      />
      <span className={cn("text-muted-foreground font-semibold tabular-nums", separatorClass)}>:</span>
      <input
        ref={secondRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="ss"
        value={parts.seconds}
        onChange={(event) => handleChange("seconds", event.target.value, hundredthRef)}
        onKeyDown={(event) => handleBackspace(event, parts.seconds, minuteRef)}
        onFocus={handleFocus}
        onBlur={handleFieldBlur}
        className={cn(
          "border border-input bg-background text-center tabular-nums outline-none focus:ring-1 focus:ring-ring",
          inputClass,
        )}
        aria-label="Secondes"
      />
      <span className={cn("text-muted-foreground font-semibold tabular-nums", separatorClass)}>:</span>
      <input
        ref={hundredthRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="cc"
        value={parts.hundredths}
        onChange={(event) => handleChange("hundredths", event.target.value)}
        onKeyDown={(event) => handleBackspace(event, parts.hundredths, secondRef)}
        onFocus={handleFocus}
        onBlur={handleFieldBlur}
        className={cn(
          "border border-input bg-background text-center tabular-nums outline-none focus:ring-1 focus:ring-ring",
          inputClass,
        )}
        aria-label="Centiemes"
      />
    </div>
  );
}

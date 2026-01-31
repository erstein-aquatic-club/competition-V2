import { cn } from "@/lib/utils";

type QuickGridOption = { label: string; value: number };

type QuickGridProps = {
  options: QuickGridOption[];
  value: number;
  onPick: (value: number) => void;
};

export function QuickGrid({ options, value, onPick }: QuickGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            className={cn(
              "h-12 rounded-2xl border text-sm font-black transition active:scale-[0.99]",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

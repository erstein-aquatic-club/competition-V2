import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TileProps = {
  label: string;
  value: string;
  badge: ReactNode;
  hint?: string;
  onClick: () => void;
};

export function Tile({ label, value, badge, hint = "Tap pour modifier", onClick }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col justify-between rounded-2xl border border-border bg-background p-3 text-left",
        "shadow-sm transition active:scale-[0.99]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-muted text-[11px] font-black text-foreground">
          {badge}
        </div>
      </div>
      <div className="mt-2 text-base font-extrabold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-muted-foreground">{hint}</div>
    </button>
  );
}

import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type BottomSheetProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
};

export function BottomSheet({ open, title, children, onClose, className }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Fermer"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-[32px] border border-border bg-background p-4 shadow-2xl",
          className
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fermer</span>
          </Button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="pointer-events-none mx-auto mt-4 h-1.5 w-14 rounded-full bg-muted" />
      </div>
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface BottomActionBarProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export function BottomActionBar({ children, className, containerClassName }: BottomActionBarProps) {
  return (
    <div
      role="region"
      aria-label="Actions"
      className={cn(
        // Position au-dessus de la nav mobile (64px = bottom-16) avec z-index supérieur
        "fixed bottom-16 left-0 right-0 z-bar md:bottom-0 md:z-bar",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-md items-center justify-between gap-2 border-t bg-background px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]",
          "md:supports-[padding:env(safe-area-inset-bottom)]:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
          containerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

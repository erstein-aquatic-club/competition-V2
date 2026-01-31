import React from "react";
import { cn } from "@/lib/utils";

interface BottomActionBarProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export function BottomActionBar({ children, className, containerClassName }: BottomActionBarProps) {
  return (
    <div className={cn("fixed bottom-0 left-0 right-0 z-50 md:z-40", className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-md items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur",
          "supports-[padding:env(safe-area-inset-bottom)]:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
          containerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface ScrollContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollContainer({ children, className }: ScrollContainerProps) {
  return (
    <div role="region" aria-label="Contenu défilable" tabIndex={0} className={cn("overflow-y-auto overscroll-contain", className)}>
      {children}
    </div>
  );
}

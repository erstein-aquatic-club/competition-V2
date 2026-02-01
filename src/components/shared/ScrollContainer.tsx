import React from "react";
import { cn } from "@/lib/utils";

interface ScrollContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollContainer({ children, className }: ScrollContainerProps) {
  return (
    <div className={cn("overflow-y-auto overscroll-contain", className)}>
      {children}
    </div>
  );
}

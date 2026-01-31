import React from "react";
import { cn } from "@/lib/utils";

interface ModalMaxSizeProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalMaxSize({ children, className }: ModalMaxSizeProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[min(92vw,32rem)] max-h-[85vh] overflow-y-auto rounded-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

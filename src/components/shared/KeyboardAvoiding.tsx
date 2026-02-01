import React from "react";
import { cn } from "@/lib/utils";

interface KeyboardAvoidingProps {
  children: React.ReactNode;
  className?: string;
  offsetClassName?: string;
}

export function KeyboardAvoiding({ children, className, offsetClassName }: KeyboardAvoidingProps) {
  return (
    <div
      className={cn(
        "relative",
        "supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]",
        offsetClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}

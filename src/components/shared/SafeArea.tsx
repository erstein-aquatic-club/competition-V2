import React from "react";
import { cn } from "@/lib/utils";

interface SafeAreaProps {
  children: React.ReactNode;
  className?: string;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

export function SafeArea({
  children,
  className,
  top = false,
  bottom = false,
  left = false,
  right = false,
}: SafeAreaProps) {
  return (
    <div
      className={cn(className)}
      style={{
        paddingTop: top ? "env(safe-area-inset-top)" : undefined,
        paddingBottom: bottom ? "env(safe-area-inset-bottom)" : undefined,
        paddingLeft: left ? "env(safe-area-inset-left)" : undefined,
        paddingRight: right ? "env(safe-area-inset-right)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

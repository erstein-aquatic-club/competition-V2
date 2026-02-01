import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SwimBadgeRowProps = {
  children: ReactNode;
  className?: string;
};

export function SwimBadgeRow({ children, className }: SwimBadgeRowProps) {
  return <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>{children}</div>;
}

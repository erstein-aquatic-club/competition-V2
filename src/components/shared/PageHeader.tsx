import { cn } from "@/lib/utils";

interface PageHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared sticky page header — consistent across Strength, Records, RecordsClub, etc.
 * Applies the standard EAC blur/border pattern.
 */
export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-overlay -mx-4 backdrop-blur-md bg-background/90 border-b border-primary/15",
        className,
      )}
    >
      <div className="px-4 py-2.5 flex items-center justify-between">
        {children}
      </div>
    </div>
  );
}

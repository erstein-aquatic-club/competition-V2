import type { ReactNode, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Variant config ────────────────────────────────────────────

const variants = {
  amber: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    muted: "text-amber-600/70 dark:text-amber-400/60",
    border: "border-amber-200/60 dark:border-amber-800/30",
    bg: "bg-amber-50/50 dark:bg-amber-950/10",
  },
  red: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    muted: "text-red-600/70 dark:text-red-400/60",
    border: "border-red-200/60 dark:border-red-800/30",
    bg: "bg-red-50/50 dark:bg-red-950/10",
  },
  blue: {
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    muted: "text-blue-600/70 dark:text-blue-400/60",
    border: "border-blue-200/60 dark:border-blue-800/30",
    bg: "bg-blue-50/50 dark:bg-blue-950/10",
  },
  yellow: {
    dot: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-300",
    muted: "text-yellow-600/70 dark:text-yellow-400/60",
    border: "border-yellow-200/60 dark:border-yellow-800/30",
    bg: "bg-yellow-50/50 dark:bg-yellow-950/10",
  },
  emerald: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    muted: "text-emerald-600/70 dark:text-emerald-400/60",
    border: "border-emerald-200/60 dark:border-emerald-800/30",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/10",
  },
  muted: {
    dot: "bg-muted-foreground/40",
    text: "text-foreground",
    muted: "text-muted-foreground",
    border: "border-border",
    bg: "bg-muted/30",
  },
  destructive: {
    dot: "bg-destructive",
    text: "text-destructive",
    muted: "text-destructive/70",
    border: "border-destructive/20",
    bg: "bg-destructive/5",
  },
} as const;

export type BannerVariant = keyof typeof variants;

// ── Animation ─────────────────────────────────────────────────

const bannerMotion = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { type: "spring" as const, stiffness: 500, damping: 32, mass: 0.8 },
};

// ── Component ─────────────────────────────────────────────────

interface InlineBannerProps {
  variant?: BannerVariant;
  icon?: ReactNode;
  /** Primary label (bold) */
  label: ReactNode;
  /** Secondary text / right-aligned badge */
  badge?: ReactNode;
  /** Optional second line */
  sublabel?: ReactNode;
  /** Optional sub-badge (right side of second line) */
  subbadge?: ReactNode;
  /** Animate mount/unmount */
  animate?: boolean;
  /** Show / hide (for AnimatePresence) */
  visible?: boolean;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

export function InlineBanner({
  variant = "muted",
  icon,
  label,
  badge,
  sublabel,
  subbadge,
  animate = true,
  visible = true,
  onClick,
  className,
}: InlineBannerProps) {
  const v = variants[variant];

  const content = (
    <motion.div
      {...(animate ? bannerMotion : {})}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "rounded-xl border px-3 py-2.5",
        "backdrop-blur-sm",
        onClick && "cursor-pointer active:scale-[0.98] transition-transform",
        v.border,
        v.bg,
        className,
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 min-w-0">
        {icon ? (
          <span className={cn("shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5", v.text)}>
            {icon}
          </span>
        ) : (
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", v.dot)} />
        )}
        <span className={cn("text-[13px] font-semibold truncate", v.text)}>
          {label}
        </span>
        {badge && (
          <span className={cn("text-[11px] font-bold ml-auto shrink-0 tabular-nums", v.text)}>
            {badge}
          </span>
        )}
      </div>

      {/* Sub row */}
      {(sublabel || subbadge) && (
        <div className="flex items-center gap-2 mt-0.5 ml-[calc(0.375rem+0.5rem+0.5rem)]">
          {sublabel && (
            <span className={cn("text-[11px] truncate", v.muted)}>
              {sublabel}
            </span>
          )}
          {subbadge && (
            <span className={cn("text-[11px] font-medium ml-auto shrink-0 tabular-nums", v.muted)}>
              {subbadge}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );

  if (animate) {
    return <AnimatePresence>{visible && content}</AnimatePresence>;
  }
  return visible ? content : null;
}

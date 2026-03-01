import { type ReactNode, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  pullThreshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  pullThreshold = 80,
}: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  const spinnerOpacity = useTransform(y, [0, pullThreshold], [0, 1]);
  const spinnerScale = useTransform(y, [0, pullThreshold], [0.5, 1]);

  const handleDragEnd = async () => {
    const currentY = y.get();
    // Check that we're at the top of scroll
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 5 || currentY < pullThreshold) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ overscrollBehaviorY: "contain" }}
    >
      {/* Spinner indicator */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center justify-center"
        style={{ opacity: refreshing ? 1 : spinnerOpacity, scale: refreshing ? 1 : spinnerScale }}
      >
        <div className={`mt-2 h-8 w-8 rounded-full border-2 border-primary border-t-transparent ${refreshing ? "animate-spin" : ""}`} />
      </motion.div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        dragSnapToOrigin
        style={{ y }}
        onDragEnd={handleDragEnd}
        dragListener={!refreshing}
      >
        {children}
      </motion.div>
    </div>
  );
}

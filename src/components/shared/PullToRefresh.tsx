import { type ReactNode, useCallback, useRef, useState } from "react";

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
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      // Only activate pull-to-refresh when at the very top of the page
      if (window.scrollY > 5) return;
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    },
    [refreshing],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || refreshing) return;
      // Re-check scroll position — if user scrolled down since touchstart, abort
      if (window.scrollY > 5) {
        isPulling.current = false;
        setPullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) {
        // Apply diminishing elastic factor
        setPullDistance(Math.min(delta * 0.4, pullThreshold * 1.5));
      }
    },
    [refreshing, pullThreshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= pullThreshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, pullThreshold, refreshing, onRefresh]);

  const spinnerOpacity = refreshing ? 1 : Math.min(pullDistance / pullThreshold, 1);
  const spinnerScale = refreshing ? 1 : 0.5 + 0.5 * Math.min(pullDistance / pullThreshold, 1);

  return (
    <div
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Spinner indicator */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center justify-center"
        style={{ opacity: spinnerOpacity, transform: `scale(${spinnerScale})` }}
      >
        <div className={`mt-2 h-8 w-8 rounded-full border-2 border-primary border-t-transparent ${refreshing ? "animate-spin" : ""}`} />
      </div>

      <div style={{ transform: `translateY(${pullDistance}px)`, transition: isPulling.current ? "none" : "transform 0.3s ease" }}>
        {children}
      </div>
    </div>
  );
}

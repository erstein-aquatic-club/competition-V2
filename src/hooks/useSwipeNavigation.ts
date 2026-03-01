import type { PanInfo } from "framer-motion";

interface UseSwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  velocityThreshold = 500,
}: UseSwipeNavigationOptions) {
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Don't hijack vertical scroll
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;

    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      onSwipeLeft?.();
    } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      onSwipeRight?.();
    }
  };

  return {
    drag: "x" as const,
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.2,
    dragSnapToOrigin: true,
    onDragEnd: handleDragEnd,
  };
}

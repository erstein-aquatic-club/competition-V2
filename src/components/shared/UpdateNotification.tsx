import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    const handler = () => setUpdateAvailable(true);
    window.addEventListener("pwa-update-available", handler);
    return () => window.removeEventListener("pwa-update-available", handler);
  }, []);

  const handleReload = async () => {
    setIsReloading(true);
    try {
      const updateSW = (window as any).__pwaUpdateSW;
      if (typeof updateSW === "function") {
        await updateSW(true);
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best-effort
    }
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <div className="fixed top-3 left-0 right-0 z-50 pointer-events-none flex justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-card/95 backdrop-blur-xl border border-border shadow-lg shadow-black/10 dark:shadow-black/30 pl-4 pr-1.5 py-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">
              Mise à jour disponible
            </span>
            <button
              onClick={handleReload}
              disabled={isReloading}
              className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
            >
              {isReloading ? "..." : "Recharger"}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

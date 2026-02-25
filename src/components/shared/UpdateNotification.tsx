import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

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
      // Activate the waiting service worker
      const updateSW = (window as any).__pwaUpdateSW;
      if (typeof updateSW === "function") {
        await updateSW(true);
      }
      // Clear all Workbox runtime caches
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best-effort
    }
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Card className="border-primary shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Mise à jour disponible</p>
                <p className="text-xs text-muted-foreground">
                  Rechargez pour utiliser la dernière version
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleReload}
              disabled={isReloading}
              className="h-9"
            >
              {isReloading ? "Rechargement..." : "Recharger"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

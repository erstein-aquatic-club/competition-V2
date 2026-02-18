import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

declare const __BUILD_TIMESTAMP__: string;

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;

    if (!isPWA) return;

    // Store current build timestamp
    const currentBuild = __BUILD_TIMESTAMP__;
    const storedBuild = localStorage.getItem('app_build_timestamp');

    if (storedBuild && storedBuild !== currentBuild) {
      // New version detected
      setUpdateAvailable(true);
    }

    // Update stored timestamp
    localStorage.setItem('app_build_timestamp', currentBuild);

    // vite-plugin-pwa handles SW controller changes via registerSW({ immediate: true })
  }, []);

  const handleReload = () => {
    setIsReloading(true);
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

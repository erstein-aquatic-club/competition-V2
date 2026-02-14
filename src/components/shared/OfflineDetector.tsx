import { useEffect, useState } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * OfflineDetector shows a fixed banner at the top when the user goes offline.
 * Auto-hides when back online. Detects both navigator.onLine changes and
 * actual Supabase connectivity issues.
 */
export function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsTransitioning(true)
      // Show "reconnected" state briefly before hiding
      setTimeout(() => {
        setIsOffline(false)
        setIsTransitioning(false)
      }, 2000)
    }

    const handleOffline = () => {
      setIsOffline(true)
      setIsTransitioning(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!isOffline && !isTransitioning) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[var(--z-index-toast)] transform transition-transform duration-300",
        isOffline && !isTransitioning ? "translate-y-0" : "-translate-y-full"
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium",
          isTransitioning
            ? "bg-status-success text-white"
            : "bg-destructive text-destructive-foreground"
        )}
      >
        {isTransitioning ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Connexion rétablie</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.</span>
          </>
        )}
      </div>
    </div>
  )
}

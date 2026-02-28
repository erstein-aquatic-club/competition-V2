import { useEffect, useState } from "react";
import { Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectPlatform, isStandalone, shouldShowInstallGate } from "@/lib/pwaHelpers";

export function PWAInstallGate({ children }: { children: React.ReactNode }) {
  const [showGate, setShowGate] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const p = detectPlatform(navigator.userAgent);
    setPlatform(p);
    setShowGate(shouldShowInstallGate(p, isStandalone()));

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => {
      if (mq.matches) setShowGate(false);
    };
    mq.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  if (!showGate) return <>{children}</>;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowGate(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center">
      <img
        src={`${import.meta.env.BASE_URL}logo-eac-256.webp`}
        alt="EAC Natation"
        className="h-24 w-24 mb-8"
      />
      <h1 className="text-2xl font-bold text-foreground mb-2">
        EAC Natation
      </h1>
      <p className="text-muted-foreground mb-8 max-w-xs">
        Pour utiliser l'application, veuillez l'installer sur votre téléphone.
      </p>

      {platform === "android" && deferredPrompt ? (
        <Button size="lg" onClick={handleInstall} className="gap-2 mb-6">
          <Download className="h-5 w-5" />
          Installer l'application
        </Button>
      ) : platform === "android" ? (
        <div className="rounded-xl border bg-muted/50 p-5 max-w-xs mb-6 text-left space-y-3">
          <p className="text-sm font-medium text-foreground">
            Pour installer :
          </p>
          <p className="text-sm text-muted-foreground">
            Ouvrez le menu{" "}
            <span className="font-bold text-foreground text-lg leading-none">&#8942;</span>{" "}
            de votre navigateur, puis appuyez sur{" "}
            <span className="font-semibold text-foreground">
              « Ajouter à l'écran d'accueil »
            </span>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/50 p-5 max-w-xs mb-6 text-left space-y-4">
          <p className="text-sm font-medium text-foreground">
            Pour installer sur iPhone :
          </p>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <span>
                Appuyez sur{" "}
                <Share className="inline h-4 w-4 -mt-0.5 text-primary" />{" "}
                <span className="font-semibold text-foreground">Partager</span>{" "}
                en bas de l'écran
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <span>
                Faites défiler et appuyez sur{" "}
                <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                  <Plus className="inline h-3.5 w-3.5" />
                  Sur l'écran d'accueil
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <span>
                Confirmez en appuyant sur{" "}
                <span className="font-semibold text-foreground">Ajouter</span>
              </span>
            </li>
          </ol>
        </div>
      )}

      <p className="text-xs text-muted-foreground/60 max-w-xs">
        L'installation permet de recevoir les notifications et d'accéder à l'app en plein écran.
      </p>
    </div>
  );
}

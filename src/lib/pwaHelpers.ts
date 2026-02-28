export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function isStandalone(): boolean {
  if ("standalone" in navigator && (navigator as any).standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

export function shouldShowInstallGate(
  platform: Platform,
  standalone: boolean
): boolean {
  if (platform === "desktop") return false;
  return !standalone;
}

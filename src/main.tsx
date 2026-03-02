import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App";
import "./index.css";

declare const __BUILD_TIMESTAMP__: string;
console.log(`[EAC] Build: ${__BUILD_TIMESTAMP__}`);
(window as any).__eacBuildTimestamp = __BUILD_TIMESTAMP__;

// vite-plugin-pwa: prompt mode – show notification when new SW is waiting
const updateSW = registerSW({
  immediate: true,
  onRegistered(r) {
    if (r) (window as any).__pwaRegistration = r;
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
  },
});
(window as any).__pwaUpdateSW = updateSW;

// Lock orientation to portrait on mobile (Android PWA / fullscreen)
// Falls back silently — iOS Safari doesn't support this API, CSS overlay handles it
if (screen.orientation?.lock && window.matchMedia('(max-width: 768px)').matches) {
  screen.orientation.lock('portrait-primary').catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);

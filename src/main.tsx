import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App";
import "./index.css";

declare const __BUILD_TIMESTAMP__: string;
console.log(`[EAC] Build: ${__BUILD_TIMESTAMP__}`);

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

createRoot(document.getElementById("root")!).render(<App />);

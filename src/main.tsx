import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App";
import "./index.css";

declare const __BUILD_TIMESTAMP__: string;
console.log(`[EAC] Build: ${__BUILD_TIMESTAMP__}`);

// vite-plugin-pwa handles SW registration, updates, and caching
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);

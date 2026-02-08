import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

declare const __BUILD_TIMESTAMP__: string;
console.log(`[EAC] Build: ${__BUILD_TIMESTAMP__}`);

createRoot(document.getElementById("root")!).render(<App />);

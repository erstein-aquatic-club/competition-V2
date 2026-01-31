import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig(({ mode }) => ({
  base: process.env.NODE_ENV === "production" ? "/competition-V2/" : "/",
  envDir: path.resolve(import.meta.dirname),
  define: {
    "import.meta.env.VITE_SWIM_SYNC_ENDPOINT": JSON.stringify(
      process.env.VITE_SWIM_SYNC_ENDPOINT ?? "",
    ),
    "import.meta.env.VITE_SWIM_SYNC_TOKEN": JSON.stringify(
      process.env.VITE_SWIM_SYNC_TOKEN ?? "",
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 8080,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));

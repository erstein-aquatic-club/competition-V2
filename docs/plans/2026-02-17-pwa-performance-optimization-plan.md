# PWA Performance Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce initial load by ~54% (500K gzip -> 230K) and add proper Workbox-based PWA with app shell precaching.

**Architecture:** Fix critical bundle issues (lazy-load PDF export, remove recharts from modulepreload), then migrate from hand-rolled service worker to vite-plugin-pwa with Workbox for automatic precaching and runtime caching. Keep existing framer-motion and recharts libraries but fix their loading behavior.

**Tech Stack:** Vite 7, vite-plugin-pwa (Workbox generateSW), React 19, TypeScript

**Design doc:** `docs/plans/2026-02-17-pwa-performance-optimization-design.md`

---

### Task 1: Delete dead code — chart.tsx

`src/components/ui/chart.tsx` imports `* as RechartsPrimitive from "recharts"` but is never imported by any file. This dead code may pollute the bundle.

**Files:**
- Delete: `src/components/ui/chart.tsx`

**Step 1: Verify chart.tsx is unused**

Run: `grep -r "from.*@/components/ui/chart" src/`
Expected: No matches (already confirmed in audit)

**Step 2: Delete the file**

Delete `src/components/ui/chart.tsx`.

**Step 3: Build to verify no breakage**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add -u src/components/ui/chart.tsx
git commit -m "chore: delete unused chart.tsx (dead recharts import)"
```

---

### Task 2: Lazy-load PDF export in RecordsClub

The static `import { exportRecordsPdf }` in RecordsClub.tsx bundles jsPDF + jspdf-autotable into the chunk (adding ~400K raw / ~130K gzip). Convert to dynamic import on button click.

**Files:**
- Modify: `src/pages/RecordsClub.tsx:21` (remove static import)
- Modify: `src/pages/RecordsClub.tsx:287-296` (handleExportPdf function)

**Step 1: Remove static import**

In `src/pages/RecordsClub.tsx`, remove line 21:
```ts
import { exportRecordsPdf } from "@/lib/export-records-pdf";
```

**Step 2: Convert handleExportPdf to use dynamic import**

Replace the existing `handleExportPdf` callback (around line 287) with:
```ts
  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const allRecords = await api.getClubRecords({});
      const { exportRecordsPdf } = await import("@/lib/export-records-pdf");
      await exportRecordsPdf(allRecords);
    } catch {
      // Silently fail
    } finally {
      setExporting(false);
    }
  }, []);
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing errors in stories/test files are OK)

**Step 4: Build and verify chunk size reduction**

Run: `npm run build 2>&1 | grep RecordsClub`
Expected: RecordsClub chunk size drops from ~440K to ~30-50K

**Step 5: Commit**

```bash
git add src/pages/RecordsClub.tsx
git commit -m "perf: lazy-load PDF export in RecordsClub (440K → ~40K chunk)"
```

---

### Task 3: Optimize manualChunks — remove recharts and date-fns from modulepreload

The current `manualChunks` in vite.config.ts forces `vendor-charts` (recharts, 117K gzip) and `vendor-date` (date-fns, 6K gzip) to be modulepreloaded on every page load, even though they're only used by lazy-loaded routes.

**Files:**
- Modify: `vite.config.ts:36-43` (manualChunks config)

**Step 1: Update manualChunks**

Replace the manualChunks object in `vite.config.ts` (lines 36-44):
```ts
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
```

Removed: `vendor-charts` (recharts), `vendor-date` (date-fns), `vendor-ui` (4 Radix components).
Kept: `vendor-react` (essential), `vendor-query` (used everywhere), `vendor-supabase` (used for auth on load).

Vite will auto-split recharts, date-fns, and Radix UI into shared lazy chunks that only load when the routes using them are visited.

**Step 2: Build and verify modulepreload reduction**

Run: `npm run build`
Then check `dist/index.html` for modulepreload links.
Expected: Only `vendor-react`, `vendor-query`, `vendor-supabase` should be modulepreloaded. No more `vendor-charts`, `vendor-date`, or `vendor-ui`.

**Step 3: Verify total initial load reduction**

Check dist/index.html — the modulepreloaded JS should be ~60K gzip (vendor-react 4K + vendor-query 11K + vendor-supabase 44K) instead of the previous ~200K+ gzip.

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf: remove recharts/date-fns/radix from modulepreload (-140K gzip initial)"
```

---

### Task 4: Install and configure vite-plugin-pwa

Replace the hand-rolled service worker (public/sw.js, 85 lines, caches 7 files) with vite-plugin-pwa for automatic Workbox-powered precaching and runtime caching.

**Files:**
- Modify: `vite.config.ts` (add VitePWA plugin)
- Delete: `public/sw.js`
- Delete: `public/manifest.json` (migrated to Vite config)
- Modify: `src/main.tsx` (replace manual SW registration with vite-plugin-pwa)

**Step 1: Install vite-plugin-pwa**

Run: `npm install -D vite-plugin-pwa`

**Step 2: Configure VitePWA in vite.config.ts**

Add import at top of `vite.config.ts`:
```ts
import { VitePWA } from 'vite-plugin-pwa';
```

Add VitePWA to the plugins array (after `tailwindcss()`):
```ts
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-auth',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: {
        name: 'EAC Natation',
        short_name: 'EAC',
        description: "Suivi d'entraînement - Erstein Aquatic Club",
        start_url: '/competition/#/',
        scope: '/competition/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#E30613',
        background_color: '#ffffff',
        icons: [
          { src: 'favicon.png', sizes: '128x128', type: 'image/png' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'apple-touch-icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'apple-touch-icon-167.png', sizes: '167x167', type: 'image/png' },
          { src: 'apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
        ],
      },
    }),
```

**Step 3: Add TypeScript type reference for virtual module**

Create file `src/vite-env-pwa.d.ts`:
```ts
/// <reference types="vite-plugin-pwa/client" />
```

Or add to existing `src/vite-env.d.ts` if it exists.

**Step 4: Replace main.tsx SW registration**

Replace the entire `src/main.tsx` with:
```tsx
import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App";
import "./index.css";

declare const __BUILD_TIMESTAMP__: string;
console.log(`[EAC] Build: ${__BUILD_TIMESTAMP__}`);

// vite-plugin-pwa handles SW registration, updates, and caching
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
```

**Step 5: Delete the hand-rolled service worker**

Delete `public/sw.js`.

**Step 6: Delete the static manifest.json**

Delete `public/manifest.json` (now generated by vite-plugin-pwa from vite.config.ts).

**Step 7: Update index.html — remove static manifest link**

In `index.html`, remove line 39:
```html
    <link rel="manifest" href="/competition/manifest.json">
```

vite-plugin-pwa injects the manifest link automatically during build.

**Step 8: Build and verify**

Run: `npm run build`
Expected:
- Build succeeds
- `dist/sw.js` exists (generated by Workbox)
- `dist/manifest.webmanifest` exists (generated by plugin)
- `dist/index.html` has `<link rel="manifest">` injected

**Step 9: Commit**

```bash
git add vite.config.ts src/main.tsx src/vite-env-pwa.d.ts index.html
git rm public/sw.js public/manifest.json
git commit -m "feat: migrate to vite-plugin-pwa (Workbox precaching + runtime caching)"
```

---

### Task 5: Simplify UpdateNotification component

With vite-plugin-pwa's `registerType: 'autoUpdate'`, the SW updates automatically without user interaction. The existing UpdateNotification component is no longer needed in its current form. Simplify it to just handle the build timestamp comparison for edge cases.

**Files:**
- Modify: `src/components/shared/UpdateNotification.tsx`

**Step 1: Simplify UpdateNotification**

Replace `src/components/shared/UpdateNotification.tsx` with:
```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

declare const __BUILD_TIMESTAMP__: string;

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // Only show in PWA mode for build version mismatches
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;
    if (!isPWA) return;

    const currentBuild = __BUILD_TIMESTAMP__;
    const storedBuild = localStorage.getItem('app_build_timestamp');

    if (storedBuild && storedBuild !== currentBuild) {
      setUpdateAvailable(true);
    }
    localStorage.setItem('app_build_timestamp', currentBuild);
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
```

The only change: removed the `navigator.serviceWorker.addEventListener('controllerchange')` listener since vite-plugin-pwa handles controller changes internally with its `registerSW` function.

**Step 2: Build and type-check**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/shared/UpdateNotification.tsx
git commit -m "refactor: simplify UpdateNotification (vite-plugin-pwa handles SW updates)"
```

---

### Task 6: Add dns-prefetch for Supabase

The Supabase API URL is injected at build time via env vars. Since we can't hardcode it, we add a generic dns-prefetch hint. Also verify font preloading is optimal.

**Files:**
- Modify: `index.html`

**Step 1: Add dns-prefetch**

In `index.html`, after the theme-color meta tag (line 40), add:
```html
    <link rel="dns-prefetch" href="https://aroyetwrpxjulctuzqlu.supabase.co" />
    <link rel="preconnect" href="https://aroyetwrpxjulctuzqlu.supabase.co" crossorigin />
```

Note: `aroyetwrpxjulctuzqlu` is the project's Supabase instance ID (visible in the deployed app). This saves ~100-200ms on first API call by resolving DNS and establishing TCP/TLS early.

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds, dns-prefetch appears in dist/index.html

**Step 3: Commit**

```bash
git add index.html
git commit -m "perf: add dns-prefetch/preconnect for Supabase API (~200ms saved)"
```

---

### Task 7: Final verification — build and measure

**Step 1: Clean build**

Run: `rm -rf dist && npm run build`

**Step 2: Measure chunk sizes**

Run: `npm run build 2>&1 | tail -20`
Expected:
- RecordsClub chunk: ~30-50K (was 440K)
- No `vendor-charts` in modulepreload
- No `vendor-date` in modulepreload
- `sw.js` generated by Workbox in dist/
- `manifest.webmanifest` generated in dist/

**Step 3: Verify dist/index.html modulepreloads**

Run: `grep modulepreload dist/index.html`
Expected: Only `vendor-react`, `vendor-query`, `vendor-supabase` (3 preloads instead of 5)

**Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 5: Run tests**

Run: `npm test`
Expected: Tests pass (pre-existing failures in TimesheetHelpers.test.ts are OK)

**Step 6: Commit documentation**

Update `docs/implementation-log.md` with a new entry documenting:
- Context: Performance audit found ~500K gzip initial load
- Changes: Lazy PDF export, manualChunks optimization, vite-plugin-pwa migration, dns-prefetch
- Files modified: vite.config.ts, RecordsClub.tsx, main.tsx, UpdateNotification.tsx, index.html
- Files deleted: public/sw.js, public/manifest.json, src/components/ui/chart.tsx
- Results: Initial load reduced to ~230K gzip, Workbox precaching enabled, app shell cached offline

```bash
git add docs/implementation-log.md
git commit -m "docs: add implementation log entry for PWA performance optimization"
```

---

## Summary of Expected Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Initial load (gzip) | ~500K | ~230K | **-54%** |
| RecordsClub chunk | 144K gzip | ~15K gzip | **-90%** |
| Modulepreloaded chunks | 5 (~200K gzip) | 3 (~60K gzip) | **-70%** |
| App shell caching | 7 hardcoded files | All built assets | **Complete** |
| Runtime API caching | None | NetworkFirst Supabase | **New** |
| Font caching | None | CacheFirst Google Fonts | **New** |
| 2nd load time | Full network | Cached shell | **Near-instant** |

# Performance & Dock Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize app load performance (lazy-loading, vendor chunks, logo, re-renders) and make dock icon clicks always reset to section home state.

**Architecture:** Event-based dock reset via existing `NAV_RESET_EVENT`, lazy-loading coach sub-screens, vendor chunk splitting, Zustand selector optimization, logo compression.

**Tech Stack:** React, Vite, Zustand, Wouter, WebP image conversion

---

### Task 1: Optimize logo image

**Files:**
- Create: `public/logo-eac.webp` (small, ~64px for nav)
- Create: `public/logo-eac-256.webp` (medium, ~256px for login)
- Modify: `src/components/layout/AppLayout.tsx:6,52-55`
- Modify: `src/pages/Login.tsx` (wherever `eacLogo` is used)

**Step 1: Generate optimized WebP versions**

Run:
```bash
# Install sharp-cli if needed, or use sips (macOS native)
sips -s format png -z 64 64 attached_assets/logo-eac.png --out /tmp/logo-eac-64.png
sips -s format png -z 256 256 attached_assets/logo-eac.png --out /tmp/logo-eac-256.png
# Convert to WebP using cwebp (brew install webp if missing)
cwebp -q 85 /tmp/logo-eac-64.png -o public/logo-eac.webp
cwebp -q 85 /tmp/logo-eac-256.png -o public/logo-eac-256.webp
```

Expected: Two WebP files, each < 15 KB (vs 382 KB original).

**Step 2: Update imports in AppLayout.tsx**

Replace line 6:
```tsx
// Before:
import eacLogo from "@assets/logo-eac.png";
// After:
const eacLogo = `${import.meta.env.BASE_URL}logo-eac.webp`;
```

The image is in `public/` so no import needed — use `BASE_URL` for the path prefix.

**Step 3: Update Login.tsx logo**

Find the `eacLogo` import and replace with the 256px version:
```tsx
// Before:
import eacLogo from "@assets/logo-eac.png";
// After:
const eacLogo = `${import.meta.env.BASE_URL}logo-eac-256.webp`;
```

**Step 4: Verify build works**

Run: `npm run build`
Expected: No errors, logo-eac.png no longer referenced in JS bundle.

**Step 5: Commit**

```bash
git add public/logo-eac.webp public/logo-eac-256.webp src/components/layout/AppLayout.tsx src/pages/Login.tsx
git commit -m "perf: optimize logo images (382KB PNG → <15KB WebP)"
```

---

### Task 2: Lazy-load Coach sub-screens

**Files:**
- Modify: `src/pages/Coach.tsx:13-20`

**Step 1: Replace eager imports with lazy imports**

Replace lines 13-20:
```tsx
// Before:
import CoachSwimmersOverview from "./coach/CoachSwimmersOverview";
import CoachMessagesScreen from "./coach/CoachMessagesScreen";
import CoachSmsScreen from "./coach/CoachSmsScreen";
import CoachCalendar from "./coach/CoachCalendar";
import CoachGroupsScreen from "./coach/CoachGroupsScreen";
import CoachCompetitionsScreen from "./coach/CoachCompetitionsScreen";
import CoachObjectivesScreen from "./coach/CoachObjectivesScreen";
import CoachTrainingSlotsScreen from "./coach/CoachTrainingSlotsScreen";

// After:
const CoachSwimmersOverview = lazy(() => import("./coach/CoachSwimmersOverview"));
const CoachMessagesScreen = lazy(() => import("./coach/CoachMessagesScreen"));
const CoachSmsScreen = lazy(() => import("./coach/CoachSmsScreen"));
const CoachCalendar = lazy(() => import("./coach/CoachCalendar"));
const CoachGroupsScreen = lazy(() => import("./coach/CoachGroupsScreen"));
const CoachCompetitionsScreen = lazy(() => import("./coach/CoachCompetitionsScreen"));
const CoachObjectivesScreen = lazy(() => import("./coach/CoachObjectivesScreen"));
const CoachTrainingSlotsScreen = lazy(() => import("./coach/CoachTrainingSlotsScreen"));
```

**Step 2: Wrap each sub-screen render in Suspense**

Find each `{activeSection === "xyz" && <XyzScreen ... />}` block in Coach.tsx and wrap in `<Suspense fallback={<PageSkeleton />}>`. There are already Suspense wrappers for `StrengthCatalog` and `SwimCatalog` — follow the same pattern.

Example (for each sub-screen):
```tsx
// Before:
{activeSection === "swimmers" && <CoachSwimmersOverview ... />}
// After:
{activeSection === "swimmers" && (
  <Suspense fallback={<PageSkeleton />}>
    <CoachSwimmersOverview ... />
  </Suspense>
)}
```

Apply this pattern for: `swimmers`, `messaging`, `sms`, `calendar`, `groups`, `competitions`, `objectives`, `training-slots`.

**Step 3: Verify build**

Run: `npm run build`
Expected: The Coach chunk should now be much smaller. Each sub-screen gets its own chunk.

**Step 4: Commit**

```bash
git add src/pages/Coach.tsx
git commit -m "perf: lazy-load 8 Coach sub-screens"
```

---

### Task 3: Add vendor chunks for heavy libraries

**Files:**
- Modify: `vite.config.ts:106-110`

**Step 1: Add vendor chunks**

Replace the `manualChunks` block:
```ts
// Before:
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-supabase': ['@supabase/supabase-js'],
},

// After:
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-motion': ['framer-motion'],
  'vendor-charts': ['recharts'],
  'vendor-date': ['date-fns'],
},
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. New vendor chunks appear in `dist/assets/`. Each page chunk should be smaller.

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "perf: add vendor chunks for framer-motion, recharts, date-fns"
```

---

### Task 4: Fix Zustand useAuth selectors

**Files:**
- Modify: `src/App.tsx:194`
- Modify: `src/pages/Dashboard.tsx:122`
- Modify: `src/pages/Progress.tsx:156`
- Modify: `src/pages/Strength.tsx:146`
- Modify: `src/pages/Records.tsx:153`
- Modify: `src/pages/Profile.tsx:184`
- Modify: `src/pages/SwimSessionView.tsx:69`
- Modify: `src/components/layout/AppLayout.tsx:16`
- Modify: `src/components/profile/SwimmerObjectivesView.tsx:85`
- Modify: `src/pages/coach/SwimCatalog.tsx:173`

**Step 1: Replace whole-store destructuring with targeted selectors**

For each file, replace the `useAuth()` destructuring with individual selectors:

```tsx
// Before:
const { user, userId } = useAuth();
// After:
const user = useAuth((s) => s.user);
const userId = useAuth((s) => s.userId);

// Before:
const { user, userId, role, selectedAthleteId, selectedAthleteName } = useAuth();
// After:
const user = useAuth((s) => s.user);
const userId = useAuth((s) => s.userId);
const role = useAuth((s) => s.role);
const selectedAthleteId = useAuth((s) => s.selectedAthleteId);
const selectedAthleteName = useAuth((s) => s.selectedAthleteName);

// Before:
const { user, userId, logout, role } = useAuth();
// After:
const user = useAuth((s) => s.user);
const userId = useAuth((s) => s.userId);
const logout = useAuth((s) => s.logout);
const role = useAuth((s) => s.role);

// Before (App.tsx):
const { user, role } = useAuth();
// After:
const user = useAuth((s) => s.user);
const role = useAuth((s) => s.role);

// Before (AppLayout.tsx):
const { role } = useAuth();
// After:
const role = useAuth((s) => s.role);
```

Apply the same pattern to all listed files, extracting only the fields each component actually uses.

**Step 2: Verify build and types**

Run: `npx tsc --noEmit && npm run build`
Expected: No type errors, build succeeds.

**Step 3: Commit**

```bash
git add src/App.tsx src/pages/Dashboard.tsx src/pages/Progress.tsx src/pages/Strength.tsx src/pages/Records.tsx src/pages/Profile.tsx src/pages/SwimSessionView.tsx src/components/layout/AppLayout.tsx src/components/profile/SwimmerObjectivesView.tsx src/pages/coach/SwimCatalog.tsx
git commit -m "perf: use Zustand selectors in useAuth to prevent unnecessary re-renders"
```

---

### Task 5: Dock reset — Dashboard

**Files:**
- Modify: `src/hooks/useDashboardState.ts`

**Step 1: Add NAV_RESET_EVENT listener**

In `useDashboardState`, add a `useEffect` that listens for `"nav:reset"` and resets view state to defaults:

```tsx
// Add near the other useEffects in the hook:
useEffect(() => {
  const reset = () => {
    setDrawerOpen(false);
    setSettingsOpen(false);
    setInfoOpen(false);
    setActiveSessionId(null);
    setDetailsOpen(false);
    setSelectedDayIndex(null);
  };
  window.addEventListener("nav:reset", reset);
  return () => window.removeEventListener("nav:reset", reset);
}, []);
```

Note: do NOT reset `monthCursor`/`selectedISO` — scrolling back to today is already handled by `window.scrollTo(0,0)` in AppLayout.

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/hooks/useDashboardState.ts
git commit -m "feat: reset Dashboard to home state on dock tap"
```

---

### Task 6: Dock reset — Strength

**Files:**
- Modify: `src/hooks/useStrengthState.ts`

**Step 1: Add NAV_RESET_EVENT listener**

Find the hook function and add a `useEffect`:

```tsx
useEffect(() => {
  const reset = () => {
    setScreenMode("list");
    setActiveSession(null);
    setActiveAssignment(null);
    setActiveRunId(null);
    setActiveRunLogs(null);
    setActiveRunnerStep(0);
    setSearchQuery("");
  };
  window.addEventListener("nav:reset", reset);
  return () => window.removeEventListener("nav:reset", reset);
}, []);
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/hooks/useStrengthState.ts
git commit -m "feat: reset Strength to home state on dock tap"
```

---

### Task 7: Dock reset — Profile

**Files:**
- Modify: `src/pages/Profile.tsx`

**Step 1: Add NAV_RESET_EVENT listener**

In the Profile component, near other `useEffect` hooks:

```tsx
useEffect(() => {
  const reset = () => {
    setActiveSection("home");
    setIsEditSheetOpen(false);
    setIsPasswordSheetOpen(false);
    setCropDialogSrc(null);
    setPendingNeurotypResult(null);
  };
  window.addEventListener("nav:reset", reset);
  return () => window.removeEventListener("nav:reset", reset);
}, []);
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: reset Profile to home state on dock tap"
```

---

### Task 8: Dock reset — Progress & HallOfFame

**Files:**
- Modify: `src/pages/Progress.tsx`
- Modify: `src/pages/HallOfFame.tsx`

**Step 1: Add NAV_RESET_EVENT listener in Progress**

```tsx
useEffect(() => {
  const reset = () => {
    setSwimPeriodDays(30);
    setStrengthPeriodDays(30);
  };
  window.addEventListener("nav:reset", reset);
  return () => window.removeEventListener("nav:reset", reset);
}, []);
```

**Step 2: Add NAV_RESET_EVENT listener in HallOfFame**

```tsx
useEffect(() => {
  const reset = () => {
    setPeriodDays("30");
  };
  window.addEventListener("nav:reset", reset);
  return () => window.removeEventListener("nav:reset", reset);
}, []);
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/pages/Progress.tsx src/pages/HallOfFame.tsx
git commit -m "feat: reset Progress and HallOfFame on dock tap"
```

---

### Task 9: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors (pre-existing stories errors are OK).

**Step 3: Tests**

Run: `npm test`
Expected: All tests pass (pre-existing `TimesheetHelpers` failure is OK).

**Step 4: Final commit with documentation**

Update `docs/implementation-log.md` with a new entry documenting all changes.

```bash
git add docs/implementation-log.md
git commit -m "docs: log performance optimization and dock reset changes"
```

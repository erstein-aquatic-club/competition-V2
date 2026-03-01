# UX Improvements A-H — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 26 touch-target violations, improve FeedbackDrawer UX (labels, AlertDialog, direct input), add Records shortcut, improve coach navigation, add real KPIs to fiche nageur Resume, and convert registration to multi-step wizard.

**Architecture:** Pure frontend changes — no migrations, no API changes. Each task modifies independent files (except B+C+D grouped on FeedbackDrawer.tsx). Tailwind classes only, Shadcn components, no new dependencies.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Radix UI / Shadcn, Wouter

---

## Task 1: Fix touch targets < 44px (10 files)

**Files:**
- Modify: `src/pages/coach/CoachSwimmersOverview.tsx`
- Modify: `src/pages/coach/CoachTrainingSlotsScreen.tsx`
- Modify: `src/pages/coach/SwimCatalog.tsx`
- Modify: `src/pages/coach/CoachCalendar.tsx`
- Modify: `src/pages/coach/SwimmerPlanningTab.tsx`
- Modify: `src/components/swim/SwimSessionBuilder.tsx`
- Modify: `src/components/swim/FolderSection.tsx`
- Modify: `src/pages/coach/CoachGroupsScreen.tsx`
- Modify: `src/components/swim/SessionListView.tsx`

**Context:** Apple/Google guidelines require minimum 44x44px touch targets. 26 violations found across coach-facing UI. All fixes are Tailwind class changes — replace `h-7 w-7` or `h-8 w-8` with `h-10 w-10` (or `min-h-[44px] min-w-[44px]`), and add `py-2` to small chips/pills.

**Violations by file:**

1. **CoachSwimmersOverview.tsx** — Filter chips have `py-1` (too small), sort buttons have `py-0.5`. Fix: bump to `py-2` on filter chips, `py-1.5 px-3` on sort buttons.

2. **CoachTrainingSlotsScreen.tsx** — Action buttons `h-8 w-8`, slot buttons `h-7`, date circles `h-7 w-7`. Fix: all to `h-10 w-10`.

3. **SwimCatalog.tsx** — Breadcrumb links are plain text without padding. Fix: add `py-2 px-1 inline-flex items-center` to breadcrumb link elements.

4. **CoachCalendar.tsx** — Edit/delete icon buttons `h-7 w-7`. Fix: `h-10 w-10`.

5. **SwimmerPlanningTab.tsx** — Action buttons `h-7`. Fix: `h-10 w-10`.

6. **SwimSessionBuilder.tsx** — Move/remove buttons `h-7 w-7`. Fix: `h-10 w-10`.

7. **FolderSection.tsx** — Folder menu trigger `h-7 w-7`. Fix: `h-10 w-10`.

8. **CoachGroupsScreen.tsx** — Remove member button `h-8 w-8`. Fix: `h-10 w-10`.

9. **SessionListView.tsx** — Edit/action buttons `h-8 w-8`. Fix: `h-10 w-10`.

**Step 1:** For each file, search for buttons/elements with `h-7`, `h-8`, `w-7`, `w-8` classes that are interactive touch targets. Replace with `h-10 w-10` (40px → close enough, or use `min-h-[44px] min-w-[44px]` where layout allows). For chips with `py-1` or `py-0.5`, replace with `py-2`.

**Step 2:** Run `npx tsc --noEmit` to verify no type errors.

**Step 3:** Commit:
```bash
git add -A
git commit -m "fix(ui): enforce 44px minimum touch targets across coach UI"
```

---

## Task 2: FeedbackDrawer improvements (B + C + D)

**Files:**
- Modify: `src/components/dashboard/FeedbackDrawer.tsx`

**Context:** Three changes to the same file, all in the FeedbackDrawer component.

### 2a: Scale labels on feedback indicators (Item B)

The INDICATORS array is defined at lines 69-74 with 4 entries. Each has a `mode` property:
- `difficulty` → mode: `"hard"` (higher = harder)
- `fatigue_end` → mode: `"hard"`
- `performance` → mode: `"good"` (higher = better)
- `engagement` → mode: `"good"`

The rating buttons are rendered at lines 719-749 as a row of 5 circles (values 1-5).

**Change:** Add min/max labels flanking the 5-button row:
- For `mode: "hard"`: left label "Facile", right label "Très dur"
- For `mode: "good"`: left label "Mauvaise", right label "Excellente"

In the JSX where the 5 buttons are rendered (around lines 719-749), wrap the button row in a container and add:
```tsx
<div className="flex items-center gap-2">
  <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">
    {ind.mode === "hard" ? "Facile" : "Mauvaise"}
  </span>
  <div className="flex gap-1.5 flex-1 justify-center">
    {/* existing 5 buttons */}
  </div>
  <span className="text-[10px] text-muted-foreground w-12 shrink-0">
    {ind.mode === "hard" ? "Très dur" : "Excellente"}
  </span>
</div>
```

### 2b: Replace window.confirm() with AlertDialog (Item C)

At line 820, there's a `window.confirm("Supprimer ce ressenti ?")` call. Replace with Shadcn AlertDialog.

**Change:**
1. Import `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger` from `@/components/ui/alert-dialog`
2. Add state: `const [deleteTarget, setDeleteTarget] = useState<string | null>(null)`
3. Replace the inline `window.confirm` with setting `deleteTarget` to the feedback ID
4. Add AlertDialog component that opens when `deleteTarget` is truthy:
```tsx
<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Supprimer ce ressenti ?</AlertDialogTitle>
      <AlertDialogDescription>
        Cette action est irréversible.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={() => { /* call delete mutation with deleteTarget */ }}>
        Supprimer
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 2c: Direct distance input (Item D)

The DistanceStepper (lines 145-228) shows distance in the center with +/- buttons (step=100m). The center display is read-only.

**Change:** Make the center distance value tappable. On tap, show an inline numeric input:
1. Add state: `const [editingDistance, setEditingDistance] = useState(false)`
2. Replace the static center `<span>` with:
   - If not editing: `<button onClick={() => setEditingDistance(true)}>{formatted distance}</button>` with underline-dashed style hint
   - If editing: `<input type="number" step={100} min={0} max={30000} autoFocus onBlur/onKeyDown={commit and close} />` styled to fit in the same space
3. On blur or Enter: commit the value (round to nearest 100), set `editingDistance(false)`
4. On Escape: cancel, revert to previous value

**Step 1:** Implement all 3 changes in FeedbackDrawer.tsx.

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/components/dashboard/FeedbackDrawer.tsx
git commit -m "feat(feedback): add scale labels, AlertDialog confirm, direct distance input"
```

---

## Task 3: Records shortcut from Dashboard (Item E)

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Context:** Currently, swimmers need 2 taps (Dashboard → Profil → Records) to reach their records. The `/records` route exists but isn't in the bottom nav or Dashboard. Add a quick-access button on the Dashboard.

**Change:** Add a small shortcut row below the competition banner (or above the calendar). A single tappable chip/link:

```tsx
<button
  onClick={() => navigate("/records")}
  className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium text-muted-foreground active:bg-muted"
>
  <Trophy className="h-3.5 w-3.5" />
  Mes records
</button>
```

Place this inside the existing header area or as a standalone row after the competition banner. Trophy icon is already imported in Dashboard.tsx (line 23-24). `navigate` from Wouter is already available.

**Step 1:** Add the shortcut button in Dashboard.tsx, positioned after the competition banner section.

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add Records shortcut chip"
```

---

## Task 4: Coach navigation improvement (Item F)

**Files:**
- Modify: `src/components/layout/navItems.ts`
- Modify: `src/pages/coach/Coach.tsx`

**Context:** Coach bottom nav has 3 items (Coach, Administratif, Profil). The "Coach" tab opens a home with 8 pills covering 12 sections. Top actions (Natation, Calendrier, Nageurs) are buried behind a tap.

**Change:** Expand bottom nav from 3 to 5 items by promoting the 2 most-used coach sections:

In `navItems.ts` (lines 25-30), change coach items from:
```ts
[Coach, Administratif, Profil]
```
to:
```ts
[Natation, Calendrier, Nageurs, Coach (renamed "Plus"), Profil]
```

Specifically:
```ts
const coachItems: NavItem[] = [
  { href: "/coach?section=natation", icon: Waves, label: "Natation" },
  { href: "/coach?section=calendrier", icon: CalendarDays, label: "Calendrier" },
  { href: "/coach?section=nageurs", icon: Users, label: "Nageurs" },
  { href: "/coach", icon: LayoutGrid, label: "Plus" },
  { href: "/profile", icon: User, label: "Profil" },
];
```

In `Coach.tsx`, the `?section=X` query param is already supported (lines ~55-70 read query params to set `activeSection`). Verify that deep-linking via query param works for `natation`, `calendrier`, `nageurs`. The CoachHome pills grid should remain for the "Plus" entry (when no section param).

Remove "Administratif" as a separate bottom nav item — it's already accessible as a section within Coach. If there's a separate `/admin` route it should remain accessible from the Coach home pills.

**Step 1:** Update navItems.ts with the 5-item coach nav. Import needed icons.

**Step 2:** Verify Coach.tsx query param section routing handles `natation`, `calendrier`, `nageurs` correctly. Fix if needed.

**Step 3:** Run `npx tsc --noEmit`.

**Step 4:** Commit:
```bash
git add src/components/layout/navItems.ts src/pages/coach/Coach.tsx
git commit -m "feat(coach): promote top sections to bottom nav"
```

---

## Task 5: Fiche nageur Resume with real KPIs (Item G)

**Files:**
- Modify: `src/pages/coach/CoachSwimmerDetail.tsx`

**Context:** The Resume tab (lines 106-158) shows a 2x2 grid of navigation buttons (Suivi, Échanges, Planif, Objectifs) with zero data. Replace with real mini-KPIs while keeping click-to-navigate behavior.

**Change:** Add lightweight data fetches and display KPIs in each tile:

1. **Suivi tile** → Show last feedback date + average mood (last 7 days). Query: `api.getFeedbacks({ athleteId, limit: 7 })` — extract last date and average engagement.
2. **Échanges tile** → Show count of interviews + last interview date. Query: `api.getInterviews({ athleteId })` — count and last date.
3. **Planif tile** → Show active macro-cycle name or "Aucun cycle". Query: `api.getMacroCycles({ athleteId })` — find current one.
4. **Objectifs tile** → Show count of active objectives. Query: `api.getObjectives({ athleteId })` — count active.

Each tile keeps its onClick to navigate to the corresponding tab. The structure becomes:
```tsx
<button onClick={() => setActiveTab("suivi")} className="...">
  <div className="flex items-center gap-2">
    <Clock className="h-4 w-4 text-blue-500" />
    <span className="font-medium">Suivi</span>
  </div>
  <p className="mt-1 text-xs text-muted-foreground">
    Dernier ressenti : {lastFeedbackDate ?? "—"}
  </p>
  <p className="text-xs text-muted-foreground">
    Engagement moy. : {avgEngagement ?? "—"}/5
  </p>
</button>
```

Use React Query hooks for each data fetch, with `staleTime: 5 * 60 * 1000` to avoid re-fetching on tab switches.

Check what API functions exist for feedbacks, interviews, macro-cycles, objectives. Use the existing functions — don't create new ones.

**Step 1:** Add React Query hooks for the 4 data sources in CoachSwimmerDetail.tsx.

**Step 2:** Replace the 4 navigation-only tiles with KPI-displaying tiles (keep onClick navigation).

**Step 3:** Fix the "Objectifs" tile to show objectives count instead of duplicating "suivi" navigation. Keep `onClick={() => setActiveTab("suivi")}` since objectives are in that tab.

**Step 4:** Run `npx tsc --noEmit`.

**Step 5:** Commit:
```bash
git add src/pages/coach/CoachSwimmerDetail.tsx
git commit -m "feat(coach): show real KPIs in swimmer detail Resume tab"
```

---

## Task 6: Registration multi-step wizard (Item H)

**Files:**
- Modify: `src/pages/Login.tsx`

**Context:** The signup form (lines 379-585) shows all 8 fields in a single scroll. On mobile, this is overwhelming. Convert to a 3-step wizard with progress indicator.

**Change:** Split the 8 fields into 3 logical steps:

**Step 1 — Identité (3 fields):**
- Nom d'affichage
- Email
- Mot de passe (with PasswordStrength)

**Step 2 — Profil (3 fields):**
- Rôle (Athlète / Coach)
- Date de naissance + Sexe (2-col grid, as currently)

**Step 3 — Club (2 fields):**
- Groupe (Select)
- Téléphone
- Submit button

**Implementation:**
1. Add state: `const [signupStep, setSignupStep] = useState(1)`
2. Add a simple step indicator at top of signup form:
```tsx
<div className="flex items-center justify-center gap-2 mb-4">
  {[1, 2, 3].map(s => (
    <div key={s} className={cn(
      "h-2 rounded-full transition-all",
      s === signupStep ? "w-8 bg-primary" : s < signupStep ? "w-2 bg-primary/50" : "w-2 bg-muted"
    )} />
  ))}
</div>
```
3. Wrap each group of fields in `{signupStep === N && (...)}` conditionals
4. Add "Suivant" button for steps 1 and 2 that validates current step fields before advancing:
```tsx
// Step 1: validate name, email, password
const step1Valid = await signupForm.trigger(["name", "email", "password"]);
if (step1Valid) setSignupStep(2);
```
5. Add "Retour" link for steps 2 and 3
6. The existing submit button stays on step 3 only
7. Keep the existing `handleSignup` function unchanged

**Step 1:** Implement the wizard UI with step state, progress dots, conditional rendering, and step validation.

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/pages/Login.tsx
git commit -m "feat(auth): convert registration to 3-step wizard"
```

---

## Task 7: Documentation update

**Files:**
- Modify: `docs/implementation-log.md`
- Modify: `docs/FEATURES_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CLAUDE.md`

**Step 1:** Add entry in `docs/implementation-log.md` covering all A-H changes.

**Step 2:** Update `docs/FEATURES_STATUS.md` — mark touch targets, feedback UX, coach nav, registration wizard as ✅.

**Step 3:** Update `docs/ROADMAP.md` — mark audit items A-H as Fait.

**Step 4:** Update `CLAUDE.md` if any new key files were added.

**Step 5:** Commit:
```bash
git add docs/ CLAUDE.md
git commit -m "docs: update implementation log and status for UX improvements A-H"
```

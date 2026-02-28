# Design Review Results: Multi-Page Review

**Review Date**: 2026-02-26  
**Routes**: `/` (Dashboard), `/strength`, `/administratif`, `/records-club`, `/records`  
**Focus Areas**: Visual Design, UX/Usability, Responsive/Mobile, Accessibility, Micro-interactions/Motion, Consistency, Performance

> **Note**: The app requires authentication, so this review was conducted through static code analysis of page files and the shared AppLayout. Visual inspection via browser would provide additional insights into live rendering and interactions.

## Summary

The app has a strong visual identity (EAC red/black/white) and good use of the shadcn component system with Tailwind v4. The most significant issues are accessibility gaps in the custom Modal (Dashboard) and navigation elements, a duplicate mobile/desktop header pattern in Dashboard creating a maintenance burden, leftover debug `console.log` statements in production code, and inconsistent use of design tokens (hardcoded Tailwind color utilities instead of semantic CSS variables). Consistency in border radius, sticky header patterns, and error states across pages also needs attention.

---

## Issues

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | Custom `Modal` in Dashboard missing `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` — fails WCAG 2.1 Level A | 🔴 Critical | Accessibility | `src/pages/Dashboard.tsx:79-127` |
| 2 | Desktop nav uses `<button>` for navigation links instead of `<a>` — semantically incorrect, harms keyboard/screen-reader users | 🔴 Critical | Accessibility | `src/components/layout/AppLayout.tsx:63-76` |
| 3 | 7 `console.log` / `console.warn` debug statements left in production code | 🔴 Critical | Performance | `src/pages/Dashboard.tsx:249,253-256,259,263,561` |
| 4 | Desktop and mobile nav items have no `aria-current="page"` — screen readers cannot identify the active route | 🟠 High | Accessibility | `src/components/layout/AppLayout.tsx:65-75,94-119` |
| 5 | `SegmentedControl` in RecordsClub has no `aria-pressed` on buttons — selected state is invisible to assistive tech | 🟠 High | Accessibility | `src/pages/RecordsClub.tsx:141-169` |
| 6 | Close button in Dashboard modal has both `aria-label="Fermer"` AND an inner `<span className="sr-only">Fermer</span>` — screen readers announce "Fermer Fermer" | 🟠 High | Accessibility | `src/pages/Dashboard.tsx:112-117` |
| 7 | Next competition banner uses hardcoded Tailwind amber utilities (`border-amber-200 bg-amber-50 text-amber-600` etc.) instead of `--status-warning` / `--status-warning-bg` tokens | 🟠 High | Visual Design | `src/pages/Dashboard.tsx:774-796` |
| 8 | Mobile and desktop header blocks are fully duplicated in Dashboard (~30 lines each, identical content) — any change requires two edits | 🟠 High | Consistency | `src/pages/Dashboard.tsx:710-738` vs `742-770` |
| 9 | FAB button in Administratif uses hardcoded shadow `rgba(220,38,38,0.25)` that doesn't adapt to dark mode | 🟠 High | Visual Design | `src/pages/Administratif.tsx:679` |
| 10 | `Administratif.tsx` inline tab switcher has `aria-current` but no `role="tab"` / `role="tablist"` wrappers — violates ARIA tab pattern | 🟠 High | Accessibility | `src/pages/Administratif.tsx:518-537` |
| 11 | `SegmentedControl` in RecordsClub re-implements shadcn `ToggleGroup` from scratch, losing built-in accessibility and keyboard navigation | 🟡 Medium | Consistency | `src/pages/RecordsClub.tsx:141-169` |
| 12 | Sticky header pattern is inconsistent across pages: Dashboard uses `fixed` mobile header; Strength/RecordsClub/Records use `sticky -mx-4`; Administratif has no sticky header | 🟡 Medium | Consistency | `Dashboard.tsx:710`, `Strength.tsx:634`, `RecordsClub.tsx:318`, `Records.tsx:594` |
| 13 | Border radius inconsistency across pages: `rounded-xl` (Administratif, RecordsClub), `rounded-2xl` (Strength skeletons, Records), `rounded-3xl` (Dashboard calendar/modal) | 🟡 Medium | Visual Design | `Dashboard.tsx:107,799`, `Strength.tsx:511`, `Administratif.tsx:566` |
| 14 | Dev comment "non affichée dans la maquette" is visible in production settings modal description text | 🟡 Medium | UX/Usability | `src/pages/Dashboard.tsx:909` |
| 15 | `strokeKey` and `distance` sort helper functions are defined twice identically inside two separate `useMemo` calls | 🟡 Medium | Performance | `src/pages/Records.tsx:301-315` vs `499-512` |
| 16 | Filter bar in RecordsClub has no `flex-wrap` — on screens ≤ 320px the 3 controls (pool, sex, age select) may overflow horizontally | 🟡 Medium | Responsive/Mobile | `src/pages/RecordsClub.tsx:353-376` |
| 17 | Framer Motion animations in Records (`staggerChildren`, `listItem`) don't have `motion-reduce` guard — `motion-reduce:animate-none` is only applied on CSS `animate-pulse` skeletons | 🟡 Medium | Micro-interactions/Motion | `src/pages/Records.tsx:825-830`, `src/lib/animations.ts` |
| 18 | `TabsList` in Records.tsx manually chains long `data-[state=active]` and `data-[state=inactive]` CSS chains, overriding shadcn defaults unnecessarily | 🟡 Medium | Visual Design | `src/pages/Records.tsx:605-625` |
| 19 | `Administratif.tsx` is a 957-line monolith — should be split into `PointageTab` and `DashboardTab` sub-components to reduce re-renders | 🟡 Medium | Performance | `src/pages/Administratif.tsx:1-957` |
| 20 | `formatLongDate` wrapped in `useMemo` unnecessarily — `Intl.DateTimeFormat` instantiation is cheap and memoization adds overhead with no gain | ⚪ Low | Performance | `src/pages/Administratif.tsx:384-386` |
| 21 | Swim mode toggle in Records uses `max-[360px]:text-[10px]` — fragile responsive typography, may still truncate on very small devices | ⚪ Low | Responsive/Mobile | `src/pages/Records.tsx:641` |
| 22 | The FAB "+" button in Administratif has no visible label or tooltip for sighted users unfamiliar with the convention | ⚪ Low | UX/Usability | `src/pages/Administratif.tsx:677-684` |
| 23 | Chart histogram in Administratif uses a fixed `h-52` height — on small screens this may feel cramped or cause layout issues | ⚪ Low | Responsive/Mobile | `src/pages/Administratif.tsx:860` |
| 24 | `Records.tsx` access-denied state uses `<Waves>` icon while the actual data-error state uses `<AlertCircle>` — inconsistent empty state iconography | ⚪ Low | Consistency | `src/pages/Records.tsx:564-573` vs `577-588` |
| 25 | AppLayout adds `pb-20` for mobile bottom nav, but Dashboard's own mobile top-header uses `pt-20` to compensate — this coupling is fragile if nav height ever changes | ⚪ Low | Consistency | `src/components/layout/AppLayout.tsx:46`, `src/pages/Dashboard.tsx:741` |

---

## Criticality Legend
- 🔴 **Critical**: Breaks functionality or violates accessibility standards
- 🟠 **High**: Significantly impacts user experience or design quality  
- 🟡 **Medium**: Noticeable issue that should be addressed
- ⚪ **Low**: Nice-to-have improvement

---

## Next Steps

**Priority 1 — Accessibility (fix immediately):**
1. Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to the custom `Modal` in Dashboard — or replace with shadcn `Dialog`
2. Convert desktop nav `<button>` navigation elements to proper `<a>` / `<Link>` elements with `aria-current="page"`
3. Add `aria-pressed` to `SegmentedControl` buttons in RecordsClub — or swap for shadcn `ToggleGroup`
4. Fix the double `aria-label` + `sr-only` on the modal close button

**Priority 2 — Quality (address before next release):**
5. Remove all `console.log` / `console.warn` debug statements from Dashboard
6. Replace hardcoded amber utilities in the competition banner with `--status-warning` / `--status-warning-bg` tokens
7. Fix the duplicate mobile/desktop header in Dashboard into a single responsive component
8. Fix FAB shadow in Administratif to use CSS variable for the color component

**Priority 3 — Consistency & Polish:**
9. Unify border radius scale across pages (pick `rounded-xl` or `rounded-2xl` as the card standard)
10. Standardize sticky header pattern across all pages
11. Extract `strokeKey`/`distance` to shared utility in `src/lib/utils.ts`
12. Split `Administratif.tsx` into sub-components
13. Add `motion-reduce` guard to Framer Motion animations in Records

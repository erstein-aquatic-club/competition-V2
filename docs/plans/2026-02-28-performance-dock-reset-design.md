# Performance Optimization & Dock Reset — Design

**Date :** 2026-02-28

## Contexte

L'application charge parfois lentement. Audit complet identifiant les goulots d'etranglement principaux. En parallele, le clic sur une icone du dock doit toujours ramener a la page d'accueil de la section.

## A. Logo optimise (fort impact)

`logo-eac.png` = 382 KB, affiche en 32x32px (nav) et 128x128px (login). Convertir en WebP avec tailles adaptees (64px, 256px). Gain ~370 KB.

## B. Lazy-loading sous-ecrans Coach (fort impact)

8 sous-ecrans importes eagerly dans `Coach.tsx` (~200 KB source). Les wrapper avec `lazy()` + `Suspense` pour ne charger que l'ecran actif. Seuls `StrengthCatalog` et `SwimCatalog` sont deja lazy.

Sous-ecrans a lazy-loader :
- CoachSwimmersOverview
- CoachMessagesScreen
- CoachSmsScreen
- CoachCalendar
- CoachGroupsScreen
- CoachCompetitionsScreen
- CoachObjectivesScreen
- CoachTrainingSlotsScreen

## C. Vendor chunks (impact moyen)

Ajouter dans `vite.config.ts` > `manualChunks` :
- `vendor-motion` : `framer-motion` (16 fichiers importent)
- `vendor-charts` : `recharts` (4 pages)
- `vendor-date` : `date-fns` (11 fichiers)

## D. Selecteurs Zustand useAuth (impact moyen)

Remplacer les destructurations du store entier par des selecteurs cibles dans :
- `Dashboard.tsx`, `Progress.tsx`, `Strength.tsx`, `Records.tsx`, `Profile.tsx`, `App.tsx (AppRouter)`, `Login.tsx`

Pattern : `const user = useAuth(s => s.user)` au lieu de `const { user } = useAuth()`.

## E. Dock reset a l'accueil

Approche event-based existante (`NAV_RESET_EVENT`) conservee. Ajouter des listeners dans les pages avec etat interne pour reset :
- Coach.tsx : deja fait (reset `activeSection` a `"home"`)
- Dashboard.tsx : reset drawers, scroll top
- Strength.tsx : reset a l'etat initial
- Progress.tsx : reset filtres/onglets
- Profile.tsx : reset sections expandees
- Autres pages simples : scroll top suffit (deja gere par AppLayout)

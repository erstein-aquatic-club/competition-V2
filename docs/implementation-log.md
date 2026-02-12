# Journal d'implémentation

Ce document trace l'avancement de **chaque patch** du projet. Il est la source de vérité pour savoir ce qui a été fait, quand, et pourquoi.

**Règle** : chaque lot de modifications (commit ou groupe de commits liés) doit avoir une entrée ici. Voir `docs/ROADMAP.md` § "Règles de documentation" pour le format détaillé.

### Format d'une entrée

```
## YYYY-MM-DD — Titre du patch
**Branche** : `nom`
**Chantier ROADMAP** : §N — Nom (si applicable)
### Contexte — Pourquoi ce patch
### Changements réalisés — Ce qui a été modifié
### Fichiers modifiés — Tableau fichier / nature
### Tests — Checklist build/test/tsc + tests manuels
### Décisions prises — Choix techniques et arbitrages
### Limites / dette — Ce qui reste imparfait
```

### Avancement global

| Chantier ROADMAP | Statut | Dernière activité |
|------------------|--------|-------------------|
| §1 Refonte inscription | ✅ Fait | 2026-02-08 |
| §2 Import performances FFN | ✅ Fait | 2026-02-08 |
| §3 Gestion coach imports | ✅ Fait | 2026-02-08 |
| §4 Records club | ✅ Fait | 2026-02-08 |
| §5 Dette UI/UX | ✅ Fait | 2026-02-08 |
| §6 Fix timers PWA iOS | ✅ Fait | 2026-02-09 |
| §7 Records admin + FFN full history + stroke KPI | ✅ Fait | 2026-02-12 |
| §8 4 bugfixes (IUF Coach, RecordsClub, Reprendre, 1RM 404) | ✅ Fait | 2026-02-12 |
| §9 RecordsAdmin UX: incomplete swimmer warnings | ✅ Fait | 2026-02-12 |
| §10 Fix: extract age from competition_name, remove birthdate requirement | ✅ Fait | 2026-02-12 |

---

## 2026-02-12 — Fix: extract age from competition_name, remove birthdate requirement (§10)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §10 — Fix missing club records

### Contexte
Beaucoup de records manquent car `recalculateClubRecords()` exigeait `iuf + sex + birthdate` pour chaque nageur. Or la colonne `competition_name` de `swimmer_performances` contient déjà l'âge du nageur au format "(12 ans)". On peut donc extraire l'âge directement et supprimer l'exigence de `birthdate`.

### Changements réalisés
1. **`import-club-records/index.ts`** — `recalculateClubRecords()` :
   - Ajout de `extractAgeFromText()` qui parse `(XX ans)` depuis `competition_name`
   - Le swimmerMap n'exige plus que `iuf + sex` (birthdate optionnel)
   - L'âge est extrait de `competition_name` en priorité, fallback sur `calculateAge(birthdate, date)` si disponible
   - Les performances sans âge détectable sont ignorées (au lieu d'ignorer tous les nageurs sans birthdate)

2. **`ffn-parser.ts`** — Séparation age/competition_name :
   - Nouveau champ `swimmer_age: number | null` sur `RecFull`
   - Les cellules "(XX ans)" sont détectées et extraites séparément
   - `competition_name` contient maintenant le vrai nom de compétition (pas l'âge)
   - Les anciens imports (où competition_name = "(12 ans)") restent gérés par `extractAgeFromText()`

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `supabase/functions/import-club-records/index.ts` | extractAgeFromText, relax birthdate requirement |
| `supabase/functions/_shared/ffn-parser.ts` | swimmer_age field, separate age from competition_name |

### Tests
- [x] `npm run build` — succès

### Décisions prises
- Pas de nouvelle colonne DB — l'âge est parsé depuis `competition_name` existant
- Les futurs imports stockeront correctement le nom de compétition (plus "(12 ans)")
- Le warning RecordsAdmin reste en place (birthdate toujours recommandé comme fallback)

---

## 2026-02-12 — RecordsAdmin UX: incomplete swimmer warnings + recalculate button (§9)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §9 — RecordsAdmin UX improvements

### Contexte
User reports missing performances for both former swimmers and account holders. Root cause: `recalculateClubRecords()` requires `iuf + sex + birthdate` on each `club_record_swimmers` entry, but existing users who signed up before migration 00014 have `sex = NULL`. RecordsAdmin gave no feedback about which swimmers were incomplete.

### Changements réalisés
1. **Warning banner** in RecordsAdmin showing count of active swimmers missing required fields (iuf/sex/birthdate)
2. **Red ring highlights** on empty IUF, Sex, and Birthdate fields for active swimmers
3. **Standalone "Recalculer" button** — recalculates club records from existing data without re-fetching from FFN (no rate limit, faster)
4. **display_name sync** in `syncClubRecordSwimmersFromUsers()` — now also updates name if changed

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/pages/RecordsAdmin.tsx` | Warning banner, red rings, Recalculer button |
| `src/lib/api/records.ts` | Add display_name to sync select + update |

### Tests
- [x] `npx tsc --noEmit` — 0 erreurs
- [x] `npm run build` — succès

### Décisions prises
- Red ring uses `ring-2 ring-destructive/50` for visibility without being too aggressive
- Recalculate button uses `RefreshCw` icon with spin animation during operation
- Warning banner only shown when at least 1 active swimmer is incomplete

### Limites / dette
- Existing users need admin to manually set sex in RecordsAdmin (migration 00014 only affects new signups)
- Edge functions must be deployed to Supabase Cloud separately

---

## 2026-02-12 — 4 bugfixes: IUF Coach, empty RecordsClub, Reprendre grayed, 1RM 404 (§8)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §8 — Bugfixes

### Contexte

4 bugs reported after §7: Coach view can't see/use swimmer IUF for FFN imports, RecordsClub view always empty, Reprendre (resume) button for strength workouts always grayed out, Info 1RM button leads to 404.

### Changements réalisés

1. **IUF in Coach view** — Added `ffn_iuf` to `AthleteSummary` type, joined `user_profiles` in `getAthletes()` to fetch IUF, added IUF column + per-swimmer FFN import button in Coach athletes table
2. **RecordsClub empty** — Root cause: `user_profiles` had no `sex` column, so `syncClubRecordSwimmersFromUsers()` always set `sex: null`, and `recalculateClubRecords()` skipped entries with null sex. Added `sex` column to `user_profiles`, sex selector in signup form, updated auth trigger, fixed sync to also update existing entries
3. **Reprendre button** — Root cause: `session_id` not persisted to DB. Added `session_id` column to `strength_session_runs`, included it in `startStrengthRun()` insert
4. **Info 1RM 404** — Root cause: `useHashLocation` returned `/records?tab=1rm` including query params, which Wouter couldn't match against `/records`. Fixed by stripping query params in `getHashPath()`

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/App.tsx` | Strip query params in `getHashPath()` |
| `src/lib/api/types.ts` | Add `ffn_iuf` to `AthleteSummary` |
| `src/lib/api/users.ts` | Join `user_profiles` in `getAthletes()` for `ffn_iuf` |
| `src/lib/api/strength.ts` | Persist `session_id` in `startStrengthRun()` |
| `src/lib/api/records.ts` | Fix `syncClubRecordSwimmersFromUsers()` to update existing entries |
| `src/pages/Coach.tsx` | IUF column + import button in athletes table |
| `src/pages/Login.tsx` | Sex selector in signup form |
| `supabase/migrations/00014_fixes.sql` | `sex` on `user_profiles`, `session_id` on `strength_session_runs`, updated trigger |

### Tests

- [x] `npx tsc --noEmit` — 0 erreur
- [x] `npm run build` — succès

### Décisions prises

- Sex is collected at signup and stored in `user_profiles.sex`, then propagated to `club_record_swimmers` via sync
- For existing users without sex, admin can set it from RecordsAdmin (already had sex editor per swimmer)
- `getAthletes()` fetches `user_profiles` separately rather than using nested join, for compatibility with both group/no-group paths

### Limites / dette

- Existing users must have sex set manually in RecordsAdmin or profile before their records can be calculated
- `getHashPath()` now strips all query params globally; any future hash-based query param routing must read `window.location.hash` directly

---

## 2026-02-12 — Records admin fixes, FFN full history, stroke breakdown, rate limiting (§7)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §7 — Records admin + FFN + stroke KPI

### Contexte

Multiple issues reported: accent encoding bugs in RecordsAdmin, FFN scraper only importing personal bests (MPP) instead of full history, club records empty after individual imports, coach access to club records missing, no last update tracking, no rate limiting, and missing swim distance breakdown by stroke in KPI view.

### Changements réalisés

1. **Accent encoding** — Replaced all `\u00xx` escape sequences with actual UTF-8 characters in RecordsAdmin.tsx and RecordsClub.tsx
2. **FFN full history** — Changed scraper to use `idopt=prf&idbas=25` and `idopt=prf&idbas=50` for all performances (not just MPP). New `fetchAllPerformances()` shared function in ffn-parser.ts
3. **Import logs for single imports** — ffn-performances Edge Function now creates import_logs entries with status tracking (running/success/error)
4. **Club records recalculation** — import-club-records supports `mode: "recalculate"` to rebuild records from existing data without fetching FFN
5. **Coach access** — Added "Voir les records du club" button in Coach.tsx and RecordsAdmin header
6. **Auto-sync swimmers** — New `syncClubRecordSwimmersFromUsers()` creates club_record_swimmers entries for all active athletes on RecordsAdmin mount
7. **Last update tracking** — `last_imported_at` column on club_record_swimmers, amber highlight for stale (30+ days)
8. **Rate limiting** — app_settings table with configurable limits (coach 3/month, athlete 1/month, admin unlimited), enforced in both Edge Functions
9. **Stroke distance breakdown** — `stroke_distances` JSONB on dim_sessions, collapsible input UI in Dashboard, pie chart + stacked bar chart in Progress

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/pages/RecordsAdmin.tsx` | Fix accents, auto-sync, last_imported_at display, rate limit settings UI |
| `src/pages/RecordsClub.tsx` | Fix accent in formatLastUpdate |
| `src/pages/Coach.tsx` | Add "Voir les records du club" button |
| `src/pages/Dashboard.tsx` | Stroke distance input UI (collapsible 5-field grid) |
| `src/pages/Progress.tsx` | Stroke breakdown pie chart + stacked bar chart |
| `src/lib/api.ts` | Facade stubs for new API functions |
| `src/lib/api/index.ts` | Re-exports for new functions |
| `src/lib/api/records.ts` | recalculateClubRecords, syncClubRecordSwimmers, getAppSettings, updateAppSettings |
| `src/lib/api/types.ts` | StrokeDistances type, stroke_distances on Session/SyncSessionInput |
| `src/lib/api/helpers.ts` | stroke_distances in mapToDbSession/mapFromDbSession |
| `supabase/functions/_shared/ffn-parser.ts` | defaultPool param + fetchAllPerformances() |
| `supabase/functions/ffn-performances/index.ts` | Full rewrite: fetchAll, import_logs, rate limit, last_imported_at |
| `supabase/functions/import-club-records/index.ts` | Recalculate mode, fetchAll per swimmer, rate limit |
| `supabase/migrations/00013_import_rate_limiting.sql` | New: last_imported_at, app_settings, stroke_distances |

### Tests

- [x] `npx tsc --noEmit` — 0 erreur
- [x] `npm run build` — succès (16.35s)

### Décisions prises

- FFN scraping: two separate fetches (25m + 50m pools) with `defaultPool` fallback in parser
- Rate limiting enforced server-side in Edge Functions, configurable via app_settings table
- Stroke breakdown only shown in Progress when data exists (`hasData` flag)
- Stroke input is optional/collapsible in Dashboard (doesn't break existing workflow)

### Limites / dette

- Stroke distances are manually entered per session (no auto-extraction from swim catalog blocks)
- Rate limiting counts all imports in current month regardless of target swimmer

---

## 2026-02-09 — Fix timers mode focus pour PWA iOS (§6)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §6 — Fix timers mode focus (PWA iOS background)

### Contexte

Les timers dans WorkoutRunner (elapsed + repos) utilisaient des `setInterval` relatifs (+1s / -1s). Sur iPhone en PWA (`apple-mobile-web-app-capable`), iOS throttle/suspend les intervals quand l'écran se verrouille ou l'app passe en arrière-plan. Résultat : un repos de 90s pouvait durer 3-4 minutes en temps réel.

### Changements réalisés

1. **Timer elapsed** — Remplacé `setInterval(() => t + 1, 1000)` par un calcul basé sur `Date.now() - elapsedStartRef`. L'état `elapsedTime` est recalculé à chaque tick, pas incrémenté.
2. **Timer repos** — Remplacé `setInterval(() => t - 1, 1000)` par un calcul basé sur `restEndRef.current - Date.now()`. Le timestamp de fin est stocké dans un ref, le remaining est recalculé à chaque tick.
3. **Listener `visibilitychange`** — Ajouté sur les deux timers pour forcer un recalcul immédiat au retour au premier plan (le setInterval peut avoir un délai de reprise).
4. **Pause/Reprise repos** — Au pause, `restPausedRemainingRef` sauvegarde les ms restantes. Au reprise, `restEndRef` est recalculé à `Date.now() + remaining`.
5. **Boutons +15s/+30s/-15s/Reset** — Ajustent `restEndRef` (et `restPausedRemainingRef` si en pause) en plus de l'état React.

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/components/strength/WorkoutRunner.tsx` | Remplacement des 2 timers relatifs par des timestamps absolus + visibilitychange |

### Tests

- [x] `npx tsc --noEmit` — 0 erreur
- [x] `npm run build` — OK (16.8s)
- [x] `npm test` — 63 pass, 2 fail (pré-existants)

### Décisions prises

- `Date.now()` plutôt que `performance.now()` car plus simple et suffisant pour des timers à la seconde
- Les refs (`useRef`) stockent les timestamps absolus, l'état React (`useState`) ne contient que les valeurs d'affichage en secondes
- Le `visibilitychange` listener est dupliqué sur chaque timer (elapsed + repos) car ils sont dans des `useEffect` séparés avec des cycles de vie différents

### Limites / dette

- Sur iOS, les notifications audio/vibration à la fin du repos ne fonctionneront pas en arrière-plan (limitation OS, pas fixable côté web)
- Le timer elapsed ne gère pas la pause (pas de bouton pause pour le timer global, seulement pour le repos)

---

## 2026-02-08 — §5 Phase 1 : Fixes critiques + Quick UX fixes

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §5 — Dette technique UI/UX

### Contexte

14 tests échouaient (import.meta.env dans supabase.ts), 31 erreurs TypeScript (helpers.ts runs: unknown[]), pas de manifest PWA, scroll non reset entre pages, overflow dans Records, race condition dans WorkoutRunner (set skipping), UX silencieuse sur les erreurs.

### Changements réalisés

1. **Fix tests (14→2 failures)** — `supabase.ts` utilise maintenant `supabaseConfig` de `config.ts` au lieu de `import.meta.env` direct
2. **Fix TypeScript (31→0 erreurs)** — `helpers.ts:42` `runs: unknown[]` → `LocalStrengthRun[]`, `api.ts` assertExerciseType → normalizeExerciseType, suppression export `useApiCapabilities`
3. **PWA Manifest** — Création `public/manifest.json`, lien dans `index.html`, meta theme-color
4. **Scroll reset navigation** — `AppLayout.tsx` : useEffect scrollTo(0,0) sur changement de route
5. **Records.tsx fixes** — Suppression `overflow-hidden` conflictuel, messages d'erreur explicites quand IUF vide
6. **Login.tsx fixes** — `htmlFor` manquant, `loading="lazy"` sur logo
7. **WorkoutRunner bug critique** — `isLoggingRef` guard pour empêcher la race condition set-skip entre `handleValidateSet` et `useEffect` sur `initialLogs`
8. **WorkoutRunner UX** — AlertDialog confirmation abandon, loading "Commencer séance", toasts erreur (plus de catch vides), scroll reset entre exercices, loading="lazy" GIF
9. **StrengthCatalog drag-drop** — Feedback visuel (ring-2 + bg-accent) sur la cible de drag

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/lib/supabase.ts` | Import config.ts au lieu de import.meta.env |
| `src/lib/api/helpers.ts` | runs: LocalStrengthRun[] |
| `src/lib/api.ts` | normalizeExerciseType |
| `src/lib/api/index.ts` | Suppression useApiCapabilities |
| `public/manifest.json` | Créé — PWA manifest |
| `index.html` | Lien manifest + meta theme-color |
| `src/components/layout/AppLayout.tsx` | Scroll reset |
| `src/pages/Records.tsx` | Overflow fix + messages erreur |
| `src/pages/Login.tsx` | htmlFor + lazy loading |
| `src/components/strength/WorkoutRunner.tsx` | Bug set-skip + UX overhaul |
| `src/pages/coach/StrengthCatalog.tsx` | Drag-drop feedback |

### Tests

- [x] `npx tsc --noEmit` — 0 erreur
- [x] `npm run build` — OK
- [x] `npm test` — 63 pass, 2 fail (pré-existants: summarizeApiError text + WorkoutRunner "Saisie série")

---

## 2026-02-08 — §5 Phase 2 : Refactoring api.ts + Couleurs + Password reset

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §5 — Dette technique UI/UX

### Contexte

api.ts monolithique (2277 lignes), ~140 couleurs hardcodées dans 11 fichiers, aucun flow mot de passe oublié, pas de skeletons de chargement.

### Changements réalisés

**A. Refactoring api.ts (2277 → 426 lignes, -81%)**

7 modules extraits dans `src/lib/api/` :
- `users.ts` — getProfile, getAthletes, approveUser, rejectUser, etc.
- `timesheet.ts` — CRUD shifts/locations/coaches
- `notifications.ts` — send, list, mark_read
- `assignments.ts` — CRUD assignments
- `swim.ts` — getSwimCatalog, createSwimSession, deleteSwimSession
- `records.ts` — hallOfFame, club records, swim records, performances
- `strength.ts` — exercises, sessions, runs, logs, history, 1RM

`api/index.ts` re-exporte tout. L'objet `api` dans `api.ts` délègue aux modules.

**B. Migration couleurs + Skeletons**

- Tokens sémantiques dans `index.css` : `--intensity-1..5`, `--rank-gold/silver/bronze`, `--status-success/warning/error`, `--tag-swim/educ` (light + dark mode)
- Remplacement dans 10 fichiers : Dashboard, FlatScale, SwimSessionConsultation, IntensityDots, IntensityDotsSelector, HallOfFame, SwimCatalog, Admin, TimesheetShiftList, Login
- Skeletons de chargement dans Dashboard.tsx et Strength.tsx

**C. Flow mot de passe oublié**

- `Login.tsx` : mode "forgotPassword" avec input email + `supabase.auth.resetPasswordForEmail()`
- `App.tsx` : composant `ResetPassword` + route `/#/reset-password`, détection token recovery dans URL hash
- `auth.ts` : helper `handlePasswordReset()`
- Login.tsx couleurs hardcodées → tokens sémantiques

### Fichiers modifiés/créés

| Fichier | Nature |
|---------|--------|
| `src/lib/api/users.ts` | Créé — 9403 bytes |
| `src/lib/api/timesheet.ts` | Créé — 6822 bytes |
| `src/lib/api/notifications.ts` | Créé — 7970 bytes |
| `src/lib/api/assignments.ts` | Créé — 8762 bytes |
| `src/lib/api/swim.ts` | Créé — 6068 bytes |
| `src/lib/api/records.ts` | Créé — 13170 bytes |
| `src/lib/api/strength.ts` | Créé — 32850 bytes |
| `src/lib/api.ts` | Refactoré 2277→426 lignes |
| `src/lib/api/index.ts` | Re-exports 7 nouveaux modules |
| `src/index.css` | +91 lignes tokens sémantiques |
| `src/pages/Dashboard.tsx` | Couleurs + skeleton |
| `src/pages/Strength.tsx` | Couleurs + skeleton |
| `src/pages/Login.tsx` | Password reset + couleurs |
| `src/App.tsx` | ResetPassword route + recovery detection |
| `src/lib/auth.ts` | handlePasswordReset helper |
| `src/components/swim/FlatScale.tsx` | Couleurs |
| `src/components/swim/IntensityDots.tsx` | Couleurs |
| `src/components/swim/IntensityDotsSelector.tsx` | Couleurs |
| `src/components/swim/SwimSessionConsultation.tsx` | Couleurs |
| `src/pages/HallOfFame.tsx` | Couleurs |
| `src/pages/coach/SwimCatalog.tsx` | Couleurs |
| `src/pages/Admin.tsx` | Couleurs |
| `src/components/timesheet/TimesheetShiftList.tsx` | Couleurs |

### Tests

- [x] `npx tsc --noEmit` — 0 erreur
- [x] `npm run build` — OK (16s)
- [x] `npm test` — 63 pass, 2 fail (mêmes pré-existants)

### Décisions prises

- api.ts garde l'objet `api` comme façade, les modules sont des fonctions standalone
- Tokens CSS sémantiques plutôt que chercher-remplacer de classes (meilleure maintenabilité)
- Password reset via hash routing compatible (`/#/reset-password`) avec détection du fragment recovery Supabase

---

## 2026-02-08 — Cache bust pour déploiement GitHub Pages

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : Hors roadmap — Amélioration infra déploiement

### Contexte

L'application PWA-like (meta `apple-mobile-web-app-capable`) a du mal à se rafraîchir après chaque déploiement sur GitHub Pages. Les navigateurs (surtout Safari iOS) cachent agressivement `index.html`. Aucun mécanisme de versioning ou d'anti-cache n'était en place.

### Changements réalisés

1. **Anti-cache meta tags dans `index.html`** — `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0`
2. **Build timestamp dans `vite.config.ts`** — `define: { __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()) }` injecte un timestamp unique à chaque build
3. **Log build version dans `src/main.tsx`** — `console.log([EAC] Build: ${__BUILD_TIMESTAMP__})` pour vérifier la version déployée
4. **Instruction dans `CLAUDE.md`** — Section "Cache bust (déploiement)" ajoutée

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `index.html` | Ajout meta tags anti-cache |
| `vite.config.ts` | Ajout `define.__BUILD_TIMESTAMP__` |
| `src/main.tsx` | Ajout log build timestamp |
| `CLAUDE.md` | Ajout section cache bust |

### Tests

- [x] `npm run build` — OK
- [x] `npx tsc --noEmit` — erreurs pré-existantes uniquement

### Décisions prises

- Meta tags HTTP-equiv plutôt que headers HTTP (pas de contrôle serveur sur GitHub Pages)
- Build timestamp injecté par Vite `define` (automatique, pas de fichier à maintenir)
- Pas de service worker (risque de cache permanent difficile à invalider)

### Limites / dette

- Les meta tags HTTP-equiv sont moins fiables que de vrais headers HTTP côté serveur
- GitHub Pages ne permet pas de configurer des Cache-Control headers personnalisés
- Un manifest.json + service worker avec stratégie "network-first" serait la solution idéale mais plus complexe

---

## 2026-02-08 — Refonte parcours d'inscription (§1)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §1 — Refonte parcours d'inscription

### Contexte

L'inscription fonctionnait mais l'UX post-inscription était confuse : message d'erreur dans le dialogue, pas de handler pour la confirmation email Supabase, liens de confirmation non gérés. Option B choisie (validation coach/admin) car plus simple et adaptée à un club local.

### Changements réalisés

1. **Migration `00009_add_user_approval.sql`** — Colonnes `is_approved`, `approved_by`, `approved_at` sur `user_profiles`. Trigger `handle_new_auth_user` modifié pour `is_approved = false` sur les nouvelles inscriptions.
2. **Auth store** — `isApproved` ajouté au store Zustand, fetch depuis `user_profiles` dans `loadUser()`
3. **Login.tsx** — Écran post-inscription "Compte créé, en attente de validation" au lieu d'auto-login
4. **App.tsx** — Gate d'approbation : écran "En attente de validation" avec bouton déconnexion
5. **Admin.tsx** — Section "Inscriptions en attente" avec boutons Approuver/Rejeter
6. **API** — Méthodes `getPendingApprovals()`, `approveUser()`, `rejectUser()`

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `supabase/migrations/00009_add_user_approval.sql` | Créé — colonnes approval + trigger modifié |
| `src/lib/auth.ts` | Ajout isApproved au store + loadUser + logout |
| `src/pages/Login.tsx` | Écran post-inscription signupComplete |
| `src/App.tsx` | Gate approbation (Card centré) |
| `src/pages/Admin.tsx` | Section inscriptions en attente + mutations |
| `src/lib/api.ts` | 3 nouvelles méthodes (getPendingApprovals, approveUser, rejectUser) |

### Tests

- [x] `npm run build` — OK
- [x] `npx tsc --noEmit` — erreurs pré-existantes uniquement
- [ ] Test manuel — inscription self-service, gate, approbation admin

### Décisions prises

- Option B (validation admin) plutôt qu'Option A (confirmation email) : hash-routing incompatible avec callbacks Supabase, contexte club local
- `is_approved DEFAULT true` pour ne pas affecter les users existants
- Gate dans App.tsx au niveau du routeur pour bloquer tout accès avant approbation

### Limites / dette

- Pas de flow "mot de passe oublié" (hors scope §1)
- La configuration Supabase "Disable email confirmations" doit être faite manuellement dans le dashboard

---

## 2026-02-08 — Import historique complet performances FFN (§2)

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §2 — Import de toutes les performances FFN d'un nageur

### Contexte

La Edge Function `ffn-sync` n'importait que les records personnels (meilleur temps par épreuve). Besoin d'importer l'historique complet des performances de compétition pour alimenter les graphiques de progression et les records club.

### Changements réalisés

1. **Migration `00010_swimmer_performances.sql`** — Table `swimmer_performances` avec contrainte UNIQUE pour déduplication, index, RLS
2. **Module partagé `_shared/ffn-parser.ts`** — Extraction des parseurs FFN : `clean()`, `parseTime()`, `parseDate()`, `formatTimeDisplay()`, `parseHtmlFull()` (toutes perfs), `parseHtmlBests()` (meilleurs temps)
3. **Refactoring `ffn-sync`** — Import depuis `_shared/ffn-parser.ts`, suppression des fonctions dupliquées
4. **Edge Function `ffn-performances`** — Import complet via `parseHtmlFull()`, upsert par chunks de 100
5. **Interface `SwimmerPerformance`** dans `api/types.ts`
6. **API** — `importSwimmerPerformances()` et `getSwimmerPerformances()` avec filtres
7. **Records.tsx** — Nouvel onglet "Historique" avec import FFN, liste chronologique, filtres (épreuve, bassin), graphique Recharts de progression

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `supabase/migrations/00010_swimmer_performances.sql` | Créé — table + index + RLS |
| `supabase/functions/_shared/ffn-parser.ts` | Créé — module partagé parseurs FFN |
| `supabase/functions/ffn-sync/index.ts` | Refactoré — import depuis _shared |
| `supabase/functions/ffn-performances/index.ts` | Créé — Edge Function import complet |
| `src/lib/api/types.ts` | Ajout SwimmerPerformance interface |
| `src/lib/api.ts` | 2 nouvelles méthodes |
| `src/pages/Records.tsx` | Onglet Historique (+277 lignes) |

### Tests

- [x] `npm run build` — OK
- [x] `npx tsc --noEmit` — erreurs pré-existantes uniquement
- [ ] Test manuel — import FFN + affichage historique + graphique progression

### Décisions prises

- `event_code` stocké en format FFN brut ("50 NL") dans `swimmer_performances`, normalisation vers "50_FREE" uniquement dans `import-club-records` pour les records club
- Module partagé `_shared/ffn-parser.ts` pour éviter duplication entre `ffn-sync`, `ffn-performances` et `import-club-records`
- Upsert par chunks de 100 pour éviter les timeouts sur gros imports

### Limites / dette

- Le parseur HTML FFN dépend de la structure du site FFN Extranat (risque de casse si le site change)
- Pas de pagination dans l'affichage des performances (toutes chargées d'un coup)
- Le graphique Recharts affiche toutes les performances sans limite

---

## 2026-02-08 — Gestion coach des imports + Records club alimentés (§3 + §4)

**Chantier ROADMAP** : §3 — Gestion coach des imports de performances, §4 — Records club par catégorie d'âge / sexe / nage

### Contexte

Les chantiers §1 (approbation utilisateur) et §2 (import performances FFN) avaient été implémentés précédemment, créant les bases (table `swimmer_performances`, Edge Function `ffn-performances`, parser FFN partagé). Cependant :
- Le bouton "Mettre à jour les records" dans `RecordsAdmin.tsx` appelait `import-club-records` qui n'existait pas
- Le coach ne pouvait pas importer les performances d'un nageur individuel
- Aucun historique des imports n'était disponible
- Les tables `club_records` et `club_performances` restaient vides
- La page Records du Club (`RecordsClub.tsx`) n'affichait aucune donnée

### Changements réalisés

1. **Migration `00011_import_logs.sql`** — Table `import_logs` pour traçabilité des imports (triggered_by, swimmer_iuf, status, counts, timestamps)
2. **Module partagé `ffn-event-map.ts`** — Mapping des noms d'épreuves FFN (français) vers les codes normalisés utilisés dans `RecordsClub.tsx` (ex: "50 NL" -> "50_FREE")
3. **Edge Function `import-club-records`** — Fonction complète qui :
   - Vérifie le rôle JWT (coach ou admin)
   - Importe les performances FFN pour chaque nageur actif avec IUF
   - Crée des entrées de log pour chaque import
   - Recalcule les records club (best time par event_code, pool_length, sex, age)
   - Insère dans `club_performances` puis upsert dans `club_records`
4. **Méthodes API** — `getImportLogs()` et `importSingleSwimmer()` ajoutées à `api.ts`
5. **RecordsAdmin enrichi** — Colonne "Actions" avec bouton "Importer" par nageur, section "Historique des imports" avec table de logs, invalidation du cache club-records après import
6. **RecordsClub amélioré** — Indicateur "Dernière mise à jour" basé sur le dernier import réussi

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `supabase/migrations/00011_import_logs.sql` | Créé — table import_logs avec RLS |
| `supabase/functions/_shared/ffn-event-map.ts` | Créé — mapping FFN -> codes normalisés |
| `supabase/functions/import-club-records/index.ts` | Créé — Edge Function bulk import + recalcul records |
| `src/lib/api.ts` | Ajout méthodes getImportLogs(), importSingleSwimmer() |
| `src/pages/RecordsAdmin.tsx` | Ajout useQuery, useQueryClient, import logs, per-swimmer import, historique |
| `src/pages/RecordsClub.tsx` | Ajout indicateur dernière mise à jour |

### Tests

- [x] `npm run build` — compilation OK
- [x] `npm test` — 29 tests passent (14 échouent — erreurs pré-existantes `import.meta.env` en environnement test, non liées à ce patch)
- [ ] Test manuel — Edge Function à tester avec Supabase déployé

### Décisions prises

- L'âge est "clampé" entre 8 et 17 ans pour correspondre aux catégories de `RecordsClub.tsx`
- Les performances FFN sont upsertées avec `ON CONFLICT DO NOTHING` (idempotent)
- Le recalcul des records se fait en mémoire puis upsert, pas de SQL complexe
- L'import individuel réutilise la Edge Function `ffn-performances` existante

### Limites / dette

- Le recalcul des records parcourt toutes les performances en mémoire — pourrait être lourd avec beaucoup de nageurs
- Pas de pagination dans l'historique des imports (limité à 20 entrées)
- L'import individuel ne crée pas d'entrée dans `import_logs` (seul l'import bulk le fait)
- Les Edge Functions ne sont pas testées unitairement

---

## 2026-02-07 — Mise à jour documentation & Roadmap

**Branche** : `claude/review-app-features-J0mww`

### Complété

| Tâche | Notes |
|-------|-------|
| Revue complète des fonctionnalités | Toutes les features actives sont 100% fonctionnelles |
| Mise à jour `FEATURES_STATUS.md` | Correction `coachStrength: true`, ajout statuts planifiés |
| Création `ROADMAP.md` | 4 chantiers futurs documentés en détail |
| Mise à jour `README.md` | Roadmap, statut features, liens docs |
| Création `CLAUDE.md` | Contexte pour reprises futures par Claude |
| Nettoyage `roadmap-data-contract.md` | Marqué comme legacy (réf. Cloudflare obsolètes) |
| Mise à jour `MEMORY.md` | Contexte persistant pour sessions futures |

### Diagnostic des fonctionnalités

**100% fonctionnelles :** Auth, Dashboard nageur, Progression, Catalogue nage coach, Assignation, Musculation nageur (WorkoutRunner, historique, 1RM), Musculation coach (builder, catalogue), Records perso, Hall of Fame, Messagerie, Pointage heures, Vue comité, Admin, Profil.

**Partiellement fonctionnelles :**
- Inscription self-service (UX post-inscription confuse, callback email non géré)
- Records club (UI prête mais données vides, import inexistant)

**Non implémentées :**
- Edge Function `import-club-records` (bouton UI existe, backend manquant)
- Import historique complet performances FFN
- Gestion coach des imports
- Flow mot de passe oublié

### Chantiers futurs identifiés

1. Refonte parcours d'inscription (priorité haute)
2. Import toutes performances FFN (priorité haute)
3. Gestion coach des imports (priorité moyenne)
4. Records club alimentés (priorité moyenne, dépend de §2 et §3)

Voir [`docs/ROADMAP.md`](./ROADMAP.md) pour le détail complet.

---

## 2026-02-06 — FFN Sync Fix & Plan

**Branche** : `claude/cloudflare-to-supabase-migration-Ia5Pa`

### Complété ✅

| Tâche | Commit | Notes |
|-------|--------|-------|
| Migration schéma D1 → PostgreSQL | `00001-00006` | 6 fichiers migration |
| Edge Function ffn-sync | `029771b` | Sync records FFN |
| Edge Function admin-user | — | Gestion utilisateurs |
| Fix CORS headers ffn-sync | `029771b` | Headers sur toutes les réponses |
| Fix record_type='comp' FFN | `1bd610e` | Records FFN en section compétition |
| Fix toggle 25m/50m Records | `840e36c` | useMemo retournait undefined |
| Références Cloudflare → Supabase | `1aa0e99` | Profile.tsx, Records.tsx |
| Redesign liste exercices muscu | `b73611e` | Vue compacte mobile-first |
| Fix bouton "Lancer la séance" | `27fd696` | z-index BottomActionBar z-[60] |
| Fix padding reader mode | `27fd696` | pb-28 → pb-40 |
| Mise à jour README | `27fd696` | Architecture Supabase |
| Création FEATURES_STATUS.md | `27fd696` | Matrice fonctionnalités |
| **Fix FFN sync pool_length** | `de0063c` | **Regex parsing, split par "Bassin : 25/50 m"** |
| Optimisation GIF | `087e9a6` | max-h-36, decoding="async" |
| **Code splitting** | `1c3cedf` | **Lazy loading routes, vendor chunks (-80% bundle)** |
| **Refactor API types** | `8f556a6` | **Types extraits vers api/types.ts** |
| **Refactor API client** | `3f6c7f2` | **Utilitaires extraits vers api/client.ts** |
| **Tests E2E** | `f953073` | **Login, dashboard, records, strength (merged)** |
| **Audit UI/UX** | `f953073` | **Touch targets, safe areas, responsive (merged)** |
| **Typage strict** | `3569ecb` | **Suppression des `any` (merged)** |
| **Refactor API helpers** | `d104a3b` | **Helpers extraits vers api/helpers.ts** |

---

## Plan d'implémentation

### P0 — Critique (FAIT ✅)

- [x] Fix toggle 25/50m records
- [x] Fix bouton "Lancer la séance"
- [x] Fix FFN sync pool_length (doublons bassin)

### P1 — Haute priorité (FAIT ✅)

- [x] Audit UI/UX (responsive, mobile-first, ergonomie) — voir `patch-report.md`
- [x] Activer `coachStrength: true`
- [x] GIF exercices (13 manquants à ajouter dans Supabase)

### P2 — Prochains chantiers (voir `ROADMAP.md`)

| Tâche | Priorité | Description |
|-------|----------|-------------|
| Refonte inscription | Haute | UX post-inscription, callback email |
| Import performances FFN | Haute | Historique complet, pas juste records |
| Import records club | Haute | Edge Function à créer |
| Gestion coach imports | Moyenne | Dashboard coach pour piloter les imports |
| Records club | Moyenne | Données une fois imports fonctionnels |

### P3 — Dette technique

| Tâche | Priorité | Description |
|-------|----------|-------------|
| Couleurs hardcodées | Basse | ~50 occurrences slate/zinc hors `/ui/` |
| Refactor api.ts | Basse | ⚠️ En cours — 2859→2198 lignes, 6 modules extraits dans `api/` |
| Tests E2E | Basse | Playwright |

---

## Scope Audit UI/UX (P1)

### Objectifs

1. **Mobile-first** — Vérifier que toutes les pages sont optimisées pour mobile (>70% des utilisateurs)
2. **Responsive** — Tablette et desktop cohérents
3. **Ergonomie** — Actions principales accessibles, navigation intuitive
4. **Parcours utilisateur** — Fluidité des flows critiques

### Checklist par section

#### Navigation & Layout
- [ ] Bottom nav mobile : accessibilité, taille touch targets (min 44px)
- [ ] Header : titre contextuel, actions visibles
- [ ] Transitions entre pages : animations fluides
- [ ] Safe areas iOS (notch, home indicator)

#### Authentification
- [ ] Login : centrage, accessibilité clavier
- [ ] Messages d'erreur clairs
- [ ] Loading states

#### Dashboard Nageur
- [ ] Cartes séances : lisibilité, hiérarchie info
- [ ] Scroll horizontal vs vertical
- [ ] Empty states

#### Séances Natation
- [ ] Liste exercices : densité info mobile
- [ ] Mode exécution : focus, lisibilité
- [ ] Saisie ressenti : UX mobile (clavier numérique)

#### Musculation
- [ ] Liste séances : cards vs list
- [ ] Reader mode : scroll, lisibilité GIF
- [ ] WorkoutRunner : navigation exercices, saisie rapide
- [ ] Timer repos : visibilité, contrôles

#### Records & Hall of Fame
- [ ] Toggle 25/50m : feedback visuel
- [ ] Tableau records : scroll horizontal mobile
- [ ] Import FFN : feedback loading/success

#### Messagerie
- [ ] Liste threads : badges, preview
- [ ] Conversation : bulles, scroll bottom
- [ ] Saisie message : clavier mobile

#### Admin & Coach
- [ ] Tables : responsive ou cards mobile
- [ ] Formulaires : labels, validation
- [ ] Actions bulk : sélection multiple

### Outils d'audit

```bash
# Lighthouse audit
npm run build && npx lighthouse http://localhost:4173 --view

# Responsive testing
# Chrome DevTools → Device Toolbar
# Breakpoints: 375px (mobile), 768px (tablet), 1024px (desktop)
```

### Critères de succès

| Métrique | Cible |
|----------|-------|
| Lighthouse Performance | >80 |
| Lighthouse Accessibility | >90 |
| Touch target size | ≥44px |
| Text contrast ratio | ≥4.5:1 |
| First Contentful Paint | <2s |

---

## 2025-09-27 — Initialisation suivi

**Branche** : `work`

- Création du fichier implementation-log.md
- Snapshot audit README

---

## Workflow de vérification

À chaque itération :

```bash
# Vérifier la branche
git rev-parse --abbrev-ref HEAD

# Vérifier les commits non poussés
git log --oneline --decorate -n 5

# Vérifier l'état
git status -sb

# Build
npm run build
```

---

## 2026-02-07 — Refactor: extract strength transformers to api/transformers.ts

**Branche** : `claude/cloudflare-supabase-migration-WmS71`
**Chantier ROADMAP** : §5 — Dette technique (refactoring api.ts)

### Contexte

Poursuite du refactoring de `api.ts` (2353 → <2200 lignes). Extraction des patterns dupliqués dans les fonctions strength (createStrengthSession, updateStrengthSession, startStrengthRun, logStrengthSet, updateStrengthRun, saveStrengthRun) vers un module `transformers.ts` dédié.

### Changements réalisés

- Créé `src/lib/api/transformers.ts` (187 lignes) avec 8 fonctions de transformation :
  - `prepareStrengthItemsPayload` — normalise et valide les items d'une session
  - `mapItemsForDbInsert` — convertit les items en format DB avec session_id
  - `createLocalStrengthRun` — crée un objet run pour localStorage
  - `createSetLogDbPayload` — crée le payload DB d'un set log
  - `mapLogsForDbInsert` — transforme les logs en bulk pour insertion DB
  - `buildRunUpdatePayload` — construit le payload de mise à jour d'un run
  - `collectEstimated1RMs` — calcule les meilleurs 1RM estimés depuis des logs
  - `enrichItemsWithExerciseNames` — enrichit les items avec noms d'exercices
- Mis à jour `api/index.ts` pour exporter toutes les fonctions de transformers
- Refactoré 6 fonctions de `api.ts` pour utiliser les transformers
- Supprimé `strengthRunStart` (code mort, jamais appelé)
- Supprimé imports inutilisés (`validateStrengthItems`, `normalizeExerciseType`, `safeOptionalNumber`)

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/lib/api/transformers.ts` | Créé (187 lignes) |
| `src/lib/api/index.ts` | Ajout exports transformers |
| `src/lib/api.ts` | Refactored (2353 → 2198 lignes, -155 lignes, -6.6%) |

### Tests

- [x] `npm run build` — OK
- [x] `npx tsc --noEmit` — erreurs pré-existantes uniquement (pas de régression)

### Décisions prises

- Extraction des patterns purement fonctionnels (pas de dépendance à `this`) vers transformers
- Conservation des patterns nécessitant `this._get`/`this._save` dans api.ts mais utilisation de `enrichItemsWithExerciseNames` avec le résultat de `this._get()` passé en paramètre
- Suppression de `strengthRunStart` (dead code, remplacé par `startStrengthRun` utilisé dans Strength.tsx)

### Limites / dette

- `api.ts` reste à 2198 lignes — d'autres extractions possibles (swim catalog, records, notifications)
- Le pattern `maybeUpdateOneRm` dans `logStrengthSet` dépend de `this` et n'a pas été extrait
- Les erreurs TypeScript pré-existantes dans Coach.tsx, Progress.tsx, Strength.tsx ne sont pas traitées

---

## Commits récents

```
88b69e7 Refactor: extract strength transformers to api/transformers.ts
f2dbda1 Remove duplicate delay function from api.ts
f953073 Merge main: E2E tests, UI/UX audit, migrations
3f6c7f2 Refactor: extract client utilities to api/client.ts
8f556a6 Refactor: extract API types to dedicated module
1c3cedf Optimize performance: code splitting and lazy loading
087e9a6 Optimize GIF display and loading
de0063c Fix FFN sync pool_length parsing
b73611e Redesign strength exercise list for mobile-first UX
840e36c Fix useMemo not returning filtered records
1aa0e99 Update Cloudflare references to Supabase
```

## 2026-02-10 — 5 améliorations module musculation
**Branche** : `claude/continue-implementation-ajI8U`
**Commit** : `33f66c7`

### Contexte
Remontées utilisateur sur le module musculation : bouton d'enregistrement bloqué, manque de retour visuel fin de récup, upload GIF impossible, saisie clavier peu fluide, besoin de notes personnelles par exercice.

### Changements réalisés

1. **Fix bouton "Enregistrement..." bloqué** — Le bouton utilisait `updateRun.isPending` partagé entre `onProgress` et `onFinish`. Remplacé par un état local `isFinishing` dédié + ajout `onError` pour le retry.

2. **Toast "Temps de récupération terminé"** — Ajout d'un toast à la fin du timer de repos + correction bug secondaire où le handler visibilitychange ne fermait pas l'overlay repos.

3. **Upload GIF exercices** — Bouton Upload ajouté à côté de l'input URL dans les dialogues création/édition du catalogue coach. Stockage via Supabase Storage (bucket `exercise-gifs`). Limite 10 Mo. Aperçu image dans le formulaire.

4. **Saisie numpad : écrasement valeur pré-remplie** — État `shouldReplace` : la première frappe remplace la valeur pré-remplie au lieu de l'ajouter à la suite.

5. **Notes privées par exercice** — Colonne `notes` ajoutée à `one_rm_records`. Éditable depuis le mode focus (icône StickyNote + Sheet en bas) et sauvegardée via `updateExerciseNote` (try update, fallback insert).

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/pages/Strength.tsx` | isFinishing state, exerciseNotes memo, updateNote mutation, props WorkoutRunner |
| `src/components/strength/WorkoutRunner.tsx` | toast repos, shouldReplace numpad, noteSheet + props exerciseNotes/onUpdateNote |
| `src/pages/coach/StrengthCatalog.tsx` | handleGifUpload + Upload button (edit + create dialogs) |
| `src/lib/api/strength.ts` | get1RM notes, update1RM notes, new updateExerciseNote |
| `src/lib/api/index.ts` | Re-export updateExerciseNote |
| `src/lib/api.ts` | Facade stub updateExerciseNote |
| `src/lib/types.ts` | OneRmEntry.notes |
| `src/lib/schema.ts` | oneRmRecords.notes |
| `supabase/migrations/00012_exercise_notes_and_storage.sql` | ALTER TABLE notes + storage bucket |

### Validation
- `npx tsc --noEmit` → 0 erreur
- `npm run build` → OK
- `npm test` → 63 pass, 2 pre-existing failures

---

## 2026-02-12 — Reprendre button fix + Records 1RM enhancements

### Contexte
Trois bugs/demandes remontés par l'utilisateur :
1. Le bouton "Reprendre" est toujours grisé sur les séances interrompues démarrées sans assignment
2. Le bouton "Info 1RM" doit naviguer vers la page Records onglet 1RM
3. Sur la page Records (onglet 1RM), ajouter une table des pourcentages et l'édition des notes

### Changements

1. **Fix bouton Reprendre** — Quand une séance est démarrée directement (sans assignment), `assignment_id` est null. Le code cherchait uniquement dans `activeStrengthAssignments`. Ajout d'un fallback vers `strengthCatalog` pour retrouver la session par `session_id`.

2. **Navigation Info 1RM** — Le bouton "Info 1RM" sur la page Strength navigue maintenant vers `#/records?tab=1rm` au lieu d'afficher un toast.

3. **Lecture du query param** — `Records.tsx` lit `?tab=1rm` depuis le hash URL pour initialiser l'onglet Musculation.

4. **Table des pourcentages** — Chaque exercice avec un 1RM > 0 affiche un bouton "%" qui déploie une table compacte (50/60/70/80/90% du 1RM, arrondi à 0.1 kg).

5. **Édition des notes** — Icône StickyNote à côté de chaque nom d'exercice dans l'onglet 1RM. Clic ouvre un textarea inline avec sauvegarde via `updateExerciseNote`. Notes existantes affichées en italique sous le nom.

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/pages/Strength.tsx` | inProgressSession fallback, canResumeInProgress update, Info 1RM navigation |
| `src/pages/Records.tsx` | Tab query param, expandedExerciseId, percentage table, note editing (StickyNote + textarea) |

### Validation
- `npx tsc --noEmit` → 0 erreur
- `npm run build` → OK
- `npm test` → 63 pass, 2 pre-existing failures

---

## 2026-02-12 — Fix performances manquantes + refonte UI RecordsClub + classements

**Branche** : `claude/continue-implementation-ajI8U`
**Chantier ROADMAP** : §4 — Records club (corrections + améliorations)

### Contexte

Trois problèmes identifiés sur les records du club :
1. **Performances manquantes** : Le parser FFN (`ffn-parser.ts`) avait une regex `/épreuve|nage/i` qui filtrait les événements contenant "nage" (ex: "50 Nage Libre", "100 Nage Libre"), les confondant avec des en-têtes de tableau.
2. **Doublons dans club_performances** : `recalculateClubRecords()` ne nettoyait pas les anciennes données avant réinsertion, accumulant des doublons à chaque recalcul.
3. **Pas de classement** : Seul le meilleur temps global par épreuve/bassin/sexe/âge était stocké, pas les temps par nageur.
4. **UI verbeux** : L'interface en cartes avec dropdowns prenait trop de place et n'offrait pas de vue tabulaire compacte.

### Changements réalisés

1. **Fix parser FFN** (`ffn-parser.ts:53`) — Changé `/épreuve|nage/i` en `/^[ée]preuve$/i || /^nage$/i` pour ne matcher que les en-têtes exacts et pas les noms d'épreuves contenant "Nage Libre".

2. **Refonte recalculateClubRecords** (`import-club-records/index.ts`) :
   - DELETE de toutes les `club_performances` avant réinsertion (anti-doublons)
   - Stockage de la meilleure performance PAR NAGEUR par épreuve/bassin/sexe/âge (pour classements)
   - Insertion en batch de 100 lignes
   - Calcul du best absolu dans un second passage pour `club_records`
   - Ajout de `swimmer_iuf` dans les données `club_performances`

3. **Migration 00015** — Ajout colonne `swimmer_iuf` sur `club_performances` + index ranking.

4. **API ranking** (`records.ts`) — Nouvelle fonction `getClubRanking()` qui requête `club_performances` triées par temps pour un événement/bassin/sexe/âge donné. Nouveau type `ClubPerformanceRanked`.

5. **Refonte UI RecordsClub** — Réécriture complète :
   - Toggles bassin (25m/50m) et sexe (G/F) compacts
   - Âge en pills (Tous, 8-, 9, 10, ..., 17+)
   - Tabs nage compacts
   - Table propre : Épreuve | Temps | Détenteur | Âge | Date | chevron
   - Mode "Tous âges" : groupé par épreuve avec sous-tables par âge
   - Mode "âge sélectionné" : table plate
   - **Clic sur une ligne → déploie le classement** complet pour cette épreuve/bassin/sexe/âge avec Trophy icône pour le #1

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `supabase/functions/_shared/ffn-parser.ts` | Fix regex header filter |
| `supabase/functions/import-club-records/index.ts` | Refonte recalculateClubRecords() |
| `supabase/migrations/00015_club_performances_ranking.sql` | Nouveau : swimmer_iuf + index |
| `src/lib/api/types.ts` | Nouveau type ClubPerformanceRanked |
| `src/lib/api/records.ts` | Nouvelle fonction getClubRanking() |
| `src/lib/api/index.ts` | Export getClubRanking |
| `src/lib/api.ts` | Delegation stub + type re-export |
| `src/pages/RecordsClub.tsx` | Réécriture complète UI |

### Validation
- `npx tsc --noEmit` → 0 erreur
- `npm run build` → OK (15s)
- `npm test` → 63 pass, 2 pre-existing failures

---

## 2026-02-12 — Fix assignments, notifications RLS, FFN import errors

**Branche** : `claude/continue-implementation-ajI8U`

### Contexte

Trois bugs signalés :
1. **Assignations coach invisibles** : Les séances assignées par le coach n'apparaissent jamais dans le calendrier du Dashboard nageur.
2. **Messagerie coach→nageur** : Les messages envoyés aux groupes ne sont pas visibles par les nageurs.
3. **Import FFN** : L'erreur "Edge Function returned a non-2xx status code" ne donne aucun détail utile.

### Changements réalisés

1. **Fix `assignmentIso` regex** (`Dashboard.tsx:204`) — La regex `/\\d{4}-\\d{2}-\\d{2}/` utilisait des double backslashes, ce qui match littéralement `\d` au lieu de digits. La fonction retournait TOUJOURS null, empêchant toute assignation d'apparaître sur le calendrier. Corrigé en `/\d{4}-\d{2}-\d{2}/`.

2. **Fix notification_targets RLS** (migration 00016) — La politique SELECT de `notification_targets` ne vérifiait que `target_user_id = app_user_id()`. Les notifications ciblant un GROUPE (target_group_id set, target_user_id NULL) étaient invisibles pour les nageurs du groupe. Ajout de `OR target_group_id IN (SELECT group_id FROM group_members WHERE user_id = app_user_id())` sur les politiques SELECT et UPDATE.

3. **FFN import error surfacing** (`records.ts`) — Les fonctions `importSingleSwimmer`, `importSwimmerPerformances`, `importClubRecords`, `recalculateClubRecords` affichent maintenant le message d'erreur réel retourné par l'Edge Function (`data?.error`) au lieu du générique "Edge Function returned a non-2xx status code".

### Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/pages/Dashboard.tsx` | Fix regex assignmentIso (\\\\d → \\d) |
| `supabase/migrations/00016_fix_notifications_rls.sql` | Nouveau : RLS group membership pour notification_targets |
| `src/lib/api/records.ts` | Error surfacing pour 4 fonctions edge function |

### Validation
- `npx tsc --noEmit` → 0 erreur
- `npm run build` → OK
- `npm test` → 63 pass, 2 pre-existing failures

### Note
- L'erreur FFN "non-2xx" était masquée — après ce fix le message réel sera visible (rate limit, FFN down, etc.)
- Les Edge Functions doivent être redéployées via `supabase functions deploy` pour que les corrections de `ffn-parser.ts` (regex "Nage Libre") prennent effet côté serveur

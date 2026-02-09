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

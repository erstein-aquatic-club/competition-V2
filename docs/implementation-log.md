# Journal d'implémentation

Ce document trace l'avancement des tâches et migrations.

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

---

## Plan d'implémentation

### P0 — Critique (FAIT ✅)

- [x] Fix toggle 25/50m records
- [x] Fix bouton "Lancer la séance"
- [x] Fix FFN sync pool_length (doublons bassin)

### P1 — Haute priorité (EN COURS)

| Tâche | Effort | Status | Description |
|-------|--------|--------|-------------|
| ~~Audit UI/UX~~ | 4-6h | ✅ | Merged via parallel instance |
| Activer `coachStrength` | 2h | 📋 | Décommenter flag + tests |
| GIF exercices manquants | 1h | ✅ | 10/13 URLs ajoutées (migration 00007) |

### P2 — Moyenne priorité

| Tâche | Effort | Status | Description |
|-------|--------|--------|-------------|
| ~~Tests E2E critiques~~ | 4h | ✅ | Merged via parallel instance |
| ~~Optimisation performances~~ | 3h | ✅ | Lazy loading, code splitting, cache |
| Refactor api.ts | 8h | 🔧 | Step 2: api.ts 2859→2459 lines (-14%). Next: extract swim/strength |

### P3 — Basse priorité

| Tâche | Effort | Status | Description |
|-------|--------|--------|-------------|
| Typage strict | 4h | 🔧 | Instance 3 en cours (85 `any` restants dans api.ts) |
| Documentation API | 2h | 📋 | Endpoints Supabase |
| PWA améliorée | 4h | 📋 | Offline mode, sync |

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

## Commits récents

```
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

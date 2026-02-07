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
| §1 Refonte inscription | ❌ A faire | — |
| §2 Import performances FFN | ❌ A faire | — |
| §3 Gestion coach imports | ❌ A faire | — |
| §4 Records club | ❌ A faire | — |
| §5 Dette UI/UX | ⚠️ En cours | 2026-02-07 (audit 78%) |

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
| Refactor api.ts | Basse | Découper en modules |
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

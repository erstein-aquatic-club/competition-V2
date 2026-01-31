# Audit Complet du Projet — Suivi Natation V2

**Date :** 30 janvier 2026
**Projet :** Suivi Natation (V2) — Erstein Aquatic Club
**Stack :** React 19 + TypeScript + Vite 7 + Cloudflare Workers + D1 (SQLite)

---

## Table des Matières

1. [Synthèse Exécutive](#1-synthèse-exécutive)
2. [Points Forts](#2-points-forts)
3. [Faiblesses Identifiées](#3-faiblesses-identifiées)
4. [Risques](#4-risques)
5. [Patchs Recommandés (Urgents)](#5-patchs-recommandés-urgents)
6. [Roadmap d'Optimisations](#6-roadmap-doptimisations)
7. [Plan de Finalisation de l'App](#7-plan-de-finalisation-de-lapp)

---

## 1. Synthèse Exécutive

Le projet est une application monorepo bien structurée pour le suivi d'entraînement en natation et musculation d'un club aquatique. L'architecture est saine : frontend React (SPA) déployé sur GitHub Pages, backend Cloudflare Worker avec base D1 (SQLite), et intégration FFN.

**Score global : B+ (82/100)**

| Critère | Note | Commentaire |
|---------|------|-------------|
| Architecture | A | Séparation claire client/server/worker/shared |
| Qualité du code | B+ | TypeScript strict, bon state management |
| Sécurité | C+ | Secrets en clair dans wrangler.toml, tokens en localStorage |
| Performance | B | Bonne mémoisation, manque virtualisation listes |
| Tests | C | 5.5% de couverture (27 fichiers test / ~1046 lignes) |
| Accessibilité | B | 74+ attributs ARIA, quelques lacunes clavier |
| Documentation | A- | README complet, schéma DB documenté |
| CI/CD | B+ | GitHub Actions fonctionnel, manque staging |
| UX/Mobile | A- | PWA, safe areas, focus mode, responsive |

---

## 2. Points Forts

### 2.1 Architecture Solide
- **Monorepo bien organisé** : `client/`, `server/`, `shared/`, `cloudflare-worker/`, `docs/`
- **Séparation claire** entre les couches : UI, logique métier (`lib/`), API, stockage
- **Hash-based routing** (Wouter) parfait pour le déploiement sur GitHub Pages (pas besoin de config serveur)
- **Double backend** : Express (dev local) + Cloudflare Worker (production edge)

### 2.2 State Management Exemplaire
- **Zustand** pour l'état local (auth, contexte coach) — léger, performant
- **React Query** pour l'état serveur — cache, invalidation, stale time bien configurés
- Aucun prop drilling, bonne utilisation du store `useAuth()`

### 2.3 Qualité TypeScript
- `strict: true` activé dans `tsconfig.json`
- Schémas Zod pour la validation des données à l'entrée/sortie
- React Hook Form + Zod pour validation des formulaires côté client
- Path aliases (`@/`, `@shared/`) pour des imports propres

### 2.4 UI/UX Riche
- **55 composants Shadcn UI** (Radix UI underneath) — cohérence visuelle
- **Framer Motion** pour les animations
- **Recharts** pour les graphiques de progression
- **Focus mode** pour les entraînements de musculation (masque dock, plein écran)
- PWA installable avec safe area handling

### 2.5 Sécurité Crypto du Worker
- PBKDF2 avec 100 000 itérations pour le hashing des mots de passe
- `timingSafeEqual` pour la comparaison des tokens (anti timing attack)
- JWT avec access token (15 min) + refresh token (30 jours)
- Rate limiting sur les tentatives de login

### 2.6 Zéro Dette Technique Marquée
- **0 TODO / 0 FIXME / 0 HACK** dans le code
- Code clean et cohérent dans le style

### 2.7 Feature Flags
- Système de feature flags (`features.ts`) permettant le rollout progressif
- Actuellement : `strength: true`, `hallOfFame: true`, `coachStrength: false`

---

## 3. Faiblesses Identifiées

### 3.1 CRITIQUE — Secrets en Clair
**Fichier :** `cloudflare-worker/wrangler.toml:6-7`
```toml
[vars]
AUTH_SECRET = "ersteinaquaticclub2026"
SHARED_TOKEN = "ersteinaquaticclub2026"
```
- Les secrets d'authentification JWT et le token API partagé sont versionnés en clair dans Git
- **Impact :** Toute personne ayant accès au repo peut forger des JWT et accéder à l'API
- Le même mot de passe est utilisé pour les deux secrets

### 3.2 HAUTE — Couverture de Tests Insuffisante
- **5.5%** de couverture (1 046 lignes de tests / 18 870 lignes de code métier)
- Standard industriel : 10-15% minimum, idéalement 60-80%
- **Aucun test end-to-end** (Playwright, Cypress)
- **Aucun test d'intégration** backend
- Les routes Express sont un stub vide (`server/routes.ts`)

### 3.3 HAUTE — Fichier api.ts Monolithique
- **3 329 lignes** dans un seul fichier (`client/src/lib/api.ts`)
- Mélange auth, sessions natation, musculation, utilisateurs, notifications, records
- Difficulté de maintenance, revue de code, et de test unitaire

### 3.4 MOYENNE — 92 Usages de `any`
- 92 instances de `any` type à travers le codebase
- Principalement dans `api.ts` pour les payloads
- Réduit la fiabilité du type checking et masque des bugs potentiels

### 3.5 MOYENNE — Tokens en localStorage
- Access token, refresh token et données utilisateur stockés en `localStorage`
- Vulnérable aux attaques XSS (un script malveillant peut lire les tokens)
- Pas de protection `HttpOnly` (impossible côté client)
- Clés : `swim_access_token`, `swim_refresh_token`, `swimmer_user`, `swimmer_user_id`, `swimmer_user_role`

### 3.6 MOYENNE — Configuration par Query String
**Fichier :** `client/src/lib/config.ts`
- L'endpoint de synchronisation peut être défini via `?swimSyncEndpoint=...`
- Risque de phishing : un lien malveillant pourrait rediriger les requêtes API vers un serveur tiers
- Le token peut aussi être injecté par query string

### 3.7 BASSE — Server Express Non Implémenté
- `server/routes.ts` est un stub vide
- `server/storage.ts` utilise un `MemStorage` en mémoire (données perdues au redémarrage)
- Le `shared/schema.ts` ne contient qu'une table `users` minimale (18 lignes)
- L'ORM Drizzle (PostgreSQL) n'est pas utilisé en production

### 3.8 BASSE — Duplication de Logique Auth
- Logique de login dupliquée entre `Login.tsx` et `authRequests.ts`
- Patterns de lecture localStorage répétés (8 instances similaires)

---

## 4. Risques

### 4.1 Risques de Sécurité

| Risque | Sévérité | Probabilité | Impact |
|--------|----------|-------------|--------|
| Secrets JWT en clair dans Git | CRITIQUE | Certaine | Compromission complète de l'API |
| Tokens localStorage + XSS | HAUTE | Moyenne | Vol de sessions utilisateurs |
| Endpoint configurable par URL | MOYENNE | Faible | Phishing ciblé |
| Même secret pour AUTH et SHARED_TOKEN | HAUTE | Certaine | Surface d'attaque réduite mais critique |

### 4.2 Risques Techniques

| Risque | Sévérité | Probabilité | Impact |
|--------|----------|-------------|--------|
| Régression sans tests E2E | HAUTE | Haute | Bugs en production non détectés |
| api.ts monolithique non maintenable | MOYENNE | Moyenne | Ralentissement du développement |
| Worker index.js (156 KB) monolithique | MOYENNE | Moyenne | Bugs difficiles à isoler |
| Pas de monitoring/observabilité | MOYENNE | Moyenne | Incidents non détectés |
| Pas d'environnement staging | MOYENNE | Haute | Déploiements risqués |

### 4.3 Risques Business

| Risque | Sévérité | Probabilité | Impact |
|--------|----------|-------------|--------|
| Données perdues (pas de backup D1) | HAUTE | Faible | Perte de données irréversible |
| Feature `coachStrength: false` inachevée | BASSE | Certaine | Fonctionnalité manquante pour les coachs |
| Scalabilité D1 SQLite | BASSE | Faible | Limites si le club grandit fortement |

---

## 5. Patchs Recommandés (Urgents)

### Patch 1 — Sécuriser les Secrets (CRITIQUE)

**Problème :** Secrets en clair dans `wrangler.toml`, versionnés dans Git.

**Implémentation :**

1. Supprimer les secrets du fichier `wrangler.toml` :
```toml
# wrangler.toml — NE PLUS METTRE DE SECRETS ICI
name = "suivi-natation-api"
main = "src/index.js"
compatibility_date = "2024-12-01"

# Secrets gérés via `wrangler secret put`
# AUTH_SECRET → wrangler secret put AUTH_SECRET
# SHARED_TOKEN → wrangler secret put SHARED_TOKEN

[triggers]
crons = ["0 6 * * *"]

[[d1_databases]]
binding = "DB"
database_name = "suivi-natation"
database_id = "606242a3-813e-4fc8-ab4e-b79b19b2cf9c"
```

2. Configurer les secrets via Wrangler CLI :
```bash
cd cloudflare-worker
wrangler secret put AUTH_SECRET
# Entrer un nouveau secret fort (min 32 caractères, aléatoire)
wrangler secret put SHARED_TOKEN
# Entrer un token différent du AUTH_SECRET
```

3. Ajouter `wrangler.toml` dans `.gitignore` ou créer un `wrangler.toml.example` sans secrets.

4. **Régénérer tous les secrets** car les anciens sont compromis (visibles dans l'historique Git).

---

### Patch 2 — Supprimer la Configuration par Query String (MOYENNE)

**Problème :** `config.ts` accepte l'endpoint et le token par query string, ouvrant la porte au phishing.

**Implémentation :** Retirer la lecture depuis les query params en production :

```typescript
// client/src/lib/config.ts — Version sécurisée
const isDev = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.DEV;

const endpoint =
  (isDev ? readQueryValue("swimSyncEndpoint") : "") ||
  readEnvValue("VITE_SWIM_SYNC_ENDPOINT") ||
  readWindowValue("SWIM_SYNC_ENDPOINT") ||
  readStorageValue("SWIM_SYNC_ENDPOINT") ||
  defaultEndpoint;

const token =
  (isDev ? readQueryValue("swimSyncToken") : "") ||
  readEnvValue("VITE_SWIM_SYNC_TOKEN") ||
  readWindowValue("SWIM_SYNC_TOKEN") ||
  readStorageValue("SWIM_SYNC_TOKEN");
```

---

### Patch 3 — Rotation des Secrets Compromis (CRITIQUE)

Puisque les secrets sont dans l'historique Git :

1. Générer de nouveaux secrets aléatoires (32+ chars)
2. Les déployer via `wrangler secret put`
3. Invalider tous les JWT existants (forcer la reconnexion)
4. Changer le `SHARED_TOKEN` côté GitHub Actions aussi (`SWIM_SYNC_TOKEN`)

---

## 6. Roadmap d'Optimisations

### Phase 1 — Sécurité & Stabilité (Semaines 1-2)

| # | Tâche | Priorité | Effort |
|---|-------|----------|--------|
| 1.1 | Patcher les secrets (Patch 1 + 3) | CRITIQUE | Faible |
| 1.2 | Sécuriser config.ts (Patch 2) | MOYENNE | Faible |
| 1.3 | Ajouter CSP headers au Worker | MOYENNE | Faible |
| 1.4 | Implémenter CORS strict sur le Worker | MOYENNE | Faible |
| 1.5 | Auditer les permissions RBAC (authRules.ts) | MOYENNE | Moyen |

### Phase 2 — Qualité & Tests (Semaines 3-5)

| # | Tâche | Priorité | Effort |
|---|-------|----------|--------|
| 2.1 | Ajouter Playwright pour tests E2E (login, dashboard, coach flow) | HAUTE | Élevé |
| 2.2 | Augmenter couverture unit tests à 15% | HAUTE | Moyen |
| 2.3 | Tester les endpoints du Worker (integration tests) | HAUTE | Moyen |
| 2.4 | Remplacer les 92 `any` par `unknown` + type guards | MOYENNE | Moyen |
| 2.5 | Ajouter un linter strict (eslint flat config) | BASSE | Faible |

### Phase 3 — Refactoring (Semaines 5-7)

| # | Tâche | Priorité | Effort |
|---|-------|----------|--------|
| 3.1 | Découper `api.ts` (3329 lignes) en modules | HAUTE | Moyen |
|     | → `api/auth.ts`, `api/swim.ts`, `api/strength.ts`, `api/users.ts`, `api/notifications.ts`, `api/records.ts` | | |
| 3.2 | Découper `cloudflare-worker/src/index.js` (156 KB) en modules | HAUTE | Élevé |
|     | → `handlers/auth.js`, `handlers/swim.js`, `handlers/strength.js`, `handlers/users.js`, etc. | | |
| 3.3 | Créer un `StorageManager` pour centraliser les accès localStorage | BASSE | Faible |
| 3.4 | Consolider la logique auth dupliquée (Login.tsx + authRequests.ts) | BASSE | Faible |

### Phase 4 — Performance (Semaines 7-8)

| # | Tâche | Priorité | Effort |
|---|-------|----------|--------|
| 4.1 | Virtualiser les longues listes (Dashboard 70+ items, Records) avec `@tanstack/virtual` | MOYENNE | Moyen |
| 4.2 | Code splitting des routes (React.lazy + Suspense) | MOYENNE | Faible |
| 4.3 | Optimiser le bundle (tree-shaking, analyser avec `vite-bundle-visualizer`) | BASSE | Faible |
| 4.4 | Ajouter un Service Worker pour le cache offline | BASSE | Moyen |
| 4.5 | Implémenter le préchargement des données (prefetchQuery) | BASSE | Faible |

### Phase 5 — Fonctionnalités Manquantes (Semaines 8-12)

| # | Tâche | Priorité | Effort |
|---|-------|----------|--------|
| 5.1 | Activer `coachStrength: true` — Gestion musculation côté coach | HAUTE | Élevé |
| 5.2 | Implémenter le backup automatique D1 (scheduled Worker) | HAUTE | Moyen |
| 5.3 | Ajouter un environnement staging (Worker preview + branche staging) | MOYENNE | Moyen |
| 5.4 | Notifications push (Web Push API) | MOYENNE | Élevé |
| 5.5 | Export PDF des rapports d'entraînement | BASSE | Moyen |
| 5.6 | Mode offline complet (sync quand reconnecté) | BASSE | Élevé |
| 5.7 | Dashboard analytics pour les admins | BASSE | Moyen |

---

## 7. Plan de Finalisation de l'App

### Étape 1 — Pré-requis de Production
- [ ] Secrets sécurisés (pas en clair dans Git)
- [ ] CORS configuré avec whitelist exacte
- [ ] CSP headers implémentés
- [ ] Rate limiting sur tous les endpoints (pas seulement login)
- [ ] Backup D1 automatisé

### Étape 2 — Stabilisation
- [ ] Tests E2E sur les parcours critiques (login → dashboard → session → progression)
- [ ] Test de charge basique sur le Worker
- [ ] Monitoring des erreurs (Sentry ou Cloudflare Analytics)
- [ ] Couverture de tests > 15%

### Étape 3 — Fonctionnalités Complètes
- [ ] Module coachStrength finalisé et activé
- [ ] Tous les feature flags à `true`
- [ ] Documentation utilisateur (guide d'utilisation)
- [ ] Onboarding flow pour les nouveaux utilisateurs

### Étape 4 — Polish & Déploiement Final
- [ ] Audit accessibilité (axe-core ou Lighthouse)
- [ ] Score Lighthouse > 90 sur les 4 métriques
- [ ] Optimisation bundle < 500 KB gzipped
- [ ] PWA manifest complet (icons, splash screens, shortcuts)
- [ ] Page de maintenance / status page
- [ ] Documentation technique finalisée

---

## Annexes

### A. Métriques Clés du Codebase

| Métrique | Valeur |
|----------|--------|
| Lignes de code métier (client) | ~18 870 |
| Lignes de tests | ~1 046 |
| Fichiers TypeScript (client) | 146 |
| Composants UI (Shadcn) | 55 |
| Pages/Routes | 30+ |
| Tables D1 | 25+ |
| Endpoints API (Worker) | 40+ |
| Dépendances (prod) | 152 |
| Dépendances (dev) | 16 |
| Usages de `any` | 92 |
| Usages de `memo/useMemo/useCallback` | 102 |
| Attributs ARIA | 74+ |
| Fichiers de tests | 27 |
| Migrations D1 | 7 |

### B. Stack Technologique Complète

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | React | 19.2.0 |
| Langage | TypeScript | 5.6.3 |
| Bundler | Vite | 7.1.9 |
| Styling | Tailwind CSS | 4.1.14 |
| UI Kit | Radix UI + Shadcn | latest |
| State (local) | Zustand | 5.0.9 |
| State (serveur) | React Query | 5.60.5 |
| Forms | React Hook Form | 7.66.0 |
| Validation | Zod | 3.25.76 |
| Routing | Wouter | 3.3.5 |
| Animation | Framer Motion | 12.23.24 |
| Charts | Recharts | 2.15.4 |
| Backend | Cloudflare Workers | Edge |
| Database | Cloudflare D1 | SQLite |
| Auth | JWT (custom) | PBKDF2 |
| Hosting | GitHub Pages | Actions |
| CI/CD | GitHub Actions | Node 20 |

### C. Fichiers Critiques à Surveiller

| Fichier | Lignes | Risque |
|---------|--------|--------|
| `client/src/lib/api.ts` | 3 329 | Monolithique, à découper |
| `cloudflare-worker/src/index.js` | ~156 KB | Monolithique, à découper |
| `cloudflare-worker/wrangler.toml` | 16 | Secrets exposés |
| `client/src/lib/config.ts` | 67 | Config injection par URL |
| `client/src/lib/auth.ts` | ~200 | Tokens en localStorage |

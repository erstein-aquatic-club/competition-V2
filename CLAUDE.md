# Claude Code Context — Suivi Natation V2

## Projet

Application web de suivi d'entraînement (natation + musculation) pour l'Erstein Aquatic Club.
4 rôles : nageur (athlete), coach, comité, admin.

## Stack

- **Frontend** : React 19, TypeScript, Vite 7, Tailwind CSS 4, Radix UI/Shadcn (55 composants), Zustand 5, React Query 5, Wouter (hash routing)
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions Deno)
- **Déploiement** : GitHub Pages (frontend), Supabase Cloud (backend)
- **Tests** : Vitest, 27 fichiers de tests

## Architecture

- SPA avec hash-based routing (`/#/path`) pour GitHub Pages
- Persistance hybride : Supabase primary, localStorage fallback offline
- Code splitting via React.lazy + Suspense
- Feature flags dans `src/lib/features.ts` (tous activés)

## Fichiers clés

| Fichier | Rôle | Taille |
|---------|------|--------|
| `src/lib/api.ts` | Façade API (stubs → modules) | ~426 lignes |
| `src/lib/api/types.ts` | Interfaces TypeScript | 281 lignes |
| `src/lib/api/client.ts` | Supabase client, utilitaires | 252 lignes |
| `src/lib/api/transformers.ts` | Fonctions de transformation strength | 187 lignes |
| `src/lib/api/helpers.ts` | Fonctions de mapping | 151 lignes |
| `src/lib/api/localStorage.ts` | Stockage local fallback | 85 lignes |
| `src/lib/api/index.ts` | Re-exports centralisés | ~174 lignes |
| `src/lib/api/strength.ts` | Exercices, sessions, runs, logs, 1RM | ~850 lignes |
| `src/lib/api/records.ts` | Hall of fame, records club, perfs | ~350 lignes |
| `src/lib/api/users.ts` | Profil, athlètes, approbation | ~250 lignes |
| `src/lib/api/assignments.ts` | Assignments CRUD | ~230 lignes |
| `src/lib/api/notifications.ts` | Notifications CRUD | ~210 lignes |
| `src/lib/api/timesheet.ts` | Pointage heures CRUD | ~180 lignes |
| `src/lib/api/swim.ts` | Catalogue nage, sessions | ~160 lignes |
| `src/lib/auth.ts` | Gestion auth, session, rôles | ~240 lignes |
| `src/lib/supabase.ts` | Client Supabase | ~70 lignes |
| `src/lib/features.ts` | Feature flags | 5 lignes |
| `src/lib/schema.ts` | Schéma Drizzle (tables) | |
| `src/pages/Dashboard.tsx` | Dashboard nageur (calendrier, ressenti) | ~1680 lignes |
| `src/pages/Strength.tsx` | Module musculation nageur | ~1340 lignes |
| `src/pages/coach/SwimCatalog.tsx` | Catalogue séances nage (coach) | ~1300 lignes |
| `src/pages/coach/StrengthCatalog.tsx` | Builder muscu (coach) | ~1150 lignes |
| `src/pages/Records.tsx` | Records personnels + FFN sync | ~920 lignes |
| `src/pages/RecordsClub.tsx` | Records club (UI prête, données vides) | ~240 lignes |
| `src/pages/RecordsAdmin.tsx` | Admin records + gestion nageurs | ~300 lignes |
| `src/pages/Login.tsx` | Login + inscription | ~340 lignes |

## Edge Functions Supabase

| Fonction | Statut | Chemin |
|----------|--------|--------|
| `ffn-sync` | Fonctionnelle | `supabase/functions/ffn-sync/` |
| `admin-user` | Fonctionnelle | `supabase/functions/admin-user/` |
| `ffn-performances` | Fonctionnelle | `supabase/functions/ffn-performances/` |
| `import-club-records` | Fonctionnelle | `supabase/functions/import-club-records/` |

## Documentation

Lire ces fichiers dans cet ordre pour reprendre le contexte :

1. **Ce fichier** (`CLAUDE.md`) — Vue d'ensemble rapide
2. **`docs/FEATURES_STATUS.md`** — Matrice complète des fonctionnalités (ce qui marche, ce qui manque)
3. **`docs/ROADMAP.md`** — Plan de développement futur (4 chantiers détaillés)
4. **`docs/implementation-log.md`** — Historique des implémentations
5. **`docs/patch-report.md`** — Audit UI/UX (items restants)
6. **`README.md`** — Stack, déploiement, structure

## Chantiers futurs (ROADMAP)

| # | Chantier | Priorité | Statut |
|---|----------|----------|--------|
| 1 | Refonte parcours d'inscription | Haute | Fait |
| 2 | Import toutes performances FFN | Haute | Fait |
| 3 | Gestion coach des imports | Moyenne | Fait |
| 4 | Records club alimentés | Moyenne | Fait |
| 5 | Dette technique UI/UX | Basse | Fait |
| 6 | Fix timers mode focus (PWA iOS background) | Haute | Fait |

Détail complet dans `docs/ROADMAP.md`.

## Workflow de documentation obligatoire

Chaque session de développement doit suivre ce protocole (détail complet dans `docs/ROADMAP.md` § "Règles de documentation") :

1. **Avant** : Lire `CLAUDE.md` → `docs/ROADMAP.md` (chantier ciblé) → `docs/FEATURES_STATUS.md`
2. **Pendant** : Ajouter une entrée dans `docs/implementation-log.md` pour chaque patch (contexte, changements, fichiers modifiés, tests, décisions, limites)
3. **Après** : Mettre à jour les 4 fichiers de suivi :
   - `docs/ROADMAP.md` — statut du chantier (A faire → En cours → Fait)
   - `docs/FEATURES_STATUS.md` — statut des features impactées (❌ → ⚠️ → ✅)
   - `docs/implementation-log.md` — entrée déjà ajoutée au §2
   - `CLAUDE.md` — si fichiers clés ajoutés/supprimés ou chantier terminé

> **Règle d'or : aucun patch sans entrée dans `implementation-log.md`.**

## Cache bust (déploiement)

L'application est servie sur GitHub Pages avec les meta tags `apple-mobile-web-app-capable`. Les navigateurs (surtout Safari iOS) cachent agressivement `index.html`.

**Mécanisme en place :**
- `index.html` contient les meta tags `Cache-Control: no-cache, no-store, must-revalidate`
- `vite.config.ts` injecte `__BUILD_TIMESTAMP__` automatiquement à chaque build (visible dans la console navigateur)
- Les assets JS/CSS ont des content hashes automatiques (Vite default)

**Règle obligatoire** : À chaque patch/déploiement, vérifier que :
1. Le build timestamp est bien injecté (vérifier dans la console : `[EAC] Build: <date>`)
2. Si un changement ne se reflète pas après déploiement, demander aux utilisateurs de vider le cache ou faire un hard refresh (Ctrl+Shift+R)
3. Ne jamais ajouter de service worker sans mécanisme de mise à jour automatique (risque de cache permanent)

## Points d'attention

- `api.ts` a été refactoré de ~2277 à ~426 lignes — 7 modules extraits dans `src/lib/api/` (strength, records, users, assignments, notifications, timesheet, swim)
- Le routing est hash-based (`useHashLocation` de Wouter) — les URLs sont `/#/path`
- L'inscription utilise `supabase.auth.signUp()` avec metadata (name, birthdate, group_id)
- Un trigger PostgreSQL (`handle_new_auth_user`) crée automatiquement les entrées `users`, `user_profiles`, `group_members` à l'inscription
- Les migrations sont dans `supabase/migrations/`
- Le fallback localStorage est activé quand Supabase n'est pas disponible

## Commandes

```bash
npm install          # Installation
npm run dev          # Dev server (localhost:8080)
npm run build        # Build production
npm test             # Tests Vitest
npx tsc --noEmit     # Type check
```

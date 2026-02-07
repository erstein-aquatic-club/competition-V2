# Roadmap de Développement

*Dernière mise à jour : 2026-02-07*

Ce document décrit les fonctionnalités à implémenter. Il sert de référence pour reprendre le développement dans une future conversation.

---

## Vue d'ensemble

| # | Chantier | Priorité | Complexité | Statut |
|---|----------|----------|------------|--------|
| 1 | Refonte parcours d'inscription | Haute | Moyenne | A faire |
| 2 | Import de toutes les performances FFN d'un nageur | Haute | Haute | A faire |
| 3 | Gestion coach des imports de performances | Moyenne | Moyenne | A faire |
| 4 | Records club par catégorie d'âge / sexe / nage | Moyenne | Faible | A faire |
| 5 | Dette technique UI/UX restante (patch-report) | Basse | Faible | En cours |

---

## 1. Refonte du parcours d'inscription

### Problème actuel

Après inscription (`Login.tsx:226-254`), si Supabase exige la confirmation email :
- L'utilisateur voit un message d'erreur rouge dans le dialogue : *"Compte créé. Vérifiez votre email pour confirmer votre inscription."*
- **Pas d'écran de confirmation dédié** — juste un message d'erreur dans le formulaire
- **Pas de handler pour le lien de confirmation email** — aucune route `/auth/callback`
- **Le lien email ne fonctionne pas** (redirige vers une URL non gérée par l'app)
- L'utilisateur ne comprend pas quoi faire après avoir validé ses informations

### Objectif

Guider clairement l'utilisateur après l'inscription, avec un parcours fluide et compréhensible.

### Implémentation proposée

#### Option A : Garder la confirmation email (recommandé si on veut valider les emails)

1. **Écran de confirmation post-inscription** (`src/pages/ConfirmEmail.tsx` ou composant dans Login.tsx)
   - Fermer le dialogue d'inscription
   - Afficher un écran dédié avec :
     - Icône de succès (check ou email)
     - Message clair : "Votre compte a été créé avec succès !"
     - Instructions étape par étape : "1. Vérifiez votre boîte mail. 2. Cliquez sur le lien de confirmation. 3. Revenez sur cette page pour vous connecter."
     - Bouton "Renvoyer l'email" (appel `supabase.auth.resend()`)
     - Bouton "Retour à la connexion"

2. **Route de callback email** (`src/pages/AuthCallback.tsx` ou gestion dans `App.tsx`)
   - Intercepter le hash fragment Supabase (`#access_token=...&type=signup`)
   - Appeler `supabase.auth.getSession()` pour valider le token
   - Si succès : login automatique + redirect vers le dashboard
   - Si échec : message d'erreur + lien vers login

3. **Gestion dans App.tsx**
   - Ajouter la détection du callback dans le routeur hash
   - Pattern : `/#/auth/callback` ou détection directe des params Supabase dans le hash

#### Option B : Désactiver la confirmation email + validation admin

1. Désactiver "Confirm email" dans Supabase Dashboard > Auth > Settings
2. Après inscription : login automatique immédiat (le code existe déjà, `Login.tsx:248-254`)
3. Ajouter un flag `is_approved` dans `user_profiles`
4. L'admin valide les comptes depuis `Admin.tsx`
5. Les comptes non approuvés voient un écran "En attente de validation"

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/pages/Login.tsx` | Écran post-inscription, bouton "Renvoyer email" |
| `src/App.tsx` | Route callback email (Option A) |
| `src/lib/auth.ts` | Gestion du callback token (Option A) |
| `src/pages/Admin.tsx` | Validation comptes (Option B) |
| `supabase/` | Config auth (Option B) |

### Décision à prendre

> **Quelle option choisir ?** Option A (confirmation email bien gérée) ou Option B (pas d'email, validation admin) ?

---

## 2. Import de toutes les performances FFN d'un nageur

### Problème actuel

La Edge Function `ffn-sync` (`supabase/functions/ffn-sync/`) scrape FFN Extranat et n'importe que les **records personnels** (meilleur temps par épreuve/bassin). Elle déduplique par `event_name + pool_length` et ne garde que le best time.

La table `swim_records` stocke uniquement les records (`record_type = 'comp'`).

### Objectif

Permettre d'importer **l'historique complet** des performances d'un nageur depuis FFN : toutes les compétitions, tous les temps, pas juste les meilleurs.

### Implémentation proposée

1. **Nouvelle table `swimmer_performances`** (ou extension de `club_performances`)

   ```sql
   CREATE TABLE swimmer_performances (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     swimmer_iuf TEXT,               -- IUF FFN
     event_code TEXT NOT NULL,        -- ex: "50 NL", "100 Dos"
     pool_length TEXT NOT NULL,       -- "25" ou "50"
     time_ms INTEGER NOT NULL,        -- temps en millisecondes
     time_display TEXT NOT NULL,      -- format "mm:ss.cc"
     competition_name TEXT,           -- nom de la compétition
     competition_date DATE,           -- date de la compétition
     competition_location TEXT,       -- lieu
     ffn_points INTEGER,             -- points FFN si disponibles
     source TEXT DEFAULT 'ffn',       -- 'ffn' ou 'manual'
     imported_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(swimmer_iuf, event_code, pool_length, competition_date, time_ms)
   );
   ```

2. **Nouvelle Edge Function `ffn-performances`** (ou extension de `ffn-sync`)
   - Scraper la page complète des performances sur Extranat (pas seulement les MPP)
   - Parser toutes les lignes de résultats avec : compétition, date, lieu, temps, points
   - Insérer dans `swimmer_performances` avec `ON CONFLICT DO NOTHING` (idempotent)
   - Retourner le nombre de performances importées (nouvelles + existantes)

3. **UI nageur** (`Records.tsx` ou nouvelle page)
   - Bouton "Importer mes performances"
   - Liste chronologique des performances avec filtres (épreuve, bassin, période)
   - Graphique d'évolution des temps par épreuve

### Pages FFN à scraper

Le site FFN Extranat expose les performances complètes d'un nageur via son IUF. La Edge Function actuelle (`ffn-sync`) scrape déjà les MPP — il faut étendre le scraping aux résultats de compétition détaillés.

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `supabase/migrations/` | Nouvelle migration pour `swimmer_performances` |
| `supabase/functions/ffn-performances/` | Nouvelle Edge Function (ou extension de `ffn-sync`) |
| `src/lib/api.ts` | Nouvelles méthodes API (import, liste, filtres) |
| `src/pages/Records.tsx` | UI historique performances |
| `src/lib/schema.ts` | Schéma Drizzle pour la nouvelle table |

---

## 3. Gestion coach des imports de performances

### Problème actuel

`RecordsAdmin.tsx` permet de gérer la liste des nageurs (IUF, sexe, naissance) mais :
- Le bouton "Mettre à jour les records" appelle `import-club-records` qui **n'existe pas**
- Le coach n'a aucun moyen de déclencher ou piloter les imports depuis sa vue
- Aucun feedback sur le statut des imports

### Objectif

Le coach doit pouvoir, depuis sa vue Coach, piloter l'import des performances de ses nageurs.

### Implémentation proposée

1. **Écran coach "Import Performances"** (nouveau tab dans `Coach.tsx` ou dans `RecordsAdmin.tsx`)
   - Liste des nageurs du groupe avec leur IUF FFN
   - Pour chaque nageur :
     - Bouton "Importer les performances"
     - Statut du dernier import (date, nombre de perfs importées)
     - Indicateur visuel : jamais importé / à jour / en cours
   - Bouton "Tout importer" (import bulk pour tous les nageurs actifs)

2. **Edge Function `import-club-records`** (à créer)
   - Reçoit la liste des nageurs (IUF) à importer
   - Pour chaque nageur : appelle le scraper FFN et insère les performances
   - Recalcule les records club (`club_records`) à partir de toutes les performances
   - Retourne un rapport (succès/erreurs par nageur)

3. **Table `import_logs`** (optionnel, pour traçabilité)

   ```sql
   CREATE TABLE import_logs (
     id SERIAL PRIMARY KEY,
     triggered_by INTEGER REFERENCES users(id),
     swimmer_iuf TEXT,
     status TEXT DEFAULT 'pending',  -- pending, running, success, error
     performances_count INTEGER,
     error_message TEXT,
     started_at TIMESTAMPTZ DEFAULT NOW(),
     completed_at TIMESTAMPTZ
   );
   ```

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/import-club-records/` | Nouvelle Edge Function |
| `src/pages/coach/` | Nouveau composant ou tab dans Coach.tsx |
| `src/pages/RecordsAdmin.tsx` | Brancher le bouton existant sur la vraie Edge Function |
| `src/lib/api.ts` | Méthodes API pour import + logs |

### Dépendance

> Ce chantier dépend du chantier §2 (import performances). L'Edge Function `import-club-records` réutilisera la logique de scraping de `ffn-performances`.

---

## 4. Records club par catégorie d'âge, sexe et nage

### Problème actuel

`RecordsClub.tsx` a déjà les filtres UI :
- Bassin (25m/50m)
- Sexe (M/F)
- Catégorie d'âge (8 ans et - ... 17 ans et +)
- Type de nage (NL, Dos, Brasse, Papillon, 4 Nages)

Mais les tables `club_records` et `club_performances` sont **vides** car l'import n'existe pas (voir §2 et §3).

### Objectif

Afficher les records du club organisés en tableaux lisibles par catégorie d'âge, sexe et nage, une fois les données importées.

### Implémentation proposée

1. **Alimenter les données** (dépend de §2 et §3)
   - Une fois `swimmer_performances` remplie, un job recalcule les best times par :
     - `event_code` + `pool_length` + `sex` + `age_category`
   - Stockage dans `club_records` (table existante)

2. **Revoir l'UI de `RecordsClub.tsx`** si nécessaire
   - Vérifier que les filtres existants fonctionnent bien avec les données réelles
   - Ajouter un affichage en tableau structuré :
     - Colonnes : Épreuve | Record | Nageur | Date | Compétition
     - Groupé par catégorie d'âge
   - Ajouter un mode "vue globale" (tous les records du club toutes catégories)

3. **Calcul des catégories d'âge**
   - À partir de la date de naissance du nageur et de la date de la performance
   - Catégories FFN standard : Avenir (8-), Poussin (9-10), Benjamin (11-12), Minime (13-14), Cadet (15-16), Junior (17-18), Senior (19+)

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/pages/RecordsClub.tsx` | Ajustements UI si nécessaire |
| `src/lib/api.ts` | Requête filtrée club_records |
| `supabase/functions/import-club-records/` | Calcul best times par catégorie |

### Dépendance

> Ce chantier est essentiellement un chantier de **données**. L'UI existe déjà. Il devient fonctionnel une fois les chantiers §2 et §3 terminés.

---

## 5. Dette technique UI/UX restante

Voir [`docs/patch-report.md`](./patch-report.md) pour le détail complet des items restants de l'audit UI/UX.

### Résumé des items non terminés

| Catégorie | Items restants | Priorité |
|-----------|---------------|----------|
| Couleurs hardcodées (zinc/slate) | ~50 occurrences hors `/ui/` | Basse |
| Skeletons de chargement manquants | SwimCatalog, Progress | Basse |
| Labels htmlFor manquants (Login) | 1 formulaire | Basse |
| Highlight drag-and-drop StrengthCatalog | 1 composant | Basse |
| Images sans loading="lazy" | WorkoutRunner, SwimCatalog | Basse |
| Gradients #fff (TimesheetTimeWheel) | 1 composant | Basse |

---

## Ordre d'implémentation recommandé

```
1. Refonte inscription (§1)
   └── Indépendant, améliore l'onboarding immédiatement

2. Import performances FFN (§2)
   └── Fondation pour §3 et §4

3. Gestion coach imports (§3)
   └── Dépend de §2

4. Records club (§4)
   └── Dépend de §2 et §3 (données)

5. Dette UI/UX (§5)
   └── En parallèle, basse priorité
```

---

## Notes techniques transverses

### Architecture actuelle (rappel)

- **Frontend** : React 19 + TypeScript + Vite 7 + Tailwind CSS 4
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions Deno)
- **Déploiement** : GitHub Pages (frontend) + Supabase Cloud (backend)
- **Routing** : Hash-based (Wouter) pour compatibilité GitHub Pages
- **Persistance** : Supabase primary, localStorage fallback offline

### Edge Functions existantes

| Fonction | Statut | Description |
|----------|--------|-------------|
| `ffn-sync` | ✅ | Sync records perso depuis FFN Extranat |
| `admin-user` | ✅ | Gestion utilisateurs (création Supabase Auth) |
| `import-club-records` | ❌ | **N'existe pas** — appelé dans le code mais jamais créé |
| `ffn-performances` | 🗓️ | **A créer** — import historique complet performances |

### Tables Supabase pertinentes

| Table | Statut | Usage |
|-------|--------|-------|
| `swim_records` | ✅ | Records perso nageur (best times) |
| `club_records` | ✅ | Records club (vide, en attente d'import) |
| `club_performances` | ✅ | Performances club (vide, en attente d'import) |
| `club_record_swimmers` | ✅ | Liste nageurs pour import club |
| `swimmer_performances` | 🗓️ | **A créer** — historique complet performances nageur |
| `import_logs` | 🗓️ | **A créer** (optionnel) — traçabilité des imports |

---

## Règles de documentation et suivi d'avancement

Chaque session de développement **doit** suivre ce protocole pour maintenir la traçabilité et permettre la reprise facile par une future conversation.

### 1. Avant de coder — Lire le contexte

1. `CLAUDE.md` (racine) — vue d'ensemble rapide
2. Ce fichier (`docs/ROADMAP.md`) — comprendre le chantier ciblé, ses dépendances, les fichiers impactés
3. `docs/FEATURES_STATUS.md` — vérifier le statut actuel de la feature concernée

### 2. Pendant le développement — Documenter chaque patch

Pour **chaque lot de modifications** (commit ou groupe de commits liés), ajouter une entrée dans `docs/implementation-log.md` en respectant ce format :

```markdown
## YYYY-MM-DD — Titre court du patch

**Branche** : `nom-de-la-branche`
**Chantier ROADMAP** : §N — Nom du chantier

### Contexte
Quel problème ce patch résout, pourquoi il est nécessaire.

### Changements réalisés
- Description des modifications concrètes (fichiers, logique, UI)
- Nouvelles tables/migrations si applicable
- Nouvelles Edge Functions si applicable

### Fichiers modifiés
| Fichier | Nature du changement |
|---------|---------------------|
| `src/pages/Foo.tsx` | Ajout composant X |
| `supabase/migrations/000XX.sql` | Nouvelle table Y |

### Tests
- [x] `npm run build` — compilation OK
- [x] `npm test` — tests passent
- [x] `npx tsc --noEmit` — 0 erreur TypeScript
- [ ] Test manuel (décrire le scénario)

### Décisions prises
- Choix A plutôt que B parce que...
- Question en suspens pour plus tard : ...

### Limites / dette introduite
- Ce qui n'est pas parfait mais acceptable pour ce patch
- Ce qui devra être amélioré plus tard
```

### 3. Après le développement — Mettre à jour le suivi global

A chaque fin de session, mettre à jour **ces 4 fichiers** :

| Fichier | Quoi mettre à jour |
|---------|-------------------|
| `docs/ROADMAP.md` | Colonne **Statut** dans la vue d'ensemble (A faire → En cours → Fait). Ajouter une section "Avancement" dans le chantier concerné si partiellement complété. |
| `docs/FEATURES_STATUS.md` | Changer le statut des features impactées (❌ → ⚠️ → ✅). Mettre à jour les notes. |
| `docs/implementation-log.md` | L'entrée du patch a déjà été ajoutée pendant le dev (voir §2). |
| `CLAUDE.md` | Mettre à jour si un fichier clé a été ajouté/supprimé, si une Edge Function a été créée, ou si un chantier est terminé. |

### 4. Suivi d'avancement par chantier

Chaque chantier dans ce ROADMAP doit maintenir une section **Avancement** une fois le travail démarré :

```markdown
### Avancement

| Étape | Statut | Date | Notes |
|-------|--------|------|-------|
| Migration SQL | ✅ Fait | 2026-XX-XX | Migration 000XX |
| Edge Function | ✅ Fait | 2026-XX-XX | Déployée |
| API client (api.ts) | ⚠️ Partiel | 2026-XX-XX | Méthodes CRUD OK, filtres à faire |
| UI frontend | ❌ A faire | — | |
| Tests | ❌ A faire | — | |
```

### 5. Conventions de statut

| Icône | Signification | Usage |
|-------|---------------|-------|
| ❌ | Non commencé | Aucun code écrit |
| ⚠️ | En cours / Partiel | Du code existe mais incomplet |
| ✅ | Terminé | Fonctionnel, testé, mergé |
| 🗓️ | Planifié | Décrit dans la roadmap mais pas encore démarré |
| 🔧 | Dépend de config | Fonctionnel mais dépend d'un paramètre externe |

### 6. Règle d'or

> **Aucun patch ne doit être mergé sans une entrée correspondante dans `implementation-log.md`.**
> Un futur développeur (humain ou IA) doit pouvoir retracer chaque changement depuis le log jusqu'au commit.

# Suivi Natation (V2)

Application web de suivi des séances de natation et de musculation pour l’Erstein Aquatic Club. La V2 reprend l’objectif de la V1 (app statique) avec une interface React moderne et une synchronisation Worker/D1.

## Objectif produit
- Permettre aux nageurs de saisir leurs séances, suivre leur progression et consulter des KPIs clairs.
- Donner aux coachs des outils pour créer/assigner des séances, suivre les athlètes et communiquer.
- Offrir un espace administratif (coach/comité) pour le pointage des heures.

## Fonctionnalités actuelles (état réel du code)
### 🔐 Authentification & rôles
- Gestion multi-rôles : nageur, coach, comité, admin.
- Connexion sécurisée avec redirections par rôle.
- Gestion des comptes administrable côté admin.
- Navigation dynamique selon le rôle.

### 🏊 Natation
**Côté coach**
- Création et édition de séances de natation.
- Catalogue de séances (archivage, suppression sécurisée).
- Gestion des exercices, blocs et modalités.
- Assignation de séances aux nageurs.

**Côté nageur**
- Consultation des séances assignées.
- Exécution de séances.
- Saisie du ressenti (difficulté, fatigue, commentaire).
- Historique modifiable des séances.
- Page de progression (KPIs synthétiques).

### 🏋️ Musculation
**Côté nageur**
- Lancement et reprise de séance.
- Mode “focus” mobile.
- Saisie charge / répétitions.
- Suppression de séance en cours (API, sans fallback local).
- Réactivité immédiate (PWA friendly).

**Côté coach**
- Création de séances de musculation.
- Catalogue d’exercices.
- Pré-remplissage depuis les exercices (séries, reps, %1RM, repos).

### 💬 Messagerie
- Messagerie en fils (threads).
- Regroupement par expéditeur.
- Indicateurs lu / non-lu.
- Envoi coach → nageur / groupe.
- Réponse nageur autorisée dans les fils existants.
- Mise à jour automatique de l’état non-lu.

### 🕒 Administratif / Comité — Pointage des heures
- Pointage par shifts.
- Heures d’arrivée / sortie.
- Plusieurs shifts par jour.
- Lieu de travail.
- Indicateur “temps de trajet”.
- Shifts “en cours” (sans heure de sortie).
- Dashboards (totaux semaine / mois).
- Séparation temps de travail / temps de trajet.
- Coach : CRUD sur ses shifts.
- Comité : lecture globale + filtre par coach.

### 📱 PWA & UX
- Application PWA installable.
- Réactivité sans refresh (sessions en cours).
- Safe-areas mobile prises en compte.
- Correctifs iOS / Android (meta tags, navigation).

## État d’implémentation (résumé)
- Backend Worker/D1 : auth, RBAC, validations, catalogues, assignations, historique muscu, messagerie, timesheet.
- Front React : pages principales (Dashboard, Progress, Strength, Coach, Profile, Notifications, Timesheet).
- Flux de données : front ↔ Worker ↔ D1 avec token partagé + JWT.

## Roadmap (vision long terme)
### 🔁 T2 — Authentification (refonte)
- Mot de passe obligatoire pour tous les comptes.
- Support de usernames identiques (clé = username + mot de passe).
- Nettoyage complet de la logique “password optionnel”.
- Migration contrôlée des comptes existants.

### 🎯 T3 — Natation (améliorations)
- Calcul correct des distances (reps × blocs × répétitions).
- Icônes matériel flat (palmes, tuba, plaquettes…).
- Affichage lisible des modalités (une ligne par modalité avec puces).

### 🧩 T4 — Correctifs UX & cohérence produit
**Messagerie**
- Création systématique des fils après envoi.
- Badge non-lu fiable.
- Nom réel du coach côté nageur.

**Musculation**
- Modales charge/reps centrées sur mobile.
- Boutons bas toujours visibles.
- Création séance coach sans cycle.
- Vue condensée / détaillée des paramètres d’exercices.

**Profil nageur**
- Bouton “Records” ouvrant une page dédiée.

### 🎨 T5 — Pixel-perfect UI (à partir de maquettes)
- Création de séances de musculation (coach).
- Pointage des shifts (coach / comité).
- Page “Records nageur”.
- Alignement strict maquettes (espacements, typographies, icônes).

### 🧪 Qualité & tests
- Tests unitaires & logiques sur les helpers critiques.
- Tests de rendu et de règles métier.
- CI actuelle orientée build (tests automatisés à renforcer).

### Vision produit (cible UX)
- **Coach** : outil de création de séance natation puissant, fiable, ergonomique et très simple (création par blocs, exercices rapides à composer, réutilisation, assignation immédiate).
- **Nageur** : consultation pré-séance très visuelle :
  - Blocs clairement séparés, lisibles en un coup d’œil.
  - Exercices épurés et compréhensibles rapidement.
  - Équipements visibles sous forme d’icônes.
  - Intensité de travail affichée via une échelle proportionnelle (V0 → Max).

## Data flows actuels
- **Auth** : `auth_login` → tokens JWT, `auth_me` pour hydrater le profil.
- **Natation** : `action=get` (historique) et `POST` (saisie) vers Worker.
- **Musculation** : runs, logs, historique via Worker (`strength_*`).
- **Profil & records** : `users_*`, `swim_records_*`, `one_rm_*` via Worker.

## Backend Worker (Cloudflare + D1)
- **Entrée Worker** : `cloudflare-worker/src/index.js` (actions via query string).
- **Schéma D1** : `cloudflare-worker/schema.sql`.
- **Auth** : token partagé (`SHARED_TOKEN`) + JWT (`AUTH_SECRET`).

### Endpoints principaux
- **Auth & users** : `auth_login`, `auth_refresh`, `auth_me`, `users_get`, `users_create`, `users_update`
- **Groupes** : `groups_get`, `groups_add_member`
- **Notifications** : `notifications_list`, `notifications_send`, `notifications_mark_read`
- **Natation** : `get`, `hall`, `swim_catalog_list`, `swim_catalog_upsert`, `swim_records`, `swim_records_upsert`
- **Musculation** : `exercises`, `exercises_add`, `exercises_update`, `strength_catalog_list`, `strength_catalog_upsert`
- **Assignations** : `assignments_create`, `assignments_list`
- **Runs musculation** : `strength_run_start`, `strength_run_update`, `strength_set_log`, `strength_history`
- **1RM** : `one_rm_upsert`

## Frontend React
- **Routing** : hash router (Wouter) dans `client/src/App.tsx`.
- **Auth** : tokens en localStorage (`client/src/lib/auth.ts`) + refresh JWT.
- **API front** : `client/src/lib/api.ts` (appels Worker + fallback localStorage).

## Icône iOS (Ajout à l’écran d’accueil)
Placez les assets dans `client/public/` et déclarez-les dans `client/index.html` :
- `apple-touch-icon-180.png`
- `apple-touch-icon-167.png`
- `apple-touch-icon-152.png`

## Architecture & stack
### Frontend
- **React + TypeScript** (Vite).
- **UI** : Radix UI + Tailwind CSS.
- **State** : Zustand + React Query.
- **Charts** : Recharts.

### Backend (app)
- **Express** (serveur d’entrée).
- **Vite middleware** en développement.
- **API REST** : non exposée (le front utilise `api.ts`).

### Backend (Cloudflare Worker + D1)
- Dossier `cloudflare-worker/` : Worker Cloudflare + schéma D1.
- Utilisé pour la synchronisation distante.

## Structure du repo
```
.
├── client/                # Frontend React (pages, composants, hooks)
├── server/                # Serveur Express + Vite middleware
├── shared/                # Schéma partagé (Drizzle/Zod, stub)
├── cloudflare-worker/     # Worker Cloudflare + D1 (API)
├── docs/                  # Contrat de données roadmap
├── script/                # Build client + server
└── readme_old_project     # README V1 (web statique)
```

## Démarrage local
### Prérequis
- Node.js 18+
- npm

### Installer les dépendances
```bash
npm install
```

### Lancer l’app en développement (serveur + front)
```bash
npm run dev
```
L’application est servie sur `http://localhost:5000`.

### Build production
```bash
npm run build
```
Puis :
```bash
npm start
```

## Synchronisation Cloudflare Worker
### Variables supportées côté front
Vous pouvez configurer l’endpoint et le token via :
- Query string : `?swimSyncEndpoint=...&swimSyncToken=...`
- Variables Vite : `VITE_SWIM_SYNC_ENDPOINT`, `VITE_SWIM_SYNC_TOKEN`
- Variables globales : `window.SWIM_SYNC_ENDPOINT`, `window.SWIM_SYNC_TOKEN`
- localStorage : `SWIM_SYNC_ENDPOINT`, `SWIM_SYNC_TOKEN`

### Exemple rapide (HTML)
```html
<script>
  window.SWIM_SYNC_ENDPOINT = "https://<worker>.workers.dev";
  window.SWIM_SYNC_TOKEN = "votre-token";
</script>
```

### Worker Cloudflare
Consultez `cloudflare-worker/README.md` pour :
- créer la base D1,
- déployer le Worker,
- appliquer le schéma SQL.

### Déploiement GitHub Pages
Pour le build GitHub Pages, configurez un secret GitHub Actions :
- `SWIM_SYNC_ENDPOINT` = `https://<worker>.workers.dev/`

Le workflow mappe ce secret vers `VITE_SWIM_SYNC_ENDPOINT` au moment du build et échoue si le secret est absent.
Le secret peut être défini au niveau du dépôt ou dans l’environnement GitHub `github-pages` (utilisé par le job de build).
Assurez-vous que GitHub Pages utilise **GitHub Actions** comme source de déploiement (Settings → Pages → Source).

## Ancienne version (V1)
Le README V1 (application statique) est conservé dans :
- `readme_old_project`

---

## Maquettes UI/UX de référence
- `docs/maquettes-ui-ux/maquettes_creation_seance_natation_coach.jsx` (création séance natation coach)
- `docs/maquettes-ui-ux/maquette_espace_coach_natation.jsx` (vue espace coach natation)
- `docs/maquettes-ui-ux/maquette_saisie_ressenti_seance_natation.jsx` (saisie ressenti natation)
- `docs/maquettes-ui-ux/maquettes_musculation_execution_vue_athlète.jsx` (exécution musculation côté nageur)
  - Blocs nets et hiérarchisés.
  - Exercices épurés et compréhensibles en quelques secondes.
  - Équipements visibles sous forme d’**icônes**.
  - Intensité affichée sous forme d’**échelle proportionnelle** (V0 → Max).

### ✅ Audit UI/UX global (obligatoire)
Analyser toute l’app et signaler :
- doublons d’accès,
- menus difficiles à trouver,
- incohérences de navigation,
- risques d’affichage (responsive, overflow, petits clics),
- manque de clarté des couleurs des sliders,
- interactions trop fines,
- incohérences entre pages (libellés, placements, actions).

### ✅ Format de sortie attendu
1) **Résumé global (OK / KO)**  
2) **Audit détaillé par zone**  
   - Backend  
   - Frontend  
   - Auth & RBAC  
   - Data flows  
   - UI/UX global  
3) **Matrice de validation des fonctionnalités**  
   - ✅ OK / ⚠️ Partiel / ❌ Manquant  
   - endpoints concernés  
   - tables D1  
   - pages/modules impactés  
   - dépendances  
4) **Plan d’actions si besoin**  
5) **Task‑stubs uniquement si lacune détectée**  
   - Regrouper au maximum (1 stub = ensemble cohérent)  
   - Respect strict du format ci‑dessous :

**Tâche suggérée**  
Résumé court de la fonctionnalité à corriger  
Démarrer la tâche  
Sortie attendue  
Format de sortie attendu  
Format de sortie attendu  

### ✅ Rappel
- Toute fonctionnalité notée **KO** doit avoir un **task‑stub conforme**.
- Les bugs historiques sont supposés corrigés : **valider l’efficacité (OK/KO)**.
- **Implémente uniquement** si une régression ou un défaut est présent.
- Base‑toi **exclusivement** sur le code réel du repo.

# Suivi Natation V2

Application web de suivi des séances de natation et de musculation pour l'Erstein Aquatic Club.

## Stack technique

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| **UI** | Radix UI + Shadcn (55 composants) |
| **State** | Zustand 5, React Query 5 |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions) |
| **Déploiement** | GitHub Pages (frontend), Supabase Cloud (backend) |

## Fonctionnalités

### 🔐 Authentification & Rôles
- Multi-rôles : nageur, coach, comité, admin
- Connexion sécurisée avec Supabase Auth
- Navigation dynamique selon le rôle

### 🏊 Natation

| Côté | Fonctionnalités |
|------|-----------------|
| **Coach** | Création/édition de séances, catalogue, assignation aux nageurs |
| **Nageur** | Consultation, exécution, saisie ressenti, historique, progression |

### 🏋️ Musculation

| Côté | Fonctionnalités |
|------|-----------------|
| **Coach** | Catalogue d'exercices (⚠️ builder en cours) |
| **Nageur** | Lancement séance, mode focus mobile, saisie charge/reps, historique |

### 💬 Messagerie
- Fils de discussion (threads)
- Indicateurs lu/non-lu
- Envoi coach → nageur/groupe

### 🕒 Pointage des heures (Comité)
- Shifts avec heures d'arrivée/sortie
- Lieu de travail, temps de trajet
- Dashboards totaux semaine/mois

### 📱 PWA
- Application installable
- Safe-areas mobile
- Réactivité sans refresh

## État des fonctionnalités

| Module | Statut | Notes |
|--------|--------|-------|
| Auth Supabase | ✅ OK | |
| Natation nageur | ✅ OK | |
| Natation coach | ✅ OK | |
| Musculation nageur | ✅ OK | |
| Musculation coach | ✅ OK | |
| Messagerie | ✅ OK | |
| Pointage heures | ✅ OK | |
| Records FFN | ✅ OK | Sync via Edge Function |
| Hall of Fame | ✅ OK | |

## Structure du projet

```
competition-V2/
├── src/
│   ├── pages/           # Pages React (19 pages)
│   ├── components/      # Composants UI et métier
│   ├── lib/
│   │   ├── api.ts       # Client API Supabase
│   │   ├── auth.ts      # Gestion authentification
│   │   ├── supabase.ts  # Client Supabase
│   │   └── features.ts  # Feature flags
│   └── hooks/           # Hooks React personnalisés
├── supabase/
│   ├── migrations/      # Migrations PostgreSQL
│   └── functions/       # Edge Functions (ffn-sync, admin-user)
├── docs/                # Documentation
└── public/              # Assets statiques
```

## Démarrage local

### Prérequis
- Node.js 18+
- npm
- Compte Supabase (optionnel pour dev local)

### Installation

```bash
npm install
```

### Configuration

Créer un fichier `.env` à la racine :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Développement

```bash
npm run dev
```

L'application est servie sur `http://localhost:8080`.

### Build production

```bash
npm run build
```

## Déploiement

### GitHub Pages

1. Configurer les secrets dans GitHub :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. Le workflow `.github/workflows/pages.yml` déploie automatiquement sur push vers `main`

### Edge Functions Supabase

```bash
# Installation CLI
npm install -g supabase

# Connexion
supabase login

# Lier le projet
supabase link --project-ref <project-id>

# Déployer les fonctions
supabase functions deploy ffn-sync
supabase functions deploy admin-user

# Configurer les secrets
supabase secrets set SERVICE_ROLE_KEY=<service-role-key>
```

## Documentation additionnelle

| Document | Description |
|----------|-------------|
| `docs/FEATURES_STATUS.md` | Matrice détaillée des fonctionnalités |
| `docs/audit-projet-complet.md` | Audit qualité code (score B+) |
| `docs/implementation-log.md` | Journal des implémentations |
| `docs/roadmap-data-contract.md` | Contrats de données |

## Roadmap

### Complété récemment
- [x] Activer le builder musculation coach (`coachStrength`)
- [x] Tests E2E critiques (Login, Dashboard, Strength, Records)
- [x] Audit UI/UX (touch targets, safe areas, responsive)
- [x] Performance: lazy loading, code splitting (-80% bundle)

### En cours
- [ ] Augmenter la couverture de tests (cible: 15%)
- [ ] Refactoring `api.ts` en modules (2859→2459 lignes, -14%)

### Planifié
- [ ] Migration tokens vers cookies httpOnly
- [ ] Documentation API Supabase

## Contribuer

1. Créer une branche depuis `main`
2. Implémenter les changements
3. Vérifier : `npm run build`
4. Créer une PR vers `main`

---

*Dernière mise à jour : 2026-02-07*

# État des fonctionnalités

*Dernière mise à jour : 2026-02-08 (§3 gestion coach imports + §4 records club alimentés)*

## Légende

| Statut | Signification |
|--------|---------------|
| ✅ | Fonctionnel |
| ⚠️ | Partiel / En cours |
| ❌ | Non implémenté |
| 🔧 | Dépend de la configuration |
| 🗓️ | Planifié (roadmap) |

---

## Feature Flags

Fichier : `src/lib/features.ts`

```typescript
export const FEATURES = {
  strength: true,        // ✅ Musculation nageur
  hallOfFame: true,      // ✅ Hall of Fame
  coachStrength: true,   // ✅ Builder musculation coach
} as const;
```

Tous les feature flags sont activés.

---

## Matrice des fonctionnalités

### Authentification

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Login email/password | ✅ | `Login.tsx`, `auth.ts` | Supabase Auth |
| Gestion des rôles | ✅ | `auth.ts` | nageur, coach, comité, admin |
| Refresh token | ✅ | `auth.ts` | JWT automatique Supabase |
| Inscription self-service | ✅ | `Login.tsx`, `auth.ts`, `App.tsx`, `Admin.tsx` | Option B : validation coach/admin, écran post-inscription, gate approbation |
| Approbation inscriptions | ✅ | `Admin.tsx`, `api.ts` | Section "Inscriptions en attente" pour coach/admin |
| Mot de passe oublié | ✅ | `Login.tsx`, `App.tsx`, `auth.ts` | Flow complet : email de reset + route `/#/reset-password` + detection token recovery |
| Création compte (admin) | ✅ | `Admin.tsx` | Via panel admin |
| Désactivation compte | 🔧 | `api.ts` | Retourne "skipped" si Supabase offline |

### Natation — Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Dashboard calendrier | ✅ | `Dashboard.tsx` | Mois, 2 créneaux/jour |
| Saisie ressenti | ✅ | `Dashboard.tsx` | Difficulté, fatigue, perf, engagement, distance, commentaire |
| Présence/absence | ✅ | `Dashboard.tsx` | Toggle par créneau |
| Consultation séances | ✅ | `SwimSessionView.tsx` | Liste + détail |
| Historique/Progression | ✅ | `Progress.tsx` | KPIs, graphiques Recharts, filtrage période |

### Natation — Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création séance | ✅ | `SwimCatalog.tsx` | Blocs, exercices, intensité, matériel |
| Édition séance | ✅ | `SwimCatalog.tsx` | |
| Catalogue | ✅ | `SwimCatalog.tsx` | Archivage, suppression |
| Assignation | ✅ | `CoachAssignScreen.tsx` | Nage + muscu |

### Musculation — Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste séances assignées | ✅ | `Strength.tsx` | + catalogue |
| Preview séance | ✅ | `Strength.tsx` | Mode "reader" |
| Mode focus (WorkoutRunner) | ✅ | `WorkoutRunner.tsx` | Mobile-first, chrono repos |
| Saisie charge/reps | ✅ | `WorkoutRunner.tsx` | Auto-sauvegarde |
| Historique | ✅ | `Strength.tsx` | Tab "Historique", 1RM, graphiques |
| Fiche exercice avec GIF | 🔧 | `Strength.tsx` | Dépend des URLs dans `dim_exercices` |

### Musculation — Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Builder séance | ✅ | `StrengthCatalog.tsx` | Activé (`coachStrength: true`) |
| Catalogue exercices | ✅ | `StrengthCatalog.tsx` | Par cycle (endurance/hypertrophie/force) |
| Assignation | ✅ | `CoachAssignScreen.tsx` | Via écran d'assignation partagé |

### Records & FFN

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Records personnels (CRUD) | ✅ | `Records.tsx` | Saisie manuelle + toggle 25m/50m |
| Sync FFN (records perso) | ✅ | Edge Function `ffn-sync` | Scrape Extranat, meilleur temps par épreuve |
| Import toutes performances | ✅ | Edge Function `ffn-performances` | Import historique complet depuis FFN |
| Records club (consultation) | ✅ | `RecordsClub.tsx` | UI avec filtres + indicateur dernière MAJ, alimentée par import |
| Import records club (FFN) | ✅ | `RecordsAdmin.tsx`, Edge Function `import-club-records` | Import bulk + recalcul records club |
| Gestion nageurs records | ✅ | `RecordsAdmin.tsx` | Ajout/édition/activation swimmers |
| Hall of Fame | ✅ | `HallOfFame.tsx` | Top 5 nage + muscu |
| Gestion coach imports perfs | ✅ | `RecordsAdmin.tsx` | Import individuel par nageur + historique des imports |

### Messagerie

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste threads | ✅ | `Notifications.tsx` | Par expéditeur/groupe |
| Envoi message | ✅ | `CoachMessagesScreen.tsx` | Coach → nageur/groupe |
| Réponse | ✅ | `Notifications.tsx` | Dans thread existant |
| Indicateur non-lu | ✅ | `AppLayout.tsx` | Badge sur nav |
| Mark as read | ✅ | `api.ts` | |

### Pointage heures

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création shift | ✅ | `Administratif.tsx` | Date, heures, lieu, trajet |
| Édition shift | ✅ | `Administratif.tsx` | |
| Lieux de travail | ✅ | `Administratif.tsx` | Gestion CRUD lieux |
| Dashboard totaux | ✅ | `Administratif.tsx` | Semaine/mois, graphiques |
| Vue comité | ✅ | `Comite.tsx` | Tous les coachs, filtrage |

### Admin

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste utilisateurs | ✅ | `Admin.tsx` | Recherche, filtre rôle |
| Création utilisateur | 🔧 | `Admin.tsx` | Retourne "skipped" si offline |
| Modification rôle | 🔧 | `Admin.tsx` | Idem |
| Désactivation | 🔧 | `Admin.tsx` | Idem |

### Profil

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Affichage infos | ✅ | `Profile.tsx` | Nom, anniversaire, groupe, objectifs, bio |
| Édition profil | ✅ | `Profile.tsx` | Avatar, objectifs, groupe, FFN IUF |
| Changement mot de passe | ✅ | `Profile.tsx` | Via Supabase Auth |

---

## Dépendances Supabase

| Fonctionnalité | Comportement si offline |
|----------------|-------------------------|
| Auth login | Erreur |
| Création utilisateur | `{ status: "skipped" }` |
| Modification rôle | `{ status: "skipped" }` |
| Sync FFN | Erreur Edge Function |
| Données générales | Fallback localStorage |

---

## Exercices sans GIF

Les exercices suivants n'ont pas d'URL `illustration_gif` dans `dim_exercices` :

- 39: Sliding Leg Curl
- 40: Back Extension 45°
- 41: Standing Calf Raise
- 42: Seated Soleus Raise
- 43: Pogo Hops
- 44: Ankle Isometric Hold
- 53: Rotational Med Ball Throw
- 54: Med Ball Side Toss
- 55: Med Ball Shot Put
- 56: Drop Jump to Stick
- 57: Isometric Split Squat Hold
- 58: Copenhagen Plank
- 59: Hip Airplane

Pour ajouter les GIFs manquants, mettre à jour la colonne `illustration_gif` dans Supabase.

---

## Voir aussi

- [`docs/ROADMAP.md`](./ROADMAP.md) — Plan de développement futur
- [`README.md`](../README.md) — Vue d'ensemble du projet
- [`docs/implementation-log.md`](./implementation-log.md) — Journal des implémentations

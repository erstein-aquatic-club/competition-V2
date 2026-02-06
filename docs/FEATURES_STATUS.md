# État des fonctionnalités

*Dernière mise à jour : 2026-02-06*

## Légende

| Statut | Signification |
|--------|---------------|
| ✅ | Fonctionnel |
| ⚠️ | Partiel / En cours |
| ❌ | Désactivé |
| 🔧 | Dépend de la configuration |

---

## Feature Flags

Fichier : `src/lib/features.ts`

```typescript
export const FEATURES = {
  strength: true,        // ✅ Musculation nageur
  hallOfFame: true,      // ✅ Hall of Fame
  coachStrength: false,  // ❌ Builder musculation coach
} as const;
```

---

## Matrice des fonctionnalités

### Authentification

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Login email/password | ✅ | `Login.tsx`, `auth.ts` | Supabase Auth |
| Gestion des rôles | ✅ | `auth.ts`, `dim_users` | nageur, coach, comité, admin |
| Refresh token | ✅ | `auth.ts` | JWT automatique |
| Création compte | ✅ | `Admin.tsx` | Via admin uniquement |
| Désactivation compte | 🔧 | `api.ts:2820` | Retourne "skipped" si Supabase offline |

### Natation - Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Consultation séances | ✅ | `Dashboard.tsx` | |
| Exécution séance | ✅ | `SwimSessionView.tsx` | |
| Saisie ressenti | ✅ | `SwimSessionView.tsx` | Difficulté, fatigue, commentaire |
| Historique | ✅ | `Progress.tsx` | |
| KPIs progression | ✅ | `Progress.tsx` | |

### Natation - Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création séance | ✅ | `SwimCatalog.tsx` | |
| Édition séance | ✅ | `SwimCatalog.tsx` | |
| Catalogue | ✅ | `SwimCatalog.tsx` | Archivage, suppression |
| Assignation | ✅ | `CoachAssignScreen.tsx` | |

### Musculation - Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste des séances | ✅ | `Strength.tsx` | Assignées + catalogue |
| Preview séance | ✅ | `Strength.tsx` | Mode "reader" |
| Bouton lancer séance | ✅ | `Strength.tsx`, `BottomActionBar.tsx` | Fixé (z-index) |
| Mode focus | ✅ | `WorkoutRunner.tsx` | Mobile-first |
| Saisie charge/reps | ✅ | `WorkoutRunner.tsx` | |
| Historique | ✅ | `Strength.tsx` | Tab "Historique" |
| Fiche exercice avec GIF | 🔧 | `Strength.tsx` | Dépend des URLs dans `dim_exercices` |

### Musculation - Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Builder séance | ❌ | `StrengthCatalog.tsx` | `coachStrength: false` |
| Catalogue exercices | ❌ | `StrengthCatalog.tsx` | Idem |
| Assignation | ✅ | via API | Fonctionne si séances existent |

### Records & Hall of Fame

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Records personnels | ✅ | `Records.tsx` | |
| Sync FFN | ✅ | `ffn-sync` Edge Function | Regex parsing par section bassin |
| Toggle 25m/50m | ✅ | `Records.tsx` | Fixé (useMemo + FFN sync regex) |
| Hall of Fame | ✅ | `HallOfFame.tsx` | |
| Records club | ✅ | `RecordsClub.tsx` | |

### Messagerie

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste threads | ✅ | `Notifications.tsx` | |
| Envoi message | ✅ | `CoachMessagesScreen.tsx` | Coach → nageur/groupe |
| Réponse | ✅ | `Notifications.tsx` | Dans thread existant |
| Indicateur non-lu | ✅ | `AppLayout.tsx` | Badge sur nav |
| Mark as read | ✅ | `api.ts` | |

### Pointage heures

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création shift | ✅ | `Administratif.tsx` | |
| Édition shift | ✅ | `Administratif.tsx` | |
| Lieux de travail | ✅ | `Administratif.tsx` | |
| Temps de trajet | ✅ | `Administratif.tsx` | |
| Dashboard totaux | ✅ | `Administratif.tsx` | Semaine/mois |
| Vue comité | ✅ | `Comite.tsx` | Tous les coachs |

### Admin

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste utilisateurs | ✅ | `Admin.tsx` | |
| Création utilisateur | 🔧 | `Admin.tsx` | Retourne "skipped" si offline |
| Modification rôle | 🔧 | `Admin.tsx` | Idem |
| Désactivation | 🔧 | `Admin.tsx` | Idem |

---

## Dépendances Supabase

Ces fonctionnalités nécessitent une connexion Supabase active :

| Fonctionnalité | Comportement si offline |
|----------------|-------------------------|
| Auth login | Erreur |
| Création utilisateur | `{ status: "skipped" }` |
| Modification rôle | `{ status: "skipped" }` |
| Sync FFN | Erreur Edge Function |
| Historique muscu | Données locales uniquement |

---

## Exercices sans GIF

Les exercices suivants n'ont pas d'URL `illustration_gif` dans la table `dim_exercices` :

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

## Prochaines activations

| Feature Flag | Priorité | Effort estimé |
|--------------|----------|---------------|
| `coachStrength` | HAUTE | 2h (déjà implémenté, juste à activer) |

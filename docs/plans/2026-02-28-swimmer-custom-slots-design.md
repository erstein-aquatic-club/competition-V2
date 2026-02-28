# Design — Créneaux personnalisés par nageur

**Date** : 2026-02-28
**Statut** : Validé
**Scope** : DB + API + UI coach + UI nageur + notifications + fix lisibilité mobile

---

## Contexte

Les créneaux d'entraînement sont aujourd'hui définis par groupe (table `training_slots` + `training_slot_assignments`). Certains nageurs ont des horaires décalés (ex : arriver 30min plus tard, faire 1h30 au lieu de 2h). Le coach a besoin de personnaliser le planning par nageur tout en gardant le lien avec le créneau groupe pour les notifications d'annulation/modification.

## Approche retenue — Table `swimmer_training_slots` avec lien optionnel

Chaque nageur peut avoir son propre planning complet. Chaque créneau nageur peut pointer vers un `training_slot_assignments` parent (héritage avec horaires custom) ou être autonome (créneau ajouté manuellement).

---

## 1. Base de données

### Nouvelle table `swimmer_training_slots`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID PK | DEFAULT gen_random_uuid() |
| `user_id` | INTEGER NOT NULL | → users(id) ON DELETE CASCADE |
| `source_assignment_id` | UUID nullable | → training_slot_assignments(id) ON DELETE SET NULL |
| `day_of_week` | SMALLINT NOT NULL | CHECK (1-7) |
| `start_time` | TIME NOT NULL | |
| `end_time` | TIME NOT NULL | CHECK (end_time > start_time) |
| `location` | TEXT NOT NULL | |
| `is_active` | BOOLEAN NOT NULL | DEFAULT true |
| `created_by` | INTEGER | → users(id) |
| `created_at` | TIMESTAMPTZ NOT NULL | DEFAULT now() |

**Index** :
- `idx_swimmer_slots_user` ON (user_id) WHERE is_active
- `idx_swimmer_slots_source` ON (source_assignment_id) WHERE source_assignment_id IS NOT NULL

**RLS** : SELECT pour tous les authentifiés, INSERT/UPDATE/DELETE pour coach+admin.

### Logique `source_assignment_id`

- **Non-null** → hérité d'un créneau groupe (horaires potentiellement différents)
- **Null** → créneau ajouté manuellement pour ce nageur
- **ON DELETE SET NULL** → si le créneau groupe est supprimé, le créneau nageur survit mais perd le lien

---

## 2. API (`src/lib/api/swimmer-slots.ts`)

### Types

```typescript
interface SwimmerTrainingSlot {
  id: string;
  user_id: number;
  source_assignment_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
}

interface SwimmerTrainingSlotInput {
  user_id: number;
  source_assignment_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
}
```

### Fonctions

| Fonction | Description |
|----------|-------------|
| `getSwimmerSlots(userId)` | Planning complet d'un nageur |
| `hasCustomSlots(userId)` | Booléen : le nageur a-t-il un planning perso ? |
| `initSwimmerSlots(userId)` | Copie les créneaux du groupe avec `source_assignment_id` |
| `createSwimmerSlot(input)` | Ajoute un créneau custom |
| `updateSwimmerSlot(slotId, input)` | Modifie horaires/lieu |
| `deleteSwimmerSlot(slotId)` | Soft delete |
| `resetSwimmerSlots(userId)` | Supprime tout et ré-initialise depuis le groupe |
| `getSwimmersAffectedBySlot(slotId)` | Nageurs dont un créneau perso a un `source_assignment_id` pointant vers ce slot |

### Logique de résolution (côté nageur)

```
if swimmer_training_slots existe pour user_id → utiliser ces créneaux
else → fallback sur getTrainingSlotsForGroup(groupId)
```

---

## 3. UI Coach — Écran créneaux

### Remplacement des filter pills

Remplacer les pills horizontales par un **Select unique** :
- Options : "Tous" | "Groupe X" | "Groupe Y" | ... | séparateur | "Nageur : Tom" | "Nageur : Léa" | ...
- Quand un nageur est sélectionné, la timeline affiche son planning perso
- Si le nageur n'a pas de planning perso → afficher les créneaux de son groupe avec un bandeau "Hérite du groupe X — Personnaliser"

### Lisibilité mobile timeline

Colonnes en **scroll horizontal** avec largeur ~80px chacune au lieu de comprimer 7 colonnes dans l'écran. Permet de voir 4-5 jours d'un coup avec scroll horizontal fluide.

---

## 4. UI Coach — Fiche nageur (nouvel onglet)

Nouvel onglet **"Créneaux"** dans `CoachSwimmerDetail` (à côté de Ressentis/Objectifs/Planif/Entretiens) :

- Mini-timeline semaine (réutilise le composant compact)
- Chaque créneau indique s'il est "hérité" (icône lien) ou "ajouté" (icône +)
- Tap → bottom sheet avec actions : modifier horaires, supprimer, ajouter exception
- Bouton "Personnaliser le planning" si pas encore customisé → appelle `initSwimmerSlots`
- Bouton "Réinitialiser depuis le groupe" pour repartir de zéro

---

## 5. UI Nageur

### Dashboard

Le calendrier du dashboard résout les créneaux via `getTrainingSlotsForGroup`. Nouvelle logique :
1. Vérifier `hasCustomSlots(userId)`
2. Si oui → `getSwimmerSlots(userId)`
3. Sinon → fallback `getTrainingSlotsForGroup(groupId)`

### Profil (AthleteSeasonHub)

Section "Mon planning" avec la mini-timeline semaine en lecture seule.

---

## 6. Notifications

Quand un coach crée un `training_slot_override` (annulation/modification) sur un créneau groupe :
1. Chercher les `swimmer_training_slots` dont `source_assignment_id` pointe vers une assignment de ce slot
2. Vérifier recouvrement horaire : le créneau nageur chevauche-t-il le créneau groupe modifié ?
3. Si oui → créer une notification pour le nageur via la table `notifications` existante

---

## 7. Résumé des fichiers impactés

| Fichier | Changement |
|---------|------------|
| `supabase/migrations/00043_swimmer_training_slots.sql` | Nouvelle table + RLS |
| `src/lib/api/types.ts` | Nouveaux types |
| `src/lib/api/swimmer-slots.ts` | Nouveau module CRUD |
| `src/lib/api/index.ts` | Re-export |
| `src/lib/api.ts` | Stubs façade |
| `src/pages/coach/CoachTrainingSlotsScreen.tsx` | Select filtre + timeline mobile scroll |
| `src/pages/coach/CoachSwimmerDetail.tsx` | Nouvel onglet Créneaux |
| `src/components/coach/SwimmerSlotsTab.tsx` | Nouveau composant onglet |
| `src/pages/Dashboard.tsx` | Résolution créneaux perso |
| `src/components/profile/AthleteSeasonHub.tsx` | Section Mon planning |
| `src/lib/api/notifications.ts` | Enrichir pour notifs override |

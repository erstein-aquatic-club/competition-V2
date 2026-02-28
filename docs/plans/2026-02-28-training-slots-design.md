# Design — Créneaux d'entraînement récurrents

**Date** : 2026-02-28
**Approche** : A — Table créneau normalisée avec jointures (3 tables)

## Contexte

L'application n'a actuellement aucune notion de créneaux d'entraînement récurrents. Le calendrier coach fonctionne par assignation manuelle de sessions sur des dates avec un slot binaire morning/evening. Ce design ajoute un planning hebdomadaire fixe : quels groupes s'entraînent quels jours, à quelles heures, dans quel lieu, avec quel coach et combien de lignes d'eau.

## Décisions

- **Accès** : CRUD coach uniquement, lecture pour tous les rôles authentifiés
- **Structure créneau** : jour de la semaine + plage horaire (heure début/fin) + lieu
- **Multi-groupes** : un même créneau horaire peut accueillir N groupes (permanents ou temporaires), chacun assigné à un coach avec un nombre de lignes d'eau
- **Lignes d'eau** : saisies directement par le coach (pas de notion de capacité totale du lieu)
- **Exceptions** : annulation ou modification d'un créneau sur une date précise (vacances, compétition, changement d'horaire ponctuel)
- **Navigation** : nouvel écran dans le dashboard coach + section lecture dans le profil nageur

## Modèle de données

### Table `training_slots`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `UUID` PK DEFAULT gen_random_uuid() | Identifiant |
| `day_of_week` | `SMALLINT NOT NULL` | 1=Lun ... 7=Dim (ISO) |
| `start_time` | `TIME NOT NULL` | Heure début |
| `end_time` | `TIME NOT NULL` | Heure fin |
| `location` | `TEXT NOT NULL` | Lieu |
| `created_by` | `INTEGER REFERENCES users(id)` | Coach créateur |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |
| `is_active` | `BOOLEAN DEFAULT true` | Soft delete |

Contraintes : `CHECK (end_time > start_time)`, `UNIQUE (day_of_week, start_time, end_time, location)`

### Table `training_slot_assignments`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `UUID` PK DEFAULT gen_random_uuid() | Identifiant |
| `slot_id` | `UUID NOT NULL REFERENCES training_slots(id) ON DELETE CASCADE` | Créneau |
| `group_id` | `INTEGER NOT NULL REFERENCES groups(id)` | Groupe |
| `coach_id` | `INTEGER NOT NULL REFERENCES users(id)` | Coach |
| `lane_count` | `SMALLINT` | Lignes d'eau (nullable) |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

Contrainte : `UNIQUE (slot_id, group_id)`

### Table `training_slot_overrides`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `UUID` PK DEFAULT gen_random_uuid() | Identifiant |
| `slot_id` | `UUID NOT NULL REFERENCES training_slots(id) ON DELETE CASCADE` | Créneau |
| `override_date` | `DATE NOT NULL` | Date exception |
| `status` | `TEXT NOT NULL CHECK (status IN ('cancelled', 'modified'))` | Type |
| `new_start_time` | `TIME` | Nouvel horaire (si modified) |
| `new_end_time` | `TIME` | Nouvel horaire (si modified) |
| `new_location` | `TEXT` | Nouveau lieu (si modified) |
| `reason` | `TEXT` | Motif |
| `created_by` | `INTEGER REFERENCES users(id)` | |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

Contrainte : `UNIQUE (slot_id, override_date)`

### RLS

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|---------------------|
| `training_slots` | Authentifié | Coach |
| `training_slot_assignments` | Authentifié | Coach |
| `training_slot_overrides` | Authentifié | Coach |

## UI

### Écran coach (`CoachTrainingSlotsScreen.tsx`)

- `CoachSectionHeader` : titre "Créneaux", bouton retour
- Bouton "+ Nouveau créneau" en haut
- Liste groupée par jour (Lun→Dim) avec séparateurs
- Chaque créneau = Card avec :
  - Header : plage horaire + lieu
  - Body : liste des assignments (badge groupe + nom coach + lignes d'eau)
  - Bouton edit → ouvre Sheet
- Jours sans créneau : texte discret "Aucun entraînement"

### Sheet "Créer / Modifier un créneau"

- Select jour de la semaine
- Inputs time début/fin
- Input texte lieu
- Section dynamique "Groupes & Coachs" : liste d'assignations (groupe, coach, lignes) avec ajout/suppression
- Bouton Enregistrer + Supprimer (mode edit)

### Sheet "Exception"

- Date picker
- Radio : Annulé / Modifié
- Si modifié : nouveaux horaires + nouveau lieu
- Motif optionnel
- Bouton Enregistrer

### Vue nageur (lecture seule)

- Section "Mon planning" dans le profil/dashboard
- Liste compacte : jour + horaire + lieu
- Exceptions à venir affichées avec icône warning

## Fichiers

| Composant | Fichier |
|-----------|---------|
| Écran coach | `src/pages/coach/CoachTrainingSlotsScreen.tsx` |
| API module | `src/lib/api/training-slots.ts` |
| Types | `src/lib/api/types.ts` (ajouts) |
| Migration | `supabase/migrations/00040_training_slots.sql` |
| Re-exports | `src/lib/api/index.ts` + `src/lib/api.ts` |
| Navigation coach | `src/pages/Dashboard.tsx` (ajout bouton) |
| Vue nageur | Section dans profil/dashboard existant |

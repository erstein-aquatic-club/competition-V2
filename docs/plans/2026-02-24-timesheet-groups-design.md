# Design : Groupes encadrés par shift (pointage coach)

**Date** : 2026-02-24
**Statut** : Validé

## Contexte

Les coachs pointent leurs heures dans l'onglet Administratif (shifts). Actuellement, un shift a une date, des heures, un lieu et un flag trajet. Il manque la possibilité de noter quels groupes le coach a encadrés pendant ce créneau.

## Objectif

Permettre aux coachs de cocher plusieurs groupes encadrés par shift. La liste propose les groupes permanents (table `groups`) + des labels custom ajoutés manuellement et persistés pour tous les coachs.

## Architecture données

### Nouvelles tables

1. **`timesheet_group_labels`** — Labels custom de groupes (ajoutés par les coachs)
   - `id` serial PK
   - `name` text UNIQUE NOT NULL
   - `created_at` timestamptz DEFAULT now()

2. **`timesheet_shift_groups`** — Jointure M:N shift ↔ groupe
   - `id` serial PK
   - `shift_id` integer FK → `timesheet_shifts.id` ON DELETE CASCADE
   - `group_name` text NOT NULL
   - UNIQUE(shift_id, group_name)

### Pourquoi `group_name` texte plutôt qu'un FK

Les items cochables viennent de 2 sources (table `groups` permanents + `timesheet_group_labels` custom). Stocker le nom en texte évite une logique complexe de résolution. Si un groupe permanent est renommé, le nom historique reste dans les shifts passés.

### Approche rejetée

Colonne JSONB/text[] sur `timesheet_shifts` : plus simple mais rend les agrégations SQL plus difficiles et ne permet pas de gérer la liste de labels custom facilement.

## Flow UI

### Formulaire shift (TimesheetShiftForm)

Nouvelle section entre "Lieu" et "Temps de trajet" :
- Titre "Groupes encadrés"
- Checkboxes : groupes permanents (`groups` WHERE `is_temporary = false` AND `is_active = true`) puis labels custom (`timesheet_group_labels`)
- Bouton "+" pour ajouter un label custom (input + bouton comme pour les lieux)
- Les labels custom peuvent être supprimés, pas les groupes permanents

### Liste des shifts (TimesheetShiftList)

Affichage des groupes cochés sous le lieu, en petits badges colorés.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Créer les 2 tables |
| `src/lib/schema.ts` | Tables Drizzle |
| `src/lib/api/types.ts` | `TimesheetGroupLabel` + `group_names` sur shift |
| `src/lib/api/timesheet.ts` | CRUD labels + lecture/écriture groupes par shift |
| `src/lib/api.ts` | Re-exports |
| `src/components/timesheet/TimesheetShiftForm.tsx` | Section checkboxes |
| `src/components/timesheet/TimesheetShiftList.tsx` | Badges groupes |
| `src/pages/Administratif.tsx` | State + queries groupes |

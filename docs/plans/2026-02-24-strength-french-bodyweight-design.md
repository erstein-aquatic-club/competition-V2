# Design : Traduction exercices FR + option "Poids du corps"

**Date** : 2026-02-24
**Statut** : Approuvé

## Objectif

1. Traduire tous les noms d'exercices de musculation en français dans `dim_exercices`
2. Ajouter l'option "Poids du corps" (PDC) comme alternative à la saisie d'une charge en kg

## Décisions

### Traduction des noms

- Migration SQL `UPDATE` sur `dim_exercices.nom_exercice` pour les 59 exercices
- Seuls les noms encore en anglais sont traduits (ceux déjà en français restent)
- Source unique de vérité = base de données, pas de mapping frontend

### Option "Poids du corps"

- **Valeur sentinelle** : `weight = -1` dans `strength_set_logs`
  - `null` = pas encore renseigné (existant)
  - `-1` = poids du corps (nouveau)
- **1RM** : ignoré quand `weight = -1` (pas d'estimation)
- **Tonnage/Volume** : exclu des calculs quand `weight = -1`
- **UI** : bouton "PDC" dans le Drawer de saisie charge, affiche "PDC" au lieu de "X kg"

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `supabase/migrations/XXXX_rename_exercises_fr.sql` | Renommage exercices |
| `src/components/strength/WorkoutRunner.tsx` | Toggle PDC, affichage conditionnel |
| `src/lib/api/strength.ts` | Skip 1RM quand weight=-1 |
| `src/pages/Progress.tsx` | Afficher "PDC" au lieu de "X kg" |
| `src/components/strength/SessionDetailPreview.tsx` | Afficher "PDC" si pertinent |

## Constante partagée

```typescript
export const BODYWEIGHT_SENTINEL = -1;
export const isBodyweight = (w: number | null | undefined) => w === BODYWEIGHT_SENTINEL;
```

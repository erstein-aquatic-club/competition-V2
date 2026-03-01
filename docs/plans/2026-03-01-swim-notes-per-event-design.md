# Design : Notes techniques par épreuve

**Date** : 2026-03-01
**Statut** : Validé

## Objectif

Enrichir les notes techniques nageur (swim_exercise_logs) avec épreuve FFN, taille bassin et équipement pour permettre le suivi de progression par épreuve.

## Modèle de données

### Migration — swim_exercise_logs

```sql
ALTER TABLE swim_exercise_logs
  ADD COLUMN IF NOT EXISTS event_code TEXT,        -- "50NL", "100DOS", etc.
  ADD COLUMN IF NOT EXISTS pool_length INTEGER,     -- 25 ou 50
  ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT '{aucun}';

-- Rendre session_id nullable (notes standalone)
ALTER TABLE swim_exercise_logs ALTER COLUMN session_id DROP NOT NULL;
```

### Équipements

| Tag | Label |
|-----|-------|
| `aucun` | Sans équipement |
| `palmes` | Palmes |
| `plaquettes` | Plaquettes |
| `pull-buoy` | Pull-buoy |
| `tuba` | Tuba frontal |
| `elastique` | Élastique |
| `combinaison` | Combinaison |

## Points d'entrée

1. **Inline (séance)** — ExerciseLogInline enrichi : sélecteur épreuve + bassin + chips équipement
2. **Standalone (/swim-notes)** — Bouton "+" pour créer une note manuelle avec formulaire complet

## Affichage /swim-notes

- Vue groupée par épreuve (sections pliables "50NL — 25m", "100DOS — 50m")
- Ordre chrono inversé dans chaque section
- Section "Non classées" pour les anciens logs sans event_code

## Types TypeScript

```typescript
interface SwimExerciseLogInput {
  // existants
  exercise_label: string;
  source_item_id?: number | null;
  split_times?: SplitTimeEntry[];
  tempo?: number | null;
  stroke_count?: StrokeCountEntry[];
  notes?: string | null;
  // nouveaux
  event_code?: string | null;
  pool_length?: number | null;
  equipment?: string[];
}
```

## API

- Migration SQL (3 colonnes + session_id nullable)
- Types enrichis
- Nouvelle query groupée par épreuve
- CRUD standalone (sans session_id)

# Design — Saisie technique inline dans la timeline nageur

**Date** : 2026-02-21
**Chantier** : §58 — Détails techniques par exercice (inline timeline)

## Problème

Les notes techniques (temps, tempo, coups de bras) sont enfouies dans le FeedbackDrawer (tiroir de ressenti). Le nageur doit ouvrir le ressenti, déplier "Notes techniques", ajouter manuellement chaque exercice un par un, puis remplir les champs. C'est peu intuitif et déconnecté de la vue séance.

## Solution

Transformer le `SwimSessionView` (page `/swim-session`) pour permettre la saisie technique **directement dans la timeline**. Quand le nageur tape sur un exercice, celui-ci s'expand inline pour révéler les champs de saisie. Un bouton sticky "Enregistrer" en bas persiste toutes les données d'un coup.

## Architecture

### Composants modifiés

1. **`SwimSessionView.tsx`** — Orchestrateur :
   - Charge les `SwimExerciseLogs` existants via `useQuery`
   - Gère l'état local des logs modifiés (`Map<itemId, SwimExerciseLogInput>`)
   - Gère l'ID de l'exercice actuellement expanded
   - Bouton sticky "Enregistrer" quand dirty
   - Supprime le Sheet de détail statique (remplacé par l'expansion)

2. **`SwimSessionTimeline.tsx`** — Nouvelles props optionnelles :
   - `exerciseLogs?: Map<number, SwimExerciseLogInput>` — logs indexés par `source_item_id`
   - `expandedItemId?: number | null` — exercice actuellement ouvert
   - `onToggleExpand?: (itemId: number) => void` — toggle expansion
   - `onLogChange?: (itemId: number, log: SwimExerciseLogInput) => void` — callback modification
   - Badge visuel sur les exercices ayant des données saisies

3. **Nouveau : `ExerciseLogInline.tsx`** — Formulaire inline :
   - Auto-détecte le nombre de reps depuis `raw_payload.exercise_repetitions` ou parsing du label
   - N lignes de saisie pour temps + coups de bras (une par rep)
   - Champ tempo global
   - Champ notes libres
   - UX mobile-first (`inputMode="decimal"` / `inputMode="numeric"`)

### Flux de données

```
SwimSessionView
  ├── useQuery("swim-exercise-logs", sessionId) → logs existants
  ├── useState: logsMap (Map<itemId, SwimExerciseLogInput>)
  ├── useState: expandedItemId
  └── SwimSessionTimeline
       ├── exerciseLogs={logsMap}
       ├── expandedItemId={expandedItemId}
       ├── onToggleExpand
       └── onLogChange
            └── ExerciseLogInline (inline sous l'exercice expanded)
```

### Sauvegarde

- Bouton sticky "Enregistrer" visible quand `dirty`
- Appelle `saveSwimExerciseLogs(sessionId, userId, allLogs)` — delete+insert atomique existant
- Toast de confirmation
- Indicateur visuel (badge/icône) sur les exercices ayant des données

### Détection du nombre de reps

Ordre de priorité :
1. `raw_payload.exercise_repetitions` (nombre explicite)
2. Parsing du label : `"6x50m"` → 6
3. Fallback : 1 rep

### Impact sur le FeedbackDrawer

Le `TechnicalNotesSection` est simplifié :
- Affiche un résumé read-only du nombre de notes saisies
- Lien "Voir/modifier dans la vue séance" → navigue vers `/swim-session?assignmentId=X`
- Supprime le formulaire complet (doublon avec la timeline)

## DB / API

Aucun changement. La table `swim_exercise_logs` et l'API existante (`saveSwimExerciseLogs`, `getSwimExerciseLogs`) couvrent le besoin :
- `source_item_id` → lie au `swim_session_items.id`
- `split_times` JSONB → `[{rep: 1, time_seconds: 32.5}, ...]`
- `stroke_count` JSONB → `[{rep: 1, count: 14}, ...]`
- `tempo` → global par exercice
- `notes` → texte libre

## Flux utilisateur

1. Dashboard → tape "Voir la séance" → `/swim-session?assignmentId=X`
2. Voit la timeline complète
3. Tape sur "6x50m Crawl" → s'expand inline
4. 6 lignes de saisie (rep 1→6), chacune : temps + coups de bras
5. Remplit, tape sur un autre exercice
6. Bouton "Enregistrer" → sauvegarde → toast

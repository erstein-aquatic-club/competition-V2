# Design — Feature "Découvrir mon neurotype"

**Date** : 2026-02-27
**Statut** : Validé

## Résumé

Ajouter un quiz de 30 questions dans la page Profil nageur permettant de déterminer son neurotype d'entraînement parmi 5 profils (1A Intensité, 1B Explosif, 2A Variation, 2B Sensation, Type 3 Contrôle). Le résultat est stocké en base et visible par le nageur et le coach.

## Décisions

- **Stockage** : Colonne JSONB `neurotype_result` dans `user_profiles` (pas de table supplémentaire)
- **Visibilité** : Nageurs uniquement pour passer le quiz ; coach peut voir le résultat
- **Refaisable** : Le nageur peut refaire le quiz, le nouveau résultat écrase l'ancien
- **Résultat riche** : Axé entraînement en salle (section principale), traits de personnalité et entraînement piscine en sections secondaires
- **Scoring client-side** : Calcul entièrement côté client, pas d'edge function nécessaire

## Structure JSONB

```json
{
  "dominant": "1B",
  "scores": { "1A": 72, "1B": 85, "2A": 65, "2B": 40, "3": 30 },
  "takenAt": "2026-02-27T14:30:00Z"
}
```

## UI Flow

1. **Page Profil** : Carte "Découvrir mon neurotype" (icône Brain) dans la grille 2x2
   - Si pas de résultat : "Découvrir mon neurotype" / "Quiz rapide"
   - Si résultat : badge neurotype dominant + "Refaire le quiz"
2. **Quiz** : Page intro → 30 questions une par une → barre de progression → résultat
3. **Résultat** : Header neurotype + barres de score 5 catégories + section Entraînement Salle (principale) + Traits + Piscine (accordéons)

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/lib/neurotype-quiz-data.ts` | Créer — questions, scoring, profils |
| `src/lib/neurotype-scoring.ts` | Créer — logique de calcul des scores |
| `src/components/neurotype/NeurotypQuiz.tsx` | Créer — composant quiz |
| `src/components/neurotype/NeurotypResult.tsx` | Créer — composant résultat |
| `src/pages/Profile.tsx` | Modifier — carte + toggle section |
| `src/lib/api/users.ts` | Modifier — inclure neurotype_result |
| `src/lib/api/types.ts` | Modifier — type NeurotypResult |
| Migration SQL | Créer — colonne neurotype_result |

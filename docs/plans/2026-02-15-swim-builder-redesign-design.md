# Design : Refonte SwimSessionBuilder coach

**Date** : 2026-02-15
**Statut** : Validé

## Contexte

Le SwimSessionBuilder actuel a deux modes séparés (condensé lecture seule / détaillé édition) qui fragmentent l'expérience. Le formulaire d'exercice est verbeux (~400px/exercice). Il manque la gestion de la récupération entre exercices (départ/repos).

## Objectifs

1. Fusionner les deux vues en une seule : vue condensée interactive
2. Ajouter la récupération entre exercices (départ OU repos)
3. Optimiser le formulaire d'exercice pour réduire l'espace vertical
4. Ajouter la duplication d'exercice
5. Mobile-first mais productif sur desktop

## Design

### Vue condensée interactive

La vue condensée actuelle devient la **seule vue**. Le toggle "Condensé / Détail" est supprimé.

- **Par défaut** : tous les exercices sont en mode compact (badges comme actuellement)
- **Tap sur un exercice** : il s'expand inline avec le formulaire d'édition optimisé
- **Tap ailleurs ou sur un autre exercice** : referme l'exercice ouvert, ouvre le nouveau
- Le reste de la session reste visible en compact

### Récupération Départ/Repos

Chaque exercice peut avoir SOIT un temps de départ SOIT un temps de repos (pas les deux).

```ts
interface SwimExercise {
  // ... existant ...
  rest: number | null;            // valeur en secondes
  restType: "departure" | "rest"; // type de récup
}
```

- **Départ** : "Départ toutes les 1'30" → restType="departure", rest=90
- **Repos** : "30s de repos" → restType="rest", rest=30
- Un SegmentedControl "Départ | Repos" + stepper min/sec
- Optionnel (null = pas de consigne)

### Affichage compact de la récup

- Départ : `⏱ Dép. 1'30`
- Repos : `⏸ Repos 30s`

### Formulaire exercice optimisé

Passe de ~400px à ~280px de hauteur :
- **Ligne 1** : `[reps] × [distance]m` + `[Nage ▾]` + `[Type ▾]`
- **Ligne 2** : Dots d'intensité (inchangé)
- **Ligne 3** : Toggle Départ/Repos + stepper min/sec
- **Ligne 4** : Équipements pills (inchangé)
- **Ligne 5** : Modalités textarea (repliable si vide)

### Duplication d'exercice

Bouton "Dupliquer" (icône Copy) sur chaque exercice, insère une copie juste après.

### Persistance

Ajout de `exercise_rest_type` dans le raw_payload :
```ts
{
  exercise_rest: number | null,
  exercise_rest_type: "departure" | "rest" | null
}
```

### Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `SwimSessionBuilder.tsx` | Vue unique, accordion inline, état ouvert/fermé par exercice, duplication |
| `SwimExerciseForm.tsx` | Layout compacté, champ Départ/Repos |
| `SwimCatalog.tsx` | Interface SwimExercise + restType, buildItemsFromBlocks, buildBlocksFromItems |
| `SwimSessionConsultation.tsx` | Affichage Dép./Repos selon exercise_rest_type |

### Ce qui ne change PAS

- Structure Bloc → Exercices (modèle de données)
- SessionMetadataForm (nom, durée, distance totale)
- FormActions header (retour, preview, sauver)
- Boutons déplacer/supprimer bloc
- API swim.ts et modèle en base
- Preview nageur

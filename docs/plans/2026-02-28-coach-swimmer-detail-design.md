# Design : Fiche nageur coach — Page à onglets

**Date :** 2026-02-28
**Statut :** Approuvé

## Contexte

Depuis le dashboard nageurs (CoachSwimmersOverview), le coach peut cliquer sur un nageur pour ouvrir sa fiche détaillée. La fiche est une page dédiée avec 4 onglets : Ressentis, Objectifs, Planification, Entretiens. En V1, seuls Ressentis et Objectifs sont fonctionnels.

## Navigation

- Route : `/#/coach/swimmer/:id` (hash-based, `:id` = `users.id` entier)
- Depuis CoachSwimmersOverview, click carte → navigate vers cette page
- Bouton retour ← ramène au dashboard nageurs (section swimmers de Coach.tsx)

## Header nageur

Avatar (ou initiale), nom complet, badge groupe, score de forme actuel. Compact, une ligne.

## Onglet 1 : Ressentis

Source : `dim_sessions` filtré par `athlete_id` via `api.getSessions()`.

Liste chronologique descendante. Chaque entrée :
- Date + créneau (Matin/Soir)
- 4 indicateurs en pastilles colorées (difficulté, fatigue, performance, engagement)
- Distance en mètres
- Commentaire (tronqué, expansible)
- Pagination : 20 sessions par défaut, bouton "Charger plus"

## Onglet 2 : Objectifs

Source : `objectives` filtré par `athlete_id` via `api.getObjectives()`.

Reprend la logique de CoachObjectivesScreen mais filtrée pour un seul nageur. CRUD complet (créer/modifier/supprimer objectifs chrono + texte, lier à une compétition).

Réutilise le formulaire existant de CoachObjectivesScreen.

## Onglets 3-4 : Planification & Entretiens (placeholder V1)

Affichent un message "Bientôt disponible" avec description :
- **Planification** : macro-cycles (blocs entre compétitions) + micro-cycles (semaines typées)
- **Entretiens** : comptes-rendus structurés avec liens croisés vers objectifs et planification

## Architecture composant

```
CoachSwimmerDetail.tsx (page principale)
├── Header (avatar, nom, groupe, forme)
├── Tabs
│   ├── SwimmerFeedbackTab.tsx (liste ressentis)
│   ├── SwimmerObjectivesTab.tsx (CRUD objectifs, réutilise logique existante)
│   ├── Placeholder "Planification"
│   └── Placeholder "Entretiens"
```

## Scope futur (V2)

- Onglet Planification : nouvelles tables `training_cycles` + `training_weeks`, UI timeline
- Onglet Entretiens : nouvelle table `interviews`, formulaire structuré, liens croisés objectifs/planification
- Graphique d'évolution forme dans l'onglet Ressentis

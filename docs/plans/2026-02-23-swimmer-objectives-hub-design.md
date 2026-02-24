# Design : Refonte Profil Hub + Objectifs Nageur

**Date** : 2026-02-23
**Scope** : Refonte page Profil en hub de navigation + vue objectifs nageur

## Contexte

Les coachs peuvent créer des objectifs structurés (chrono/texte/both) pour leurs nageurs via `CoachObjectivesScreen`. Il n'existe pas d'interface côté nageur pour visualiser ces objectifs ni en ajouter de personnels. La page Profil actuelle est un formulaire monolithique avec hero banner.

## Décisions validées

1. **Refonte hub complet** : le Profil devient un hub avec 4 cartes de navigation
2. **Lecture + complément nageur** : objectifs coach en read-only, nageur peut ajouter les siens
3. **Records** : lien simple vers `/#/records`
4. **Profil/Sécurité** : conservent le mécanisme bottom sheet existant

## Design

### Hub Profil (refonte de Profile.tsx)

- Hero compact : avatar/initiales, nom, badges groupe + rôle, bio
- Grille 2x2 de cartes :
  - **Mon profil** (Pen icon) → bottom sheet formulaire existant
  - **Sécurité** (Lock icon) → bottom sheet changement mot de passe existant
  - **Records** (Trophy icon) → navigation `/#/records`
  - **Objectifs** (Target icon) → sous-vue objectives (state machine, pas de route)
- Bouton déconnexion en bas

### Vue Objectifs Nageur (sous-vue dans Profile)

- Header avec bouton retour + titre "MON PLAN"
- Deux sections séparées :
  - **Objectifs du coach** (read-only, badge "Coach")
  - **Mes objectifs personnels** (CRUD complet)
- Distinction via `created_by` vs UID connecté
- Formulaire ajout en bottom sheet : type chrono/texte/both, épreuve, bassin, temps cible, texte libre
- Pas de lien compétition côté nageur (réservé coach)
- État vide : Target icon + message + CTA

### Changements techniques

- State machine `activeSection: "home" | "objectives"` (pattern Coach.tsx)
- API existante : `getAthleteObjectives()`, `createObjective()`, `deleteObjective()`
- Suppression du champ `user_profiles.objectives` du formulaire (remplacé par objectifs structurés)

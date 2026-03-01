# Design — Vue Compétition Nageur

**Date** : 2026-03-01
**Statut** : Approuvé

## Objectif

Créer une vue détail compétition côté nageur, accessible depuis 3 points d'entrée (calendrier, bannière, planification). Pour cette itération : page placeholder avec header réel et onglets placeholder.

## Navigation & Route

**Route** : `/#/competition/:competitionId`

**Points d'entrée** :
1. Calendrier Dashboard — clic sur un jour de compétition (cellule ambre + trophée)
2. Bannière InlineBanner — clic sur la bannière "Prochaine compétition"
3. Suivi > Planif. — clic sur une compétition dans la timeline

## Structure de la page

### Header fixe
- Bouton retour (← vers la page d'origine)
- Nom de la compétition
- Dates (unique ou plage) + lieu
- Badge `J-X` / "Aujourd'hui" / "Terminée"

### 4 onglets (Tabs)

**Onglet 1 — Courses** (défaut)
- Liste des courses du nageur : épreuve, jour, heure de départ
- Ajout/suppression de courses
- *Placeholder : maquette visuelle + "Bientôt disponible"*

**Onglet 2 — Routines**
- Routine par course (étapes avec offset en minutes avant la course)
- Templates réutilisables entre courses/compétitions
- *Placeholder : maquette visuelle + "Bientôt disponible"*

**Onglet 3 — Timeline**
- Sélecteur jour (multi-jours)
- Vue chronologique fusionnant courses + étapes routine
- Heures absolues calculées (heure course - offset)
- Différenciation visuelle : courses ambre, routines bleu/gris
- *Placeholder : maquette visuelle + "Bientôt disponible"*

**Onglet 4 — Checklist**
- Items cochables, ajout/suppression
- Templates réutilisables
- Barre de progression
- *Placeholder : maquette visuelle + "Bientôt disponible"*

## Modèle de données (futur, pas pour cette itération)

```
competition_races           — courses d'un nageur pour une compétition
competition_routines        — templates de routine (liste d'étapes)
competition_race_routines   — routine appliquée à une course
competition_checklists      — templates de checklist
competition_checklist_items — items d'une checklist (cochable)
```

## Itération actuelle (placeholder)

- Page `CompetitionDetail.tsx` avec header réel (données API existantes)
- 4 onglets avec contenu placeholder
- 3 points d'entrée câblés avec navigation fonctionnelle
- Pas de nouvelles tables DB
- Pas de nouvelles API

# Design : Suppression objectifs Progression + Cartes visuelles chrono

**Date** : 2026-02-24

## Partie 1 — Supprimer objectifs de Progress.tsx

- Supprimer query getAthleteObjectives(), helpers locaux (eventLabel, formatTargetTime, daysUntil), section JSX "Mes objectifs", imports inutilisés (Target, type Objective)

## Partie 2 — Cartes chrono visuelles avec jauge

- Récupérer swim_records du nageur pour trouver le meilleur temps par épreuve+bassin
- Mapping event_code → event_name pour matcher les records
- Jauge: temps actuel vs temps cible, barre de progression visuelle
- Fallback sans record: temps cible affiché en grand, pas de barre
- Bordure gauche colorée par nage (bleu NL, vert DOS, rouge BR, violet PAP, orange QN)
- Countdown J-X si compétition liée avec date future
- Distinction coach/perso maintenue (badge Coach, boutons modifier/supprimer)

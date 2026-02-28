# Design : Planification & Entretiens — Fiche nageur coach

**Date :** 2026-02-28
**Statut :** Approuvé

## Contexte

La fiche nageur coach (`CoachSwimmerDetail.tsx`) dispose de 4 onglets dont 2 sont des placeholders : Planification et Entretiens. Ce design couvre l'implémentation de ces 2 onglets.

## Onglet Planification

### Modèle de données

**Table `training_cycles` (macro-cycles) :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| group_id | INT FK groups NULL | Groupe concerné (null = individuel) |
| athlete_id | INT FK users NULL | Nageur concerné (null = groupe) |
| start_competition_id | UUID FK competitions | Compétition de départ |
| end_competition_id | UUID FK competitions | Compétition cible |
| name | TEXT NOT NULL | Nom libre (ex: "Prépa Interclubs") |
| notes | TEXT | Notes libres du coach |
| created_by | UUID FK auth.users | |
| created_at | TIMESTAMPTZ | |

Contrainte : au moins `group_id` ou `athlete_id` renseigné. Un nageur hérite de la planification de son groupe sauf s'il a une planification individuelle (override).

**Table `training_weeks` (micro-cycles) :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| cycle_id | UUID FK training_cycles ON DELETE CASCADE | Macro-cycle parent |
| week_start | DATE NOT NULL | Lundi de la semaine |
| week_type | TEXT | Type libre (foncier, affutage, etc.) |
| notes | TEXT | Notes libres |

### Logique

- Le coach crée un macro-cycle en choisissant 2 compétitions comme bornes.
- Les semaines entre les dates des 2 compétitions sont générées automatiquement (une ligne par lundi).
- Le coach type ensuite chaque semaine manuellement (texte libre avec autocomplétion des types déjà utilisés).
- Héritage : si le nageur n'a pas de planif individuelle, on affiche celle de son groupe avec un badge "Planification groupe". Un bouton "Personnaliser" copie la planif groupe en planif individuelle.

### UI

- **Header** : Sélecteur de macro-cycle (dropdown si le nageur en a plusieurs)
- **Timeline verticale** : Liste des semaines entre les 2 compétitions bornes
  - Chaque semaine = une ligne : `Sem. 1 (6-12 jan)` + badge coloré du type + notes
  - Semaine courante mise en surbrillance
  - Compétition de départ en haut, compétition cible en bas (badge distinct)
- **Édition inline** : Click sur une semaine → dropdown texte libre (autocomplétion) pour le type + textarea pour les notes
- **Création** : Bouton "Nouveau cycle" → Sheet avec sélecteur de 2 compétitions + nom. Semaines auto-générées.
- **Couleurs types** : Palette automatique basée sur le hash du nom du type (cohérent pour un même nom, pas de mapping manuel)

## Onglet Entretiens

### Modèle de données

**Table `interviews` :**

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| athlete_id | INT FK users NOT NULL | Nageur |
| status | TEXT NOT NULL | `draft_athlete` → `draft_coach` → `sent` → `signed` |
| date | DATE NOT NULL | Date de l'entretien |
| athlete_successes | TEXT | Réussites du dernier cycle (nageur) |
| athlete_difficulties | TEXT | Difficultés rencontrées (nageur) |
| athlete_goals | TEXT | Objectifs personnels (nageur) |
| athlete_commitments | TEXT | Ce qu'il met en place (nageur) |
| coach_review | TEXT | Commentaires du coach |
| coach_objectives | TEXT | Objectifs ajoutés par le coach |
| coach_actions | TEXT | Actions à suivre (coach) |
| current_cycle_id | UUID FK training_cycles NULL | Cycle courant au moment de l'entretien |
| submitted_at | TIMESTAMPTZ NULL | Date d'envoi nageur → coach |
| sent_at | TIMESTAMPTZ NULL | Date d'envoi coach → nageur |
| signed_at | TIMESTAMPTZ NULL | Date de signature nageur |
| created_by | UUID FK auth.users | Coach qui initie |
| created_at | TIMESTAMPTZ | |

### Workflow multi-phases

| Phase | Action | Statut | Coach voit | Nageur voit |
|-------|--------|--------|------------|-------------|
| 1. Initiation | Coach crée l'entretien | `draft_athlete` | Statut "En attente" uniquement | Formulaire éditable (4 sections) |
| 2. Envoi nageur | Nageur clique "Envoyer au coach" | `draft_coach` | Sections nageur (lecture seule) + ses sections (éditables) | Rien — entretien masqué |
| 3. Entretien | L'entretien a lieu en personne | — | — | — |
| 4. Envoi coach | Coach clique "Envoyer au nageur" | `sent` | Tout en lecture seule | Tout en lecture seule + bouton "Signer" |
| 5. Signature | Nageur signe | `signed` | Tout en lecture seule | Tout en lecture seule |

### Règles d'accès strictes

- `draft_athlete` : nageur édite ses sections. Coach ne voit **aucun contenu**, juste le statut.
- `draft_coach` : coach lit les sections nageur (lecture seule), édite ses propres sections. Nageur ne voit **plus l'entretien du tout**.
- `sent` : tout visible en lecture seule pour les deux. Le nageur découvre les remarques du coach.
- `signed` : historique figé.

Le coach ne touche jamais aux sections nageur. Le nageur ne touche jamais aux sections coach. Chacun découvre la partie de l'autre seulement au moment prévu.

### UI côté coach (onglet Entretiens de la fiche nageur)

- Liste chronologique descendante des entretiens
- Chaque entrée : date + statut (badge coloré) + aperçu
- Bouton "Nouvel entretien" → crée en `draft_athlete`
- Click sur un entretien → Sheet avec le formulaire (sections visibles selon statut/phase)
- **Panneau contextuel** (accordéon sous le formulaire, visible en phase `draft_coach`) :
  - Objectifs : liste des objectifs du nageur, bouton "Ajouter un objectif"
  - Planification : résumé compact du cycle courant (nom + semaine actuelle + type)
  - Compétitions : prochaines compétitions assignées

### UI côté nageur

- Accessible depuis le Profil (nouvelle section "Mes entretiens")
- Si un entretien est en `draft_athlete` → formulaire éditable (4 sections nageur)
- Si en `sent` → lecture seule (tout) + bouton "Signer"
- Si `signed` → lecture seule, historique
- Si `draft_coach` → entretien masqué (pas visible)

## Architecture composants

```
CoachSwimmerDetail.tsx
├── SwimmerPlanningTab.tsx (timeline cycles + semaines)
│   └── CycleFormSheet.tsx (création/édition cycle)
├── SwimmerInterviewsTab.tsx (liste + formulaire entretiens coach)
│   └── InterviewFormSheet.tsx (formulaire coach phase 2 + panneau contextuel)

Profile.tsx / Dashboard.tsx
└── AthleteInterviewsSection.tsx (liste entretiens nageur)
    └── AthleteInterviewForm.tsx (formulaire nageur phase 1)
```

## Modules API

- `src/lib/api/planning.ts` — CRUD cycles + semaines
- `src/lib/api/interviews.ts` — CRUD entretiens + transitions de statut

## RLS

- `training_cycles` / `training_weeks` : coach/admin CRUD, nageur lecture (son groupe ou sa planif individuelle)
- `interviews` : accès conditionnel selon `status` (cloisonnement par phase, implémenté via RLS row-level sur le statut)

## Ordre d'implémentation

1. Migrations SQL (3 tables + RLS + indexes)
2. API planning (cycles + semaines)
3. UI Planification (onglet)
4. API interviews
5. UI Entretiens coach (onglet)
6. UI Entretiens nageur (Profil)

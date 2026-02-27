# Design : Dashboard synthétique nageurs (Coach)

**Date :** 2026-02-27
**Statut :** Approuvé

## Contexte

La section "Nageurs" du coach est actuellement une liste basique (nom, groupe, IUF, bouton Fiche). On la remplace par un dashboard en grille de cartes avec 3 KPIs par nageur : forme, assiduité, objectifs.

## Architecture

**Nouveau composant :** `src/pages/coach/CoachSwimmersOverview.tsx`

Remplace le rendu inline actuel de la section `swimmers` dans `Coach.tsx`. Le composant :
- Charge les athlètes via `api.getAthletes()` (existant)
- Charge les sessions récentes (toutes, sur les 30 derniers jours) pour calculer forme + assiduité
- Charge les objectifs via `api.getObjectives()` (existant)
- Affiche une grille de cards filtrable par groupe

## Card nageur

| Élément | Source | Calcul |
|---------|--------|--------|
| **Nom + avatar** | `user_profiles.display_name` + `avatar_url` | Direct |
| **Groupe** | `group_members` → `groups.name` | Badge coloré |
| **Forme** | Dernier ressenti (`dim_sessions`) | Moyenne inversée des 4 indicateurs (1-5), pastille colorée |
| **Assiduité** | Sessions loggées vs assignées (30j) | Pourcentage + mini-barre |
| **Objectifs** | `objectives` filtrés par `athlete_id` | Compteur "X/Y atteints" |
| **Action** | Click carte entière | Navigate vers `/progress` avec `setSelectedAthlete` |

## Indicateur de forme

Moyenne des 4 valeurs du dernier ressenti avec inversion difficulté/fatigue :

```
forme = ((6 - difficulté) + (6 - fatigue) + performance + engagement) / 4
```

Pastille : vert >= 3.5, jaune >= 2.5, rouge < 2.5.

## Assiduité

- Numérateur : sessions loggées dans `dim_sessions` sur 30 jours
- Dénominateur : sessions assignées via `session_assignments` sur 30 jours
- Fallback si pas d'assignations : ratio basé sur créneaux par défaut du groupe
- Affichage : pourcentage + mini-barre de progression

## Filtres

- **Par groupe** : chips des groupes permanents
- **Tri** : par nom (défaut), par forme (asc), par assiduité (asc)

## Données

Pas de nouvelle table. Tout calculé côté client :
- `dim_sessions` → ressentis
- `session_assignments` → assignations
- `objectives` → objectifs
- `group_members` + `groups` → groupes

Nouvelle fonction API : `getRecentSessionsAllAthletes()` — fetch bulk des sessions des 30 derniers jours.

## Scope futur (hors V1)

- Fiche nageur enrichie (page dédiée)
- Entretiens de suivi (comptes-rendus, objectifs, planification créneaux)
- Neurotype intégré dans la carte
- Prochaine compétition assignée

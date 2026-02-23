# Design — Compétitions & Objectifs Coach

**Date** : 2026-02-23
**Statut** : Validé

## Contexte

Les coachs n'ont actuellement aucun outil pour gérer les compétitions ni les objectifs des nageurs. Les objectifs sont un simple champ texte libre dans `user_profiles.objectives`. Les performances FFN sont importées mais en lecture seule.

## Besoin

1. **Onglet Compétitions** : calendrier simple de compétitions (nom, date, lieu) servant de jalons/échéances visibles par les nageurs sur leur calendrier principal avec compte à rebours J-X.
2. **Onglet Objectifs** : objectifs par nageur (chrono et/ou texte libre), optionnellement liés à une compétition, visibles par le nageur sur sa page Progression.

## Approche retenue

**Approche A — Deux onglets séparés** dans la navigation coach (`CoachSection`), indépendants l'un de l'autre.

## Modèle de données

### Table `competitions`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK, gen_random_uuid) | Identifiant unique |
| `name` | TEXT NOT NULL | Nom de la compétition |
| `date` | DATE NOT NULL | Date de début |
| `end_date` | DATE | Date de fin (multi-jours, optionnel) |
| `location` | TEXT | Lieu |
| `description` | TEXT | Description/notes optionnelles |
| `created_by` | UUID FK → auth.users | Coach créateur |
| `created_at` | TIMESTAMPTZ DEFAULT now() | Date de création |

**RLS** : SELECT pour tous les utilisateurs authentifiés. INSERT/UPDATE/DELETE pour coach et admin uniquement.

### Table `objectives`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK, gen_random_uuid) | Identifiant unique |
| `athlete_id` | UUID FK → auth.users NOT NULL | Nageur ciblé |
| `competition_id` | UUID FK → competitions (nullable) | Compétition liée (optionnel) |
| `event_code` | TEXT (nullable) | Code épreuve FFN (ex: "100NL") |
| `pool_length` | INT (nullable) | 25 ou 50 (bassin) |
| `target_time_seconds` | NUMERIC (nullable) | Temps cible en secondes |
| `text` | TEXT (nullable) | Objectif texte libre |
| `created_by` | UUID FK → auth.users | Coach créateur |
| `created_at` | TIMESTAMPTZ DEFAULT now() | Date de création |

**Contrainte** : CHECK (`target_time_seconds IS NOT NULL OR text IS NOT NULL`).

**RLS** : SELECT pour le nageur concerné (`athlete_id = auth.uid()`) + coach/admin. INSERT/UPDATE/DELETE pour coach/admin uniquement.

## UI — Coach

### Onglet Compétitions

- **Liste chronologique** : prochaines compétitions en haut, passées grisées en bas
- **Carte compétition** : nom, date (+ "J-X" si à venir), lieu, badge "Passée" si terminée
- **Bouton "+"** en header pour créer
- **Drawer de création/édition** (Sheet bottom) :
  - Nom (requis), Date (requis), Date de fin (optionnel, toggle multi-jours), Lieu, Description
  - Bouton Supprimer en mode édition (avec Dialog de confirmation)
- **Tap** sur une compétition → ouvre le drawer d'édition

### Onglet Objectifs

- **Sélecteur de nageur** en haut (dropdown recherche, même pattern que les assignations)
- **Liste des objectifs** du nageur sélectionné :
  - Chrono : épreuve + temps cible (ex: "100m NL — 1:05.00")
  - Texte : le texte de l'objectif
  - Badge compétition si lié
- **Bouton "+"** pour ajouter un objectif
- **Drawer de création/édition** :
  - Nageur (pré-rempli)
  - Type : toggle Chrono / Texte / Les deux
  - Si chrono : Épreuve (select codes FFN), Bassin (25m/50m), Temps cible (mm:ss.cc)
  - Si texte : champ multi-lignes
  - Compétition liée (select optionnel, compétitions à venir)
  - Bouton Supprimer en mode édition

## UI — Nageur

### Calendrier principal (Dashboard)

- Les compétitions apparaissent comme événements spéciaux
- Icône Trophy + couleur différenciée (orange/doré)
- Affichage "J-X" proéminent sur la prochaine compétition

### Page Progression

- Nouvelle section "Mes objectifs"
- Liste des objectifs fixés par le coach
- Chrono : épreuve + temps cible
- Texte : texte de l'objectif
- Si lié à une compétition : mention + "J-X"

## Hors périmètre

- Pas de comparaison automatique objectif vs performances FFN
- Pas d'objectifs de groupe (uniquement individuels)
- Pas de gestion des inscriptions/épreuves dans les compétitions
- Pas de saisie de résultats post-compétition

# Design: Slot-Centric Session Calendar (Refonte Bibliothèque Séances)

**Date:** 2026-03-01
**Chantier:** §85

## Objectif

Remplacer le point d'entrée SwimCatalog par un calendrier centré sur les créneaux d'entraînement (`training_slots`). Le coach voit les créneaux de la semaine, crée des séances dessus, et contrôle leur visibilité nageur via une date de publication. L'assignation aux groupes est automatique.

## Principes

- Le créneau récurrent est l'unité de planification (pas la séance isolée)
- L'assignation aux groupes est automatique (déduite de `training_slot_assignments`)
- La bibliothèque de templates (`swim_sessions_catalog`) reste accessible en arrière-plan
- La visibilité nageur est contrôlée par `visible_from` (date), pas un flag boolean
- La notification push est envoyée 30 min avant la fin du créneau (rappel ressenti)

## Modèle de données

### Migration: `session_assignments`

```sql
ALTER TABLE session_assignments
  ADD COLUMN visible_from DATE DEFAULT NULL,
  ADD COLUMN training_slot_id UUID REFERENCES training_slots(id) DEFAULT NULL,
  ADD COLUMN notified_at TIMESTAMPTZ DEFAULT NULL;
```

| Colonne | Type | Rôle |
|---------|------|------|
| `visible_from` | `DATE` | `NULL` = visible immédiatement. Sinon visible à partir de cette date. |
| `training_slot_id` | `UUID` | Lien vers le créneau récurrent source. Permet regroupement et duplication. |
| `notified_at` | `TIMESTAMPTZ` | Timestamp de l'envoi de la notification push. `NULL` = pas encore notifié. |

### RLS nageur modifié

Le policy `SELECT` pour les athlètes ajoute :
```sql
AND (visible_from IS NULL OR visible_from <= CURRENT_DATE)
```

Le policy coach reste inchangé (voit tout).

### Pas de nouvelle table

On réutilise `session_assignments` + `training_slots` + `training_slot_assignments` + `swim_sessions_catalog`.

## Sources de données

| Source | Table/API existante | Usage |
|--------|---------------------|-------|
| Créneaux récurrents | `training_slots` + `training_slot_assignments` | Grille de base du calendrier |
| Exceptions | `training_slot_overrides` | Créneaux annulés/modifiés à une date précise |
| Séances assignées | `session_assignments` (+ `visible_from`, `training_slot_id`) | État de chaque créneau (vide/brouillon/publié) |
| Templates | `swim_sessions_catalog` + `swim_session_items` | Source pour dupliquer/créer |

## UX: Vue calendrier des créneaux

### Point d'entrée

Le bouton "Natation" du coach dashboard ouvre le calendrier des créneaux (remplace SwimCatalog). La bibliothèque reste accessible via un lien "Bibliothèque" dans le header du calendrier.

### Layout

Vue semaine (lun→dim), navigation par flèches + bouton "Aujourd'hui". Chaque jour affiche ses créneaux sous forme de cards empilées verticalement. Mobile-first, pleine largeur.

### États d'un créneau

| État | Visuel | Condition |
|------|--------|-----------|
| Vide | Bordure pointillée, icône "+" | Pas de `session_assignment` pour ce créneau+date |
| Brouillon | Card pleine, badge orange "Brouillon" | Assignment existe, `visible_from > today` |
| Publié | Card pleine, badge vert "Publié" | Assignment existe, `visible_from IS NULL OR <= today` |
| Annulé | Card barrée, texte grisé | `training_slot_override` avec `status='cancelled'` |

### Infos par créneau

- Heure (ex: "08:00–09:30")
- Lieu
- Groupes assignés (badges colorés)
- Si séance : nom, distance totale
- Indicateur visibilité (date de publication ou "Publié")

### Navigation passée

Le coach navigue librement dans le passé. Les créneaux passés avec séance affichent un bouton "Dupliquer" pour copier le contenu vers un créneau futur vide.

### Actions créneau vide

Clic → bottom sheet :
1. **"Nouvelle séance"** → ouvre le SwimSessionBuilder inline
2. **"Depuis la bibliothèque"** → picker de templates → duplique le contenu

### Actions créneau avec séance

Clic → bottom sheet :
- Aperçu résumé de la séance (blocs, distance)
- **"Modifier"** → builder pré-rempli
- **"Dupliquer vers..."** → sélecteur de créneaux futurs vides
- **"Visibilité"** → date picker pour `visible_from`
- **"Supprimer"** → confirmation → supprime les assignments

## Flux de création & assignation automatique

1. Coach clique sur un créneau vide (ex: Mardi 08:00, Piscine A)
2. Crée ou choisit une séance (builder inline ou bibliothèque)
3. Groupes pré-cochés (issus de `training_slot_assignments` du créneau)
4. Le coach peut décocher un groupe si besoin
5. Choisit `visible_from` : par défaut = date du créneau (publication le jour J)
6. Sauvegarde → **un `session_assignment` par groupe coché** :
   - `swim_catalog_id` = la séance
   - `target_group_id` = chaque groupe coché
   - `scheduled_date` = la date concrète du créneau
   - `scheduled_slot` = déduit du `start_time` (matin si < 13:00, soir sinon)
   - `training_slot_id` = le créneau source
   - `visible_from` = la date choisie
7. Notifications push différées (voir section dédiée)

### Duplication

- Coach navigue vers un créneau passé avec séance
- Clique "Dupliquer vers..." → liste des créneaux futurs vides (même slot récurrent ou tous)
- Sélectionne un ou plusieurs créneaux cibles
- Le contenu est copié, les assignments créés pour chaque cible
- `visible_from` demandé (par défaut = date du créneau cible)

## Notifications push

### Deux types de notification

1. **Publication** : quand `visible_from` est atteint, le nageur peut voir la séance. Pas de notification push à ce moment — la séance apparaît simplement dans le dashboard.

2. **Rappel ressenti** : notification push envoyée **30 min avant la fin du créneau** le jour de la séance. Message : "N'oublie pas d'enregistrer ton ressenti pour ta séance !"

### Mécanisme technique

Un pg_cron job toutes les 15 minutes cherche les assignments à notifier :

```sql
SELECT sa.id, sa.target_group_id, ts.end_time
FROM session_assignments sa
JOIN training_slots ts ON ts.id = sa.training_slot_id
WHERE sa.training_slot_id IS NOT NULL
  AND (sa.visible_from IS NULL OR sa.visible_from <= CURRENT_DATE)
  AND sa.notified_at IS NULL
  AND sa.scheduled_date = CURRENT_DATE
  AND (ts.end_time - INTERVAL '30 minutes') <= CURRENT_TIME;
```

Pour chaque résultat : créer `notifications` + `notification_targets` pour les membres du groupe, marquer `notified_at = now()`.

## Côté nageur — impact

Aucune modification du frontend nageur. Le RLS filtre automatiquement les séances non publiées. La notification arrive 30 min avant la fin du créneau.

Séquence :
1. Coach crée séance mardi pour vendredi 08:00–09:30, `visible_from = jeudi`
2. Jeudi : séance visible dans le dashboard
3. Vendredi 09:00 : notification push "Enregistre ton ressenti"
4. Nageur saisit son ressenti

## Architecture composants

```
src/
├── pages/coach/
│   ├── CoachSlotCalendar.tsx      # Calendrier semaine des créneaux (NOUVEAU)
│   ├── SlotSessionSheet.tsx       # Bottom sheet : aperçu / créer / modifier (NOUVEAU)
│   ├── SlotTemplatePicker.tsx     # Picker bibliothèque templates (NOUVEAU)
│   └── SwimCatalog.tsx            # Inchangé (accessible via lien "Bibliothèque")
├── hooks/
│   └── useSlotCalendar.ts         # Hook : matérialisation créneaux + croisement assignments (NOUVEAU)
├── lib/api/
│   └── assignments.ts             # Modifié : visible_from, training_slot_id, bulk create
└── supabase/migrations/
    └── 000XX_add_visible_from.sql # Migration : ALTER + RLS + pg_cron
```

### `useSlotCalendar(weekOffset: number)`

- 3 queries parallèles via React Query : `training_slots`, `session_assignments` (semaine), `slot_overrides` (semaine)
- Matérialise les créneaux récurrents en dates concrètes pour la semaine affichée
- Croise avec assignments → retourne `SlotInstance[]` avec état
- Expose : `slots`, `isLoading`, `weekOffset`, `setWeekOffset`, `navigateToday()`

```typescript
type SlotState = 'empty' | 'draft' | 'published' | 'cancelled';

interface SlotInstance {
  date: string;              // ISO YYYY-MM-DD
  slot: TrainingSlot;        // Le créneau récurrent
  groups: TrainingSlotAssignment[]; // Groupes assignés au créneau
  state: SlotState;
  assignment?: SessionAssignment; // L'assignment si séance présente
  override?: TrainingSlotOverride; // L'exception si annulé/modifié
}
```

### `CoachSlotCalendar`

- Grille 7 jours × N créneaux par jour
- Navigation semaine (←→ + "Aujourd'hui")
- Clic créneau → ouvre `SlotSessionSheet`
- Header avec lien "Bibliothèque" vers SwimCatalog

### `SlotSessionSheet`

- Bottom sheet contextuel
- Créneau vide : choix "Nouvelle" ou "Depuis biblio"
- Créneau avec séance : aperçu + "Modifier" / "Dupliquer" / "Visibilité" / "Supprimer"
- Intègre `SwimSessionBuilder` pour création/modification
- Gère le choix de groupes (checkboxes pré-cochées) et `visible_from`

### `SlotTemplatePicker`

- Liste scrollable des templates de la bibliothèque
- Recherche par nom
- Clic → duplique le contenu dans le créneau

## Non-scope

- Pas de modification du frontend nageur (Dashboard.tsx)
- Pas de suppression de SwimCatalog (reste accessible)
- Pas de drag & drop
- Pas de vue mensuelle (semaine uniquement pour v1)
- Pas de séances musculation dans ce chantier (swim only)

## Tests

- `useSlotCalendar.test.ts` : matérialisation créneaux, croisement assignments, calcul états
- Tests unitaires pour les fonctions de duplication et bulk create
- Tests RLS : vérifier que `visible_from` filtre correctement côté nageur

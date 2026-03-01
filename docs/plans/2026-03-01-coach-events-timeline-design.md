# Design: Coach Events Timeline (Tableau de Bord des Échéances)

**Date:** 2026-03-01
**Chantier:** §84

## Objectif

Composant autonome affichant chronologiquement les échéances clés du coach :
compétitions à venir, entretiens en attente, fins de macro-cycles. Brique isolée, ne touche pas Coach.tsx.

## Sources de données

| Source | API existante | Données extraites |
|--------|--------------|-------------------|
| Compétitions | `getCompetitions()` | date, nom, lieu, nageurs assignés |
| Entretiens | **Nouveau** `getAllPendingInterviews()` | date, statut, athlete_name |
| Macro-cycles | `getTrainingCycles()` | end_competition_date, nom, nageur/groupe |

## Architecture

```
src/
├── hooks/
│   └── useCoachEventsTimeline.ts    # Hook: fetch parallèle + normalisation
├── lib/api/
│   └── interviews.ts               # Ajout: getAllPendingInterviews()
├── components/coach/
│   └── CoachEventsTimeline.tsx      # UI: timeline verticale premium
└── __tests__/
    └── useCoachEventsTimeline.test.ts
```

## Types

```typescript
type EventType = 'competition' | 'interview' | 'cycle_end';
type EventUrgency = 'overdue' | 'imminent' | 'upcoming' | 'future';

interface TimelineEvent {
  id: string;
  type: EventType;
  date: string;              // ISO YYYY-MM-DD
  title: string;
  subtitle?: string;
  athleteName?: string;
  athleteId?: number;
  urgency: EventUrgency;
  metadata: Record<string, unknown>;
}
```

## Hook `useCoachEventsTimeline`

- 3 `useQuery` en parallèle via React Query
- Query keys: `["coach-events-competitions"]`, `["coach-events-interviews"]`, `["coach-events-cycles"]`
- Normalisation en `TimelineEvent[]` triés par date croissante
- Filtres exposés: `typeFilter: EventType | 'all'`, `periodDays: 7 | 30 | 90 | 0`
- Calcul urgency: overdue (<today), imminent (≤7j), upcoming (≤30j), future (>30j)
- Returns: `{ events, isLoading, typeFilter, setTypeFilter, periodDays, setPeriodDays, counts }`

## API `getAllPendingInterviews()`

Nouvelle fonction dans `interviews.ts`:
- Requête Supabase: `interviews` avec join `users` sur `athlete_id`
- Filtre: `status != 'signed'` (draft_athlete, draft_coach, sent)
- Select: `id, athlete_id, status, date, users(display_name)`
- Retourne: `Interview[]` enrichi de `athlete_name`

## UI `CoachEventsTimeline`

### Layout
- Header: titre + filtres (ToggleGroup type + Select période)
- Corps: timeline verticale `border-l-2 border-border`
- Points colorés par type sur la ligne
- Cards événements à droite de la ligne

### Couleurs par type
- Compétition: `bg-blue-500` (point) + `border-blue-200` (card)
- Entretien: `bg-amber-500` + `border-amber-200`
- Fin cycle: `bg-violet-500` + `border-violet-200`

### Badges urgency
- overdue: `bg-red-100 text-red-700`
- imminent: `bg-amber-100 text-amber-700`
- upcoming: `bg-sky-100 text-sky-700`
- future: `bg-muted text-muted-foreground`

### États
- Loading: 3 Skeleton items (pulse)
- Empty: Icône Calendar + "Aucune échéance à venir"
- Erreur: Toast via pattern existant

### Responsive
- Mobile: pleine largeur, cards empilées
- Desktop: max-w-2xl centré

## Tests

- `useCoachEventsTimeline.test.ts`: normalisation, tri, filtres, calcul urgency
- Mocks des 3 API calls
- Cas limites: données vides, dates passées, filtres croisés

## Non-scope

- Pas de modification de Coach.tsx (intégration future)
- Pas de CRUD depuis la timeline (lecture seule)
- Pas de notifications push

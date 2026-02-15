# Design : Refonte calendrier — Pills dynamiques par creneau

**Date** : 2026-02-15
**Statut** : Approuve

## Probleme

Le calendrier du Dashboard affiche toujours 2 pills par jour (AM/PM), independamment du nombre de seances attendues par l'athlete. Le fond de cellule porte toute l'information de completion (vert=fait, gris=rien), mais ne montre pas **quel creneau** est fait ou pas.

L'athlete ne peut pas identifier instantanement ce qui reste a faire.

## Principe

Chaque cellule affiche exactement le nombre de pills correspondant aux seances attendues. Les pills sont le **seul indicateur de completion** — le fond reste neutre.

## Regles visuelles

| Situation | Rendu |
|-----------|-------|
| Repos (total=0) | Fond `bg-muted/30`, pas de pills, icone `Minus` grisee en bas a droite |
| 1 seance AM | 1 pill a gauche, espace vide a droite |
| 1 seance PM | Espace vide a gauche, 1 pill a droite |
| 2 seances | 2 pills cote a cote |
| Pill renseignee | `bg-status-success` (vert) |
| Pill non renseignee | `bg-muted-foreground/30` (gris) |

## Fond de cellule

- Jours actifs (total > 0) : `bg-card border-border`
- Jours repos (total = 0) : `bg-muted/30 border-border`
- Aujourd'hui : `ring-2 ring-primary/50`
- Selectionne : `ring-2 ring-primary/30`

## Structure de donnees

Le `status` actuel `{ completed, total }` est insuffisant. Nouveau format :

```typescript
type SlotStatus = {
  slotKey: "AM" | "PM";
  expected: boolean;
  completed: boolean;
};

// DayCell recoit :
status: {
  slots: SlotStatus[];
  total: number;
  completed: number;
};
```

## Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `src/hooks/useDashboardState.ts` | Enrichir `completionByISO` avec detail par slot |
| `src/components/dashboard/DayCell.tsx` | Refonte rendu : pills dynamiques, fond neutre, icone repos |
| `src/components/dashboard/CalendarGrid.tsx` | Adapter le type `status` passe a DayCell |
| `src/components/dashboard/CalendarHeader.tsx` | Pills dynamiques dans le header |
| `src/components/dashboard/DayCell.stories.tsx` | Mettre a jour les stories |
| `src/components/dashboard/CalendarHeader.stories.tsx` | Mettre a jour les stories |

## Decisions

1. **Pills positionnees AM=gauche, PM=droite** : l'athlete voit visuellement quel creneau correspond
2. **Fond neutre pour tous les jours actifs** : les pills portent l'information, le fond ne fait que distinguer repos vs actif
3. **Gris neutre pour pills non faites** : discret, le vert ressort par contraste sans creer d'urgence visuelle
4. **Icone Minus pour repos** : signale clairement que le jour est "off" sans surcharger

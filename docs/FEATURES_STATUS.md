# État des fonctionnalités

*Dernière mise à jour : 2026-02-16 (§32 Dossiers musculation)*

## Légende

| Statut | Signification |
|--------|---------------|
| ✅ | Fonctionnel |
| ⚠️ | Partiel / En cours |
| ❌ | Non implémenté |
| 🔧 | Dépend de la configuration |
| 🗓️ | Planifié (roadmap) |

---

## Feature Flags

Fichier : `src/lib/features.ts`

```typescript
export const FEATURES = {
  strength: true,        // ✅ Musculation nageur
  hallOfFame: true,      // ✅ Hall of Fame
  coachStrength: true,   // ✅ Builder musculation coach
} as const;
```

Tous les feature flags sont activés.

---

## Matrice des fonctionnalités

### Authentification

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Login email/password | ✅ | `Login.tsx`, `auth.ts` | Supabase Auth |
| Gestion des rôles | ✅ | `auth.ts` | nageur, coach, comité, admin |
| Refresh token | ✅ | `auth.ts` | JWT automatique Supabase |
| Inscription self-service | ✅ | `Login.tsx`, `auth.ts`, `App.tsx`, `Admin.tsx` | Option B : validation coach/admin, écran post-inscription, gate approbation |
| Approbation inscriptions | ✅ | `Admin.tsx`, `api.ts` | Section "Inscriptions en attente" pour coach/admin |
| Mot de passe oublié | ✅ | `Login.tsx`, `App.tsx`, `auth.ts` | Flow complet : email de reset + route `/#/reset-password` + detection token recovery |
| Création compte (admin) | ✅ | `Admin.tsx` | Via panel admin |
| Désactivation compte | 🔧 | `api.ts` | Retourne "skipped" si Supabase offline |

### Natation — Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Dashboard calendrier | ✅ | `Dashboard.tsx`, `DayCell.tsx`, `CalendarHeader.tsx`, `CalendarGrid.tsx`, `useDashboardState.ts` | Pills dynamiques par créneau (AM/PM), vert si rempli, gris si attendu, repos avec icône Minus |
| Saisie ressenti | ✅ | `Dashboard.tsx` | Difficulté, fatigue, perf, engagement, distance, commentaire |
| Notes techniques exercice | ✅ | `TechnicalNotesSection.tsx`, `swim-logs.ts` | Temps/rep, tempo, coups de bras, notes par exercice |
| Historique notes techniques | ✅ | `SwimExerciseLogsHistory.tsx` | Vue chronologique groupée par date |
| Présence/absence | ✅ | `Dashboard.tsx` | Toggle par créneau |
| Consultation séances | ✅ | `SwimSessionView.tsx` | Liste + détail |
| Historique/Progression | ✅ | `Progress.tsx` | KPIs, graphiques Recharts, filtrage période |

### Natation — Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création séance | ✅ | `SwimCatalog.tsx`, `SwimSessionBuilder.tsx` | Blocs, exercices, intensité, matériel, récupération départ/repos |
| Édition séance | ✅ | `SwimCatalog.tsx`, `SwimSessionBuilder.tsx` | Vue accordion inline, duplication exercice |
| Récupération entre exercices | ✅ | `SwimExerciseForm.tsx`, `SwimSessionConsultation.tsx` | Départ (temps de départ) OU Repos (pause), affiché côté nageur |
| Catalogue | ✅ | `SwimCatalog.tsx` | Dossiers/sous-dossiers, archivage BDD, restauration, déplacement |
| Intensité Progressif | ✅ | `IntensityDots.tsx`, `IntensityDotsSelector.tsx` | Intensité "Prog" avec icône TrendingUp, couleur orange |
| Assignation | ✅ | `CoachAssignScreen.tsx` | Nage + muscu |

### Musculation — Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste séances assignées | ✅ | `Strength.tsx` | Segmented control, cards compactes, auto-start, AlertDialog |
| Preview séance | ✅ | `Strength.tsx` | Mode "reader", dock masqué, lancement unique |
| Mode focus (WorkoutRunner) | ✅ | `WorkoutRunner.tsx` | Header compact, bouton "Passer", notes visibles, timer simplifié |
| Saisie charge/reps | ✅ | `WorkoutRunner.tsx` | Auto-sauvegarde, volume formaté fr-FR |
| Historique | ✅ | `Strength.tsx` | Tab "Historique", 1RM, graphiques |
| Fiche exercice avec GIF | 🔧 | `Strength.tsx` | Dépend des URLs dans `dim_exercices` |

### Musculation — Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Builder séance | ✅ | `StrengthCatalog.tsx`, `StrengthSessionBuilder.tsx`, `StrengthExerciseCard.tsx` | Mobile-first : cards expand/collapse, DragDropList touch-friendly, SessionMetadataForm partagé (§30) |
| Catalogue exercices | ✅ | `StrengthCatalog.tsx` | Par cycle (endurance/hypertrophie/force), barre de recherche, liste compacte (§30) |
| Dossiers séances | ✅ | `StrengthCatalog.tsx`, `FolderSection.tsx`, `MoveToFolderPopover.tsx` | 1 niveau, renommage inline, suppression, déplacement (§32) |
| Dossiers exercices | ✅ | `StrengthCatalog.tsx`, `FolderSection.tsx`, `MoveToFolderPopover.tsx` | Même système que séances, types séparés (§32) |
| Assignation | ✅ | `CoachAssignScreen.tsx` | Via écran d'assignation partagé |

### Records & FFN

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Records personnels (CRUD) | ✅ | `Records.tsx` | Saisie manuelle + toggle 25m/50m |
| Sync FFN (records perso) | ✅ | Edge Function `ffn-sync` | Scrape Extranat, meilleur temps par épreuve |
| Import toutes performances | ✅ | Edge Function `ffn-performances` | Import historique complet depuis FFN |
| Records club (consultation) | ✅ | `RecordsClub.tsx` | UI avec filtres + indicateur dernière MAJ, alimentée par import |
| Import records club (FFN) | ✅ | `RecordsAdmin.tsx`, Edge Function `import-club-records` | Import bulk + recalcul records club |
| Gestion nageurs records | ✅ | `RecordsAdmin.tsx` | Ajout/édition/activation swimmers |
| Hall of Fame | ✅ | `HallOfFame.tsx` | Top 5 nage + muscu |
| Gestion coach imports perfs | ✅ | `RecordsAdmin.tsx` | Import individuel par nageur + historique des imports |

### Messagerie

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste threads | ✅ | `Notifications.tsx` | Par expéditeur/groupe |
| Envoi message | ✅ | `CoachMessagesScreen.tsx` | Coach → nageur/groupe |
| Réponse | ✅ | `Notifications.tsx` | Dans thread existant |
| Indicateur non-lu | ✅ | `AppLayout.tsx` | Badge sur nav |
| Mark as read | ✅ | `api.ts` | |

### Pointage heures

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création shift | ✅ | `Administratif.tsx` | Date, heures, lieu, trajet |
| Édition shift | ✅ | `Administratif.tsx` | |
| Lieux de travail | ✅ | `Administratif.tsx` | Gestion CRUD lieux |
| Dashboard totaux | ✅ | `Administratif.tsx` | Semaine/mois, graphiques |
| Vue comité | ✅ | `Comite.tsx` | Tous les coachs, filtrage |

### Admin

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste utilisateurs | ✅ | `Admin.tsx` | Recherche, filtre rôle |
| Création utilisateur | 🔧 | `Admin.tsx` | Retourne "skipped" si offline |
| Modification rôle | 🔧 | `Admin.tsx` | Idem |
| Désactivation | 🔧 | `Admin.tsx` | Idem |

### Profil

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Affichage infos | ✅ | `Profile.tsx` | Nom, anniversaire, groupe, objectifs, bio |
| Édition profil | ✅ | `Profile.tsx` | Avatar, objectifs, groupe, FFN IUF |
| Changement mot de passe | ✅ | `Profile.tsx` | Via Supabase Auth |

### UI/UX & Design System (Phase 6)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| PWA Icons (EAC branding) | ✅ | `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/favicon.png` | 4 tailles (192, 512, 180, 128), logo EAC rouge |
| Theme color (EAC red) | ✅ | `index.html`, `public/manifest.json` | #E30613 (was #3b82f6) |
| Login page moderne | ✅ | `Login.tsx` | Split layout (hero + form), animations Framer Motion, password toggle |
| Animations Framer Motion | ✅ | `Dashboard.tsx`, `Strength.tsx`, `Records.tsx`, `Profile.tsx`, `HallOfFame.tsx` | fadeIn, slideInFromBottom, staggerChildren, successBounce |
| Animation library | ✅ | `src/lib/animations.ts` | 8 presets: fadeIn, slideUp, scaleIn, staggerChildren, listItem, successBounce, slideInFromBottom, slideInFromRight |
| Button patterns standardisés | ✅ | `BUTTON_PATTERNS.md`, `Strength.tsx`, `SwimCatalog.tsx`, `StrengthCatalog.tsx`, `Admin.tsx` | h-12 mobile (48px), h-10 desktop (40px), variants (default, outline, ghost) |
| Code splitting & lazy loading | ✅ | `App.tsx`, `Coach.tsx` | React.lazy + Suspense pour pages lourdes (Dashboard, Strength, Records, SwimCatalog, StrengthCatalog) |
| Skeleton loading states | ✅ | `Dashboard.tsx`, `Strength.tsx`, `HallOfFame.tsx`, `RecordsClub.tsx`, `Admin.tsx`, `Profile.tsx` | Toutes les pages data-heavy |

### Accessibilité

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| ARIA live regions | ✅ | `WorkoutRunner.tsx`, `BottomActionBar.tsx` | Annonces pour les changements dynamiques (timers, sauvegarde) |
| PWA install prompt | ✅ | `InstallPrompt.tsx`, `App.tsx` | Banner iOS-optimized avec guide d'installation |
| Navigation clavier (Dashboard) | ✅ | `Dashboard.tsx` | Flèches (calendrier), Enter/Espace (ouvrir jour), Escape (fermer) |
| Navigation clavier (Strength) | ✅ | `Strength.tsx` | Flèches (liste séances), Enter (ouvrir), Escape (retour liste) |
| Focus trap (modals/drawers) | ✅ | Composants Radix UI | Natif dans Dialog/Sheet |
| Indicateurs de focus visuels | ✅ | `Dashboard.tsx`, `Strength.tsx` | Anneau bleu (`ring-2 ring-primary`) |

---

## Dépendances Supabase

| Fonctionnalité | Comportement si offline |
|----------------|-------------------------|
| Auth login | Erreur |
| Création utilisateur | `{ status: "skipped" }` |
| Modification rôle | `{ status: "skipped" }` |
| Sync FFN | Erreur Edge Function |
| Données générales | Fallback localStorage |

### UI/UX & Design System

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| **Phase 6: Visual Polish & Branding** |
| PWA Icons (EAC branded) | ✅ | `public/icon-*.png`, `manifest.json` | 4 sizes (192, 512, 180, 128), theme-color #E30613 |
| Login Page (modern redesign) | ✅ | `Login.tsx` | Split layout, animations, password strength |
| Animation System | ✅ | `lib/animations.ts` | 8 Framer Motion presets (fadeIn, slideUp, stagger, etc.) |
| Button Standardization | ✅ | `docs/BUTTON_PATTERNS.md` | 3 variants (default, outline, ghost), height standards |
| App-wide Animations | ✅ | Dashboard, Strength, Records, Profile, Login | Consistent motion design |
| **Phase 7: Component Architecture** |
| Dashboard Components | ✅ | `components/dashboard/` (6 files) | CalendarHeader, DayCell, CalendarGrid, StrokeDetailForm, FeedbackDrawer, useDashboardState hook |
| Strength Components | ✅ | `components/strength/` (3 files) | HistoryTable, SessionDetailPreview, SessionList, useStrengthState hook |
| Swim Coach Shared | ✅ | `components/coach/shared/` (4 files) | SessionListView (générique T), SessionMetadataForm, FormActions, DragDropList (reusable) |
| Swim Coach Components | ✅ | `components/coach/swim/` (2 files) | SwimExerciseForm, SwimSessionBuilder |
| Strength Coach Components | ✅ | `components/coach/strength/` (4 files) | StrengthExerciseCard, StrengthSessionBuilder, FolderSection, MoveToFolderPopover (§30, §32) |
| **Phase 8: Design System** |
| Storybook Setup | ✅ | `.storybook/`, story files (5) | Dark mode support, 36 story variants |
| Design Tokens | ✅ | `lib/design-tokens.ts` | 57+ tokens (colors, durations, spacing, typography, z-index) |
| Centralized Utilities | ✅ | `lib/design-tokens.ts` | getContrastTextColor (eliminated duplicates) |
| Zero Hardcoded Values | ✅ | All src/ files | No hex/rgb colors remaining (excluding CSS) |
| z-index consistency | ✅ | `BottomActionBar.tsx`, `WorkoutRunner.tsx`, `toast.tsx` | Tous les z-index utilisent les design tokens CSS (z-bar, z-modal, z-toast) |
| BottomActionBar position modes | ✅ | `BottomActionBar.tsx`, `FeedbackDrawer.tsx` | Prop `position="static"` pour usage dans drawers sans overflow |


---

## Exercices sans GIF

Les exercices suivants n'ont pas d'URL `illustration_gif` dans `dim_exercices` :

- 39: Sliding Leg Curl
- 40: Back Extension 45°
- 41: Standing Calf Raise
- 42: Seated Soleus Raise
- 43: Pogo Hops
- 44: Ankle Isometric Hold
- 53: Rotational Med Ball Throw
- 54: Med Ball Side Toss
- 55: Med Ball Shot Put
- 56: Drop Jump to Stick
- 57: Isometric Split Squat Hold
- 58: Copenhagen Plank
- 59: Hip Airplane

Pour ajouter les GIFs manquants, mettre à jour la colonne `illustration_gif` dans Supabase.

---

## Voir aussi

- [`docs/ROADMAP.md`](./ROADMAP.md) — Plan de développement futur
- [`README.md`](../README.md) — Vue d'ensemble du projet
- [`docs/implementation-log.md`](./implementation-log.md) — Journal des implémentations

# État des fonctionnalités

*Dernière mise à jour : 2026-03-01 (§80 Sécurité RLS + Import FFN Auto-Sync)*

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
| Notes techniques exercice | ✅ | `ExerciseLogInline.tsx`, `SwimSessionTimeline.tsx`, `swim-logs.ts` | Saisie inline depuis la timeline (§58), expansion par exercice, auto-détection reps, temps/coups par rep |
| Historique notes techniques | ✅ | `SwimExerciseLogsHistory.tsx` | Vue chronologique groupée par date |
| Présence/absence | ✅ | `Dashboard.tsx` | Toggle par créneau |
| Consultation séances | ✅ | `SwimSessionView.tsx`, `SwimSessionTimeline.tsx` | Timeline + saisie technique inline (§58), rail d'intensité, toggle 3 niveaux, icônes matériel SVG (§55) |
| Partage public séance | ✅ | `SwimSessionView.tsx`, `SharedSwimSession.tsx`, `swim.ts` | Lien partageable UUID, page publique sans auth, CTA inscription (§57) |
| Historique/Progression | ✅ | `Progress.tsx` | Apple Health style: hero KPI + tendance, sticky header compact (§46), AreaChart gradient, ProgressBar ressentis, Collapsible detail |

### Natation — Coach

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création séance | ✅ | `SwimCatalog.tsx`, `SwimSessionBuilder.tsx` | Blocs, exercices, intensité, matériel, récupération départ/repos |
| Édition séance | ✅ | `SwimCatalog.tsx`, `SwimSessionBuilder.tsx` | Vue accordion inline, duplication exercice |
| Récupération entre exercices | ✅ | `SwimExerciseForm.tsx`, `SwimSessionTimeline.tsx` | Départ (temps de départ) OU Repos (pause), affiché côté nageur |
| Catalogue | ✅ | `SwimCatalog.tsx` | Dossiers/sous-dossiers, archivage BDD, restauration, déplacement |
| Partage public séance | ✅ | `SwimCatalog.tsx`, `swim.ts` | Bouton partage dans preview, génération token UUID (§57) |
| Intensité Progressif | ✅ | `IntensityDots.tsx`, `IntensityDotsSelector.tsx` | Intensité "Prog" avec icône TrendingUp, couleur orange |
| Conversion texte → blocs | ✅ | `swimTextParser.ts`, `SwimSessionBuilder.tsx` | Parser déterministe, 50 tests, format coach structuré (§49). Fix §52 : exercices parents préservés avec sous-détails Form A en modalities |
| Assignation | ✅ | `CoachAssignScreen.tsx` | Nage + muscu |
| Calendrier créneaux | ✅ | `CoachSlotCalendar.tsx`, `useSlotCalendar.ts` | Vue semaine créneaux récurrents, états (vide/brouillon/publié/annulé), navigation ←→ (§85) |
| Assignation par créneau | ✅ | `SlotSessionSheet.tsx`, `assignments.ts` | Auto-assignation groupes, visible_from, bulk create, delete, visibilité (§85) |
| Picker templates | ✅ | `SlotTemplatePicker.tsx` | Sélection séance bibliothèque, recherche par nom (§85) |
| Notifications rappel ressenti | ✅ | `00054_slot_centric_sessions.sql` | pg_cron 15min, push 30min avant fin créneau (§85) |

### Musculation — Nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Liste séances assignées | ✅ | `Strength.tsx` | Segmented control, cards compactes, auto-start, AlertDialog |
| Preview séance | ✅ | `Strength.tsx` | Mode "reader", dock masqué, lancement unique |
| Mode focus (WorkoutRunner) | ✅ | `WorkoutRunner.tsx` | Header compact, bouton "Passer", notes visibles, timer simplifié |
| Saisie charge/reps | ✅ | `WorkoutRunner.tsx` | Auto-sauvegarde, volume formaté fr-FR, option "Poids du corps" (PDC) (§64) |
| Noms exercices français | ✅ | `dim_exercices` (DB) | 59 exercices traduits en français (§64) |
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
| Dashboard coach | ✅ | `Coach.tsx` | Mobile first, KPI unifié, grille 2x2 avec compteurs, cards nageurs (§35) |
| Calendrier coach | ✅ | `CoachCalendar.tsx`, `useCoachCalendarState.ts` | Vue mensuelle assignations, filtre groupe/nageur, 3 slots éditables inline (Nage Matin, Nage Soir, Muscu), indicateur musculation DayCell (§53, §54) |

### Records & FFN

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Records personnels (CRUD) | ✅ | `Records.tsx` | Redesign complet mobile first : nav aplatie, pool toggle unifié 25/50, formulaire compact, empty states (§42) |
| Records compétition (vue) | ✅ | Vue `swim_records_comp`, `records.ts` | Dérivés automatiquement de swimmer_performances via DISTINCT ON (§80) |
| Import toutes performances | ✅ | Edge Function `ffn-performances` | Import historique complet depuis FFN |
| Auto-sync FFN hebdomadaire | ✅ | `pg_cron`, `RecordsAdmin.tsx`, `app_settings` | Import auto configurable (jour/heure) depuis admin (§80) |
| Historique performances | ✅ | `Records.tsx` | Cartes dépliables par épreuve, graphique intégré, best time Trophy (§41) |
| Records club (consultation) | ✅ | `RecordsClub.tsx` | Épuré mobile : filtres 1 ligne (Select dropdown), sections par nage, 1 carte/épreuve, drill-down progressif (§47) |
| Import records club (FFN) | ✅ | `RecordsAdmin.tsx`, Edge Function `import-club-records` | Import bulk + recalcul records club |
| Gestion nageurs records | ✅ | `RecordsAdmin.tsx` | Ajout/édition/activation swimmers, card-based mobile first (§36) |
| Hall of Fame | ✅ | `HallOfFame.tsx` | Podium visuel top 3 + rangs 4-5 compacts, sticky header compact, sélecteur période (7j/30j/3mois/1an), refresh auto après ajout séance (§38, §46, §51) |
| Gestion coach imports perfs | ✅ | `RecordsAdmin.tsx` | Import individuel par nageur + historique des imports |
| Sécurité RLS renforcée | ✅ | Migration `00046` | Policies restreintes sur 4 tables (app_settings, swimmer_performances, import_logs, strength_folders) (§80) |

### Messagerie

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Email coach (mailto:) | ✅ | `CoachMessagesScreen.tsx` | Ouvre mailto: avec BCC, remplace l'ancienne messagerie in-app |

### Groupes temporaires (stages)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création groupe temporaire | ✅ | `CoachGroupsScreen.tsx`, `temporary-groups.ts` | Nom + sélection nageurs avec checkboxes par groupe permanent |
| Sous-groupes hiérarchiques | ✅ | `CoachGroupsScreen.tsx`, `temporary-groups.ts` | Membres limités au parent, cascade désactivation |
| Suspension automatique | ✅ | `client.ts`, `assignments.ts` | Nageur en stage ne voit que les assignations du temporaire |
| Désactivation/réactivation | ✅ | `CoachGroupsScreen.tsx`, `temporary-groups.ts` | Guard: pas de doublon temporaire actif |
| Suppression (si inactif) | ✅ | `CoachGroupsScreen.tsx`, `temporary-groups.ts` | Cascade sous-groupes |
| Sélecteur enrichi assignation | ✅ | `CoachAssignScreen.tsx` | Temporaires en premier avec badge "Stage", sous-groupes indentés |
| Gestion membres | ✅ | `CoachGroupsScreen.tsx` | Ajout/retrait avec confirmation |

### Compétitions

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| CRUD compétitions coach | ✅ | `CoachCompetitionsScreen.tsx`, `competitions.ts` | Nom, date, lieu, multi-jours, description (§59) |
| Assignation compétitions (groupes/nageurs) | ✅ | `CoachCompetitionsScreen.tsx`, `competitions.ts` | Multiselect avec pré-cochage groupe, compteur assignés (§62) |
| Filtrage compétitions par assignation | ✅ | `Dashboard.tsx` | Nageur ne voit que ses compétitions assignées, fallback tout (§62) |
| Marqueurs compétition calendrier nageur | ✅ | `Dashboard.tsx`, `DayCell.tsx`, `CalendarGrid.tsx` | Trophy icon ambre sur les jours de compétition |
| Bannière prochaine compétition | ✅ | `Dashboard.tsx` | Card ambre avec J-X au-dessus du calendrier |
| Compteur séances avant compétition | ✅ | `Dashboard.tsx`, `Progress.tsx` | "X séance(s) d'ici là" — créneaux assignés uniques (§62) |
| SMS groupé coach (compétition) | ✅ | `CoachCompetitionsScreen.tsx` | URI sms: sur mobile, clipboard desktop (§62) |
| SMS généraliste coach | ✅ | `CoachSmsScreen.tsx` | Écran dédié, tout groupe/nageur, message optionnel (§65) |

### Absences planifiées

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Signalement absence nageur | ✅ | `FeedbackDrawer.tsx`, `Dashboard.tsx`, `absences.ts` | Bouton inline jour futur, raison optionnelle (§62) |
| Marqueurs absences calendrier nageur | ✅ | `DayCell.tsx`, `CalendarGrid.tsx` | "X" circulaire sur les jours marqués (§62) |
| Absences visibles coach calendrier | ✅ | `useCoachCalendarState.ts`, `CoachCalendar.tsx` | Marqueur X + bannière rouge "Absence prévue" (§62) |

### Objectifs

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| CRUD objectifs coach | ✅ | `CoachObjectivesScreen.tsx`, `objectives.ts` | Par nageur, chrono (épreuve FFN + temps) et/ou texte libre (§60) |
| Lien compétition optionnel | ✅ | `CoachObjectivesScreen.tsx` | Objectif rattachable à une compétition |
| Vue objectifs nageur (Progression) | ✅ | `Progress.tsx` | Section "Mes objectifs" avec épreuve, temps cible, badge compétition J-X |
| Objectifs nageur (lecture coach + CRUD perso) | ✅ | `SwimmerObjectivesView.tsx`, `Profile.tsx` | Hub Profil, objectifs coach RO + objectifs perso CRUD, bottom sheet form (§61) |

### Pointage heures

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Création shift | ✅ | `Administratif.tsx` | Date, heures, lieu, trajet |
| Édition shift | ✅ | `Administratif.tsx` | |
| Lieux de travail | ✅ | `Administratif.tsx` | Gestion CRUD lieux |
| Dashboard totaux | ✅ | `Administratif.tsx` | KPI hero, grille work/travel, comparaison période (§39) |
| Sélecteur de période | ✅ | `Administratif.tsx` | ToggleGroup 7j/mois/mois-1/custom (§39) |
| Donut chart travail/trajet | ✅ | `Administratif.tsx` | Recharts PieChart avec centre label (§39) |
| Bar chart empilé par jour | ✅ | `Administratif.tsx` | BarChart stacked work + travel (§39) |
| Top lieux par heures | ✅ | `Administratif.tsx` | Classement avec barres de progression (§39) |
| Comparaison période | ✅ | `Administratif.tsx` | Delta badge TrendingUp/Down (§39) |
| Groupes encadrés par shift | ✅ | `Administratif.tsx`, `TimesheetShiftForm.tsx` | Multi-checkbox groupes permanents + custom labels (§66) |
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
| Hub Profil (grille navigation) | ✅ | `Profile.tsx` | State machine home/objectives, grille 2x2 (Mon profil, Sécurité, Records, Objectifs) (§61) |
| Affichage infos | ✅ | `Profile.tsx` | Hero banner bg-accent, avatar ring, badge rôle (§38) |
| Édition profil | ✅ | `Profile.tsx` | Sheet bottom mobile-friendly, formulaire complet + téléphone (§38, §62) |
| Changement de groupe → sync group_members | ✅ | `Profile.tsx`, migration `00032` | Trigger PostgreSQL BEFORE UPDATE sync `group_members` + `group_label` automatiquement (§67) |
| Changement mot de passe | ✅ | `Profile.tsx` | Bottom sheet dédié Sécurité (§61, was Collapsible §38) |
| FFN & Records | ✅ | `Profile.tsx` | Card fusionnée sync FFN + lien records (§38) |
| Quiz neurotype (profil entraînement) | ✅ | `NeurotypQuiz.tsx`, `NeurotypResult.tsx`, `neurotype-quiz-data.ts`, `neurotype-scoring.ts` | 30 questions, 5 profils, scoring client-side, résultat JSONB dans user_profiles (§71) |
| Entretiens nageur | ✅ | `AthleteInterviewsSection.tsx`, `Profile.tsx` | Formulaire 4 sections en draft_athlete, lecture seule + signature en sent, historique en signed (§74) |

### Planification (macro-cycles)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| CRUD macro-cycles coach | ✅ | `SwimmerPlanningTab.tsx`, `planning.ts` | Bloc entre 2 compétitions, nom libre, notes (§74) |
| Semaines auto-générées | ✅ | `SwimmerPlanningTab.tsx`, `planning.ts` | bulkUpsert des lundis entre start et end competition (§74) |
| Typage semaines (libre) | ✅ | `SwimmerPlanningTab.tsx` | Texte libre avec autocomplétion datalist des types existants (§74) |
| Couleur type par hash | ✅ | `SwimmerPlanningTab.tsx` | Palette automatique cohérente par nom de type (§74) |
| Héritage groupe → individuel | ✅ | `SwimmerPlanningTab.tsx`, `planning.ts` | Badge "Planification groupe", bouton "Personnaliser" copie en individuel (§74) |
| Timeline semaines | ✅ | `SwimmerPlanningTab.tsx` | Timeline verticale, semaine courante surbrillance, compétitions bornes (§74) |

### Entretiens individuels (coach)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Workflow multi-phases | ✅ | `SwimmerInterviewsTab.tsx`, `interviews.ts` | draft_athlete → draft_coach → sent → signed avec guards (§74) |
| Initiation coach | ✅ | `SwimmerInterviewsTab.tsx` | Crée en draft_athlete, nageur reçoit le formulaire (§74) |
| Sections nageur (4) | ✅ | `AthleteInterviewsSection.tsx` | Réussites, difficultés, objectifs, engagements (§74) |
| Sections coach (3) | ✅ | `SwimmerInterviewsTab.tsx` | Commentaires, objectifs ajoutés, actions à suivre (§74) |
| Cloisonnement phases | ✅ | `interviews.ts`, migration 00035 | RLS phase-based : nageur masqué en draft_coach, coach masqué en draft_athlete (§74) |
| Panneau contextuel | ✅ | `SwimmerInterviewsTab.tsx` | Accordéon objectifs + planification + compétitions en phase draft_coach (§74) |
| Signature nageur | ✅ | `AthleteInterviewsSection.tsx` | Bouton signer en statut sent, passe à signed (§74) |
| Historique entretiens | ✅ | `SwimmerInterviewsTab.tsx`, `AthleteInterviewsSection.tsx` | Liste chronologique coach + archive collapsible nageur (§74) |

### Coach Events Timeline (§84)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Timeline verticale échéances coach | ✅ | `CoachEventsTimeline.tsx`, `useCoachEventsTimeline.ts` | Mois groupés, points colorés lumineux, badges urgency (§84) |
| Fetch parallèle 3 sources | ✅ | `useCoachEventsTimeline.ts` | Compétitions, entretiens pending, fins de cycles via 3 useQuery (§84) |
| Normalisation TimelineEvent[] | ✅ | `useCoachEventsTimeline.ts` | Merge + tri chronologique, calcul urgency (now/soon/upcoming) (§84) |
| Filtres type/période | ✅ | `useCoachEventsTimeline.ts`, `CoachEventsTimeline.tsx` | Filtre par type d'événement et horizon temporel (§84) |
| getAllPendingInterviews() | ✅ | `interviews.ts`, `api/index.ts`, `api.ts` | Join users pour athlete_name, filtre status != signed (§84) |

### Créneaux d'entraînement récurrents

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| CRUD créneaux (jour + horaire + lieu) | ✅ | `CoachTrainingSlotsScreen.tsx`, `training-slots.ts` | Création, modification, soft delete (§76) |
| Multi-groupes par créneau | ✅ | `CoachTrainingSlotsScreen.tsx`, `training-slots.ts` | N assignations groupe/coach/lignes par créneau (§76) |
| Nombre de lignes d'eau par coach | ✅ | `CoachTrainingSlotsScreen.tsx` | Saisie manuelle dans le formulaire d'assignation (§76) |
| Exceptions par date (annulation/modification) | ✅ | `CoachTrainingSlotsScreen.tsx`, `training-slots.ts` | Override avec statut cancelled/modified, motif optionnel (§76) |
| Vue nageur "Mon planning" | ✅ | `Profile.tsx` | Liste compacte jour/horaire/lieu + exceptions à venir (§76) |
| Navigation coach | ✅ | `Coach.tsx` | Bouton "Créneaux" dans la grille du dashboard coach (§76) |

### Créneaux personnalisés par nageur

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Table `swimmer_training_slots` | ✅ | `00042_swimmer_training_slots.sql` | UUID PK, FK vers `training_slot_assignments`, RLS coach/admin (§78) |
| API CRUD module | ✅ | `swimmer-slots.ts` | get, has, init, create, update, delete, reset, affected (§78) |
| Timeline mobile scroll horizontal | ✅ | `CoachTrainingSlotsScreen.tsx` | Colonnes 80px fixes, auto-scroll sur aujourd'hui (§78) |
| Select filtre (remplace pills) | ✅ | `CoachTrainingSlotsScreen.tsx` | Groupes + coaches + nageurs dans Select unique (§78) |
| Vue nageur dans timeline coach | ✅ | `CoachTrainingSlotsScreen.tsx` | Sélection nageur → affiche créneaux perso ou hérités (§78) |
| Onglet Créneaux fiche nageur | ✅ | `SwimmerSlotsTab.tsx`, `CoachSwimmerDetail.tsx` | CRUD complet, init/reset depuis groupe (§78) |
| Résolution créneaux profil nageur | ✅ | `Profile.tsx` | hasCustomSlots → créneaux perso, sinon fallback groupe (§78) |

### Notifications push (§79)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| Gate installation PWA mobile | ✅ | `PWAInstallGate.tsx`, `pwaHelpers.ts` | Bloquant sur mobile si pas standalone. Android: bouton install. iOS: instructions visuelles |
| Table push_subscriptions | ✅ | `00043_push_subscriptions.sql` | RLS via app_user_id(), UNIQUE(user_id, endpoint) |
| Service Worker push handler | ✅ | `public/push-handler.js`, `vite.config.ts` | importScripts dans Workbox generateSW |
| Client push helpers | ✅ | `pushHelpers.ts`, `push.ts` | Subscribe/unsubscribe/check, split pur/browser |
| Push permission banner | ✅ | `PushPermissionBanner.tsx`, `App.tsx` | Banner post-login, dismissible localStorage |
| Edge Function push-send | ✅ | `supabase/functions/push-send/index.ts` | npm:web-push@3.6.7, nettoyage tokens expirés |
| Database webhook trigger | ✅ | `00044_push_webhook_trigger.sql` | pg_net trigger sur notification_targets INSERT |
| Push toggle dans Profil | ✅ | `Profile.tsx` | Activer/désactiver depuis la page profil |
| VAPID keys config | ✅ | `pushConfig.ts`, `pages.yml` | GitHub Secrets + Supabase Secrets |

### UI/UX & Design System (Phase 6)

| Fonctionnalité | Statut | Fichiers | Notes |
|----------------|--------|----------|-------|
| PWA Icons (EAC branding) | ✅ | `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/favicon.png` | 4 tailles (192, 512, 180, 128), logo EAC rouge |
| Theme color (EAC red) | ✅ | `index.html`, `public/manifest.json` | #E30613 (was #3b82f6) |
| Login page moderne | ✅ | `Login.tsx` | Split layout desktop, mobile thème clair avec bande rouge EAC (§46) |
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
| Service Worker (Workbox) | ✅ | `vite.config.ts` (vite-plugin-pwa) | Workbox generateSW, 102 entries precachées, auto-update (§48) |
| Runtime caching API | ✅ | `vite.config.ts` | NetworkFirst Supabase, CacheFirst Google Fonts (§48) |
| Bundle optimization | ✅ | `vite.config.ts`, `RecordsClub.tsx` | Modulepreloads réduits de 5→3, lazy-load PDF export (§48) |
| DNS prefetch | ✅ | `index.html` | dns-prefetch + preconnect Supabase (~200ms saved) (§48) |
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
| Touch targets 44px compliance | ✅ | 10 fichiers coach | Tous les boutons interactifs ≥ 40px (h-10 w-10), chips py-2 (§81) |
| FeedbackDrawer scale labels | ✅ | `FeedbackDrawer.tsx` | Labels min/max (Facile↔Très dur, Mauvaise↔Excellente) sur les 5 boutons (§81) |
| FeedbackDrawer AlertDialog | ✅ | `FeedbackDrawer.tsx` | Remplacement window.confirm par Shadcn AlertDialog (§81) |
| FeedbackDrawer distance directe | ✅ | `FeedbackDrawer.tsx` | Tap sur valeur → input numérique direct, arrondi 100m (§81) |
| Records shortcut Dashboard | ✅ | `Dashboard.tsx` | Chip "Mes records" accès direct /records (§81) |
| Coach bottom nav 5 items | ✅ | `navItems.ts`, `AppLayout.tsx`, `Coach.tsx` | Natation, Calendrier, Nageurs promus en bottom nav (§81) |
| KPIs fiche nageur Resume | ✅ | `CoachSwimmerDetail.tsx` | 4 tuiles avec données réelles (ressenti, entretiens, cycle, objectifs) (§81) |
| Wizard inscription 3 étapes | ✅ | `Login.tsx` | Formulaire découpé en 3 steps avec progress dots et validation (§81) |
| CORS production domain only | ✅ | `_shared/cors.ts`, 4 Edge Functions | Origin restreint à erstein-aquatic-club.github.io (§82) |
| Migrations reproductibles | ✅ | `00050_missing_tables_reproducibility.sql` | competitions, competition_assignments, objectives, planned_absences, app_settings (§82) |
| Nettoyage tables legacy | ✅ | `00051_drop_legacy.sql`, `schema.ts` | auth_login_attempts supprimée (§82) |
| RPC atomique strength session | ✅ | `00052_rpc.sql`, `strength.ts` | Transaction unique UPDATE+DELETE+INSERT (§82) |
| Pagination listes longues | ✅ | `Admin.tsx`, `SwimCatalog.tsx`, `CoachSwimmersOverview.tsx` | "Voir plus" client-side, cap 30-50 items (§82) |
| Coach deep linking URL | ✅ | `Coach.tsx` | URL synchro activeSection via replaceState (§82) |
| Page Suivi standalone | ✅ | `Suivi.tsx`, `AthletePerformanceHub.tsx` | Page top-level /suivi avec 4 onglets (objectifs, entretiens, planif, ressentis) (§83) |
| Profil allégé | ✅ | `Profile.tsx` | Retrait sections suivi, ajout tuile Club, redirect compat (§83) |
| Swipe calendrier | ✅ | `useSwipeNavigation.ts`, `CalendarGrid.tsx`, `Dashboard.tsx` | Navigation mois par swipe horizontal framer-motion (§83) |
| Drag-to-dismiss drawer | ✅ | `FeedbackDrawer.tsx` | Geste drag handle pour fermer le drawer (§83) |
| Pull-to-refresh Dashboard | ✅ | `PullToRefresh.tsx`, `Dashboard.tsx` | Geste pull-down pour rafraîchir les données (§83) |


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

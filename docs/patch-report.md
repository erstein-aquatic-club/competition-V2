# Patch Report — Lot 1 (Audit + socle UI partagé)

## Audit de reprise (Lot 1 & 2)

### Statut global
- **Lot 1 (socle UI partagé)** : **OK** (composants/helpers présents + tests).
- **Lot 2 (musculation nageur)** : **OK**.

### Vérifications (code vs maquettes)
- **Composants shared** (`client/src/components/shared/*`) :
  - BottomActionBar / ScaleSelector5 / ModalMaxSize / ScrollContainer / SafeArea / KeyboardAvoiding présents et utilisés ✅
  - Tests unitaires présents (BottomActionBar, ScaleSelector5) ✅
- **Musculation — exécution + fin de séance** (`client/src/components/strength/WorkoutRunner.tsx`) :
  - Barre d’actions basse dédiée + safe-area ✅
  - Modale saisie charge/réps avec taille max + scroll interne ✅
  - Fin de séance : difficulté + fatigue en 5 choix ✅

### Écarts résiduels / correctifs immédiats (KO)
- **Progression** (`client/src/pages/Progress.tsx`) :
  - **Corrigé** : remplacement de `getScoreColor` par `scoreToColor` partagé avec inversion contrôlée via `invert`.

### Correctifs appliqués
- Progression : adoption de `scoreToColor` partagé + suppression de `getScoreColor` local (commit `298500c1`).

### Risques iPhone / régressions possibles
- **Fin de séance muscu** : champ notes dans une carte sans wrapper keyboard‑avoiding → risque de masquage clavier en petit écran si le champ est focus (à revalider).
- **Progression** : revalider le contraste des KPI après alignement sur `scoreToColor`.

## Audit repo (structure, navigation, rôles, modèles, services)

### Structure
- **Client (Vite + React)** : `client/src`
  - Pages : `client/src/pages/*` (navigables via Wouter)
  - Composants UI : `client/src/components/*` (shadcn + custom)
  - API client/local cache : `client/src/lib/api.ts`
  - Auth + rôles : `client/src/lib/auth.ts`
- **Server (Express + drizzle)** : `server/*`
- **Schéma partagé** : `shared/schema.ts` (tables `users` minimales)
- **Docs & maquettes** : `docs/maquettes-ui-ux/*`

### Navigation
- Navigation principale et rôles dans `client/src/components/layout/AppLayout.tsx`.
  - Onglets mobiles (fixe bas) + top bar desktop.
  - Accès coach/admin conditionnés par `role`.

### Rôles & Auth
- Stockage local + access tokens : `client/src/lib/auth.ts`.
- `role` (coach/admin) pilote l’accès aux sections Coach/Admin.

### Services API (front)
- `client/src/lib/api.ts` gère :
  - Natation : séances (`getSessions`, `createSession`, `swim_catalog_*`)
  - Musculation : catalogue, runs, logs (`strength_*`)
  - Profil (`getProfile`, `updateProfile`, `auth_password_update`)
  - Assignations (`assignments_*`)
  - Fallback localStorage si endpoint absent.

## Écrans concernés & mapping maquettes → composants réels

### Maquette natation (création séance coach)
Source : `docs/maquettes-ui-ux/maquettes_creation_seance_natation_coach.jsx`
- **Catalogue + création séance natation (coach)**
  - `client/src/pages/coach/SwimCatalog.tsx`
  - Composants associés :
    - `client/src/components/swim/SwimSessionConsultation.tsx`
    - `client/src/components/swim/IntensityDots.tsx`
    - `client/src/components/swim/IntensityDotsSelector.tsx`

### Maquette espace coach natation
Source : `docs/maquettes-ui-ux/maquette_espace_coach_natation.jsx`
- **Vue coach natation**
  - `client/src/pages/Coach.tsx`
  - `client/src/components/coach/CoachHome.tsx`

### Maquette saisie ressenti natation
Source : `docs/maquettes-ui-ux/maquette_saisie_ressenti_seance_natation.jsx`
- **Ressenti séance natation**
  - `client/src/pages/Dashboard.tsx`

### Maquette musculation (exécution séance nageur)
Source : `docs/maquettes-ui-ux/maquettes_musculation_execution_vue_athlète.jsx`
- **Exécution séance muscu nageur + fin de séance**
  - `client/src/pages/Strength.tsx` (run + modales + fin de séance)

### Autres écrans impactés par exigences
- **Ressenti natation nageur** : `client/src/pages/Dashboard.tsx`
- **Progression** : `client/src/pages/Progress.tsx`
- **Profil** : `client/src/pages/Profile.tsx`
- **Login / création compte** : `client/src/pages/Login.tsx`
- **Coach / messagerie / suivi nageurs** : `client/src/pages/Coach.tsx`
- **Catalogue natation (règles archive/suppression)** : `client/src/pages/coach/SwimCatalog.tsx`
- **Édition exercice muscu** : `client/src/pages/coach/StrengthCatalog.tsx`

## Incohérences / écarts constatés (pré‑analyse)
- **Ressenti natation (nageur)** :
  - ✅ Commentaire désormais ouvert par défaut + suppression du bouton.
  - ✅ Texte d’aide gris “Ultra‑rapide…” + tag “Mobile” supprimés.
  - Couleurs score désormais centralisées via `scoreToColor` partagé dans `Progress.tsx`.
- **Progression** : ✅ KPI “Difficulté Moy” + layout compact mobile (`Progress.tsx`).
- **Musculation** : taille des boutons / modales / safe‑area non encore réalignés (`Strength.tsx`).
- **Coach** : duplication “Anniversaires à venir” dans sections du suivi (`Coach.tsx`).
- **Profil** : ✅ export/reset retirés, rôle coach affiché “Entraineur EAC” (`Profile.tsx`).

## Risques de régression
- **Refactor UI partagé** : risque de casser styles spécifiques par page si composants partagés ne sont pas intégrés avec prudence.
- **Modales / safe‑area** : risque d’overflow sur mobile si wrappers ne sont pas systématisés.
- **Couleurs scores** : changement global potentiel sur KPI si helper commun non paramétré.
- **API fallback localStorage** : certaines règles métier (archive/suppression) doivent rester cohérentes offline/online.

---

## Socle UI partagé (préparé)
Nouveaux composants/helpers (prêts pour usage dans lots suivants) :
- `BottomActionBar` (3 boutons bas + safe‑area)
- `ScaleSelector5` (choix 1–5)
- `SafeArea`, `KeyboardAvoiding`, `ScrollContainer`, `ModalMaxSize`
- `scoreToColor` (helper couleur score → rouge quand faible)
- `formatSwimSessionDefaultTitle` (titre par défaut séance natation)

## Checklist pixel‑perfect (à appliquer sur chaque écran)
- [ ] Ordre exact des composants (top → bottom)
- [ ] Spacings/paddings/margins identiques aux maquettes
- [ ] Typographies (famille, taille, graisse, uppercase, italic)
- [ ] Alignements (grid/row, baseline, centrage)
- [ ] Taille des boutons, pills, inputs, badges, modales
- [ ] États (disabled, active, hover) identiques
- [ ] Safe‑area iPhone (top/bottom) respectée
- [ ] Clavier mobile : aucun champ masqué
- [ ] Scroll : pas d’overflow horizontal, scroll vertical conforme


---

## Lot 2 — Musculation nageur (exécution + fin de séance)

### Changements réalisés
- Ajustement de l’écran d’exécution musculation (focus) : barre d’actions basse dédiée + boutons redimensionnés.
- Modale de saisie charge/réps : taille max + scroll interne pour éviter overflow mobile.
- Fin de séance : "ressenti" remplacé par **difficulté** (1–5) + **fatigue** (1–5) via sélecteurs 5 choix.
- Alignement des libellés et états sur la maquette (taille/spacing/typo).
- Ajout suppression “séance en cours” : purge état local + cache, fallback localStorage si endpoint absent (`Strength.tsx`, `api.ts`).

### Checklist maquette (Lot 2)
- [ ] Structure/ordre des blocs identiques à la maquette musculation.
- [ ] Boutons taille/espacement conformes (barre basse 3 actions).
- [ ] Modale charge/réps : max‑size + scroll interne, aucune coupure iPhone.
- [ ] Fin séance : difficulté + fatigue en UI 5 choix.
- [ ] Bouton “Supprimer la séance en cours” visible + suppression effective.

---

## Lot 3 — Natation coach + Ressenti nageur + Progression

### Changements réalisés
- **Coach natation** : recomposition pixel‑perfect du catalogue + éditeur (top bar, recherche, mode compact/détaillé, badges intensité/typologie).
- **Titre par défaut** : “Séance du DD/MM/YYYY - Soir - Matin” appliqué automatiquement (champ éditable).
- **Ressenti nageur** : commentaire ouvert par défaut, suppression du bouton + textes gris inutiles, CRUD historique (modifier/supprimer).
- **Couleurs performance/engagement** : alignées sur `scoreToColor` (rouge quand faible).
- **Progression** : KPI “Difficulté Moy” + grille compacte pour difficulté/performance/engagement/fatigue.

### Checklist maquette (Lot 3)
- [x] Création séance natation (coach) alignée maquette.
- [x] Ressenti nageur nettoyé + CRUD historique opérationnel.
- [x] Progression compacte et lisible mobile.

### Tests T3
- [x] Render : `SwimCatalog` (liste coach).
- [x] Render : `SwimKpiCompactGrid`.
- [x] CRUD historique : update/delete session (mock localStorage).
- [i] Lint : aucun script repo (source de vérité = `npm run check` + `npm test`).

---

## Lot 4.1 — Navigation par rôles + Messagerie + placeholders

### Changements réalisés
- Navigation calculée par rôle (nageur / coach / comite / admin) avec onglets dédiés.
- Renommage “Alertes” → “Messagerie” (label + page).
- Ajout placeholders : `Administratif` et `Comité`.

### Tests T4.1
- [x] `npm run check`
- [x] `npm test`

---

## Lot 4.2 — Messagerie en fils (threads)

### Changements réalisés
- Messagerie en fils basée sur `notifications_*` avec `threads = groupBy(sender_id || sender_email || sender)`.
- Liste des conversations par expéditeur (dernier message + timestamp + indicateur non-lu).
- Vue détail : fil chronologique + envoi + marquage lu à l’ouverture.

### Tests T4.2
- [x] `npm run check`
- [!] `npm test` (échec environnement : esbuild linux manquant)

---

## Lot 4.3.A — Login avec password conditionnel

---

## T5 — Pointage shifts (pixel-perfect)

### Changements réalisés
- **UI coach** : recomposition pixel‑perfect de l’écran `Administratif` en mobile‑first (topbar, tabs visuels, FAB, bottom sheet).
- **Composants extraits** : `TimesheetShiftForm`, `TimesheetShiftList`, `TimesheetTotals` (scope `client/src/components/timesheet/*`).
- **Liste shifts** : regroupement par jour + badge Trajet/Travail + statut **En cours** si `end_time` absent.
- **Totaux** : carte “Aujourd’hui” + détails semaine/mois (travail vs trajet) repliables.
- **Logique** : **inchangée** (helpers `timesheetHelpers` réutilisés, endpoints identiques).
- **Roues horaires** : nouveau composant `TimesheetTimeWheel` (scroll + snapping) pour début/fin, format **HH:MM**, fin optionnelle.
- **Dashboard** : onglet cliquable avec KPI période + résumé travail/trajet + bloc “Graphiques (à venir)”.
- **CTA rapides** : boutons “Maintenant” rétablis sous les roues (début/fin).

### Limites restantes
- RAS (écarts maquette corrigés pour le lot T5).

### Tests T5
- [x] Render : `Administratif` (totaux + en cours).
- [x] Logique : `TimesheetTimeWheel` (format/clamp HH:MM).
- [x] Render : `Administratif` (dashboard vs shifts).

---

## Préparation T5 (Lot 2 à venir, sans implémentation)

### Écrans à venir (pixel-perfect)
1. **Création séances musculation coach**
   - **Fichiers cibles** : `client/src/pages/coach/StrengthCatalog.tsx`, `client/src/components/strength/*`.
   - **Composants à réutiliser** : `ModalMaxSize`, `ScrollContainer`, `BottomActionBar`, `ScaleSelector5`.
   - **Risques UX** : overflow mobile dans les modales d’édition, clavier masquant les champs, CTA bas masqués.
2. **Page “Records nageur”**
   - **Fichiers cibles** : `client/src/pages/Progress.tsx` (ou page dédiée si ajoutée par routing).
   - **Composants à réutiliser** : KPI cards existantes, helpers `scoreToColor`.
   - **Risques UX** : densité d’information sur mobile, alignement des grilles, contraste des badges.

### Changements réalisés
- Ajout d’un pré-check `auth_login_precheck` (retourne uniquement `requiresPassword`) pour activer le champ mot de passe côté UI.
- Champ mot de passe masqué par défaut; affiché si requis (coach/comite/admin) ou si déjà saisi.
- Auth Worker : mot de passe requis pour coach/comite/admin; nageur autorisé sans password.
- Création de compte enrichie : nom + bio + anniversaire requis, bio persistée après inscription (`Login.tsx`).

### Tests T4.3.A
- [x] `npm run check`
- [x] `npm test`

---

## Lot 4.4 — Stabilisation + qualité + dette maîtrisée

### Changements réalisés
- Ajout d’un endpoint `capabilities` côté Worker pour vérifier la disponibilité Timesheet + Messagerie.
- Messages d’erreur explicites côté UI (capabilities, 401/403, action inconnue, table manquante).
- Messagerie : autorisation de réponse pour athlètes uniquement sur fil existant + thread key basé sur le destinataire si message envoyé par soi-même.
- Messagerie : marquage non‑lu avec optimistic update + rollback.
- Timesheet : microcopy “En cours · non comptabilisé”, filtre “Trajet uniquement”, parsing tolérant HH:MM côté Worker.

### Tests T4.4
- [x] `npm run check`
- [x] `npm test`

---

## T5 — Pixel-perfect pending

### Écrans concernés
- Administratif (saisie shifts)
- Comité (tableau de bord shifts)
- Messagerie (threads)

### Composants/sections à remplacer
- `client/src/pages/Administratif.tsx` (formulaire + liste + totaux)
- `client/src/pages/Comite.tsx` (filtres + totaux + listing)
- `client/src/pages/Notifications.tsx` (liste threads + vue détail)

### Points de vigilance
- Safe-area iPhone (top/bottom), scroll interne et zones d’action.
- Clavier mobile (textarea + inputs horaire).
- États (loading, erreur, empty, non‑lu).

---

## UX Regression Fix — Login

### Changements réalisés
- Pré-check login enrichi avec `accountExists` pour basculer immédiatement en mode création si le compte est inexistant.
- Focus automatique renforcé : mot de passe requis → focus sur le champ mot de passe + blocage de la soumission tant qu’il est vide.
- Ouverture signup stabilisée (auto-remplissage nom/email, focus premier champ).

### Tests UX Regression Fix — Login
- [x] `npm run check`
- [x] `npm test`

---

## Release Readiness — Strength Run Delete

### Changements réalisés
- Ajout de l’endpoint Worker `strength_run_delete` pour supprimer une run musculation et rétablir le statut d’assignation.

### Tests Release Readiness — Strength Run Delete
- [x] `npm run check`
- [x] `npm test`

---

## Release readiness — PWA reactivity fix

### Changements réalisés
- Ajout d’un snapshot local pour l’état “séance en cours” (muscu) afin d’éviter tout refresh après start/suppression.
- Invalidation ciblée des queries `strength_run_in_progress` et `strength_history` après mutations.
- Ajout du meta tag PWA `mobile-web-app-capable` pour corriger le warning Chrome.

### Tests Release readiness — PWA reactivity fix
- [x] `npm run check`
- [x] `npm test`

---

## UX follow-up

### Changements réalisés
- Login : bascule immédiate vers l’inscription si compte inexistant + focus automatique sur le premier champ (`Login.tsx`).
- Ressenti nageur : mode édition explicite avec bandeau, bouton d’action mis à jour et annulation dédiée (`Dashboard.tsx`).

---

## Lot 4.3.B — Admin Gestion des comptes

### Changements réalisés
- Gestion des comptes admin : recherche, filtre rôle (dont comité) et fiche utilisateur cliquable.
- RBAC renforcé côté UI (route admin only) + API `users_update`/`users_list` étendus pour le rôle comité.
- Mise à jour du rôle via sélection (table + fiche) avec mise à jour du cache.

### Tests T4.3.B
- [x] render : admin voit la page + liste
- [x] RBAC : non-admin -> accès refusé
- [x] update rôle : requête envoyée + UI mise à jour
- [x] `npm run check`
- [!] `npm test` (échec environnement : esbuild linux manquant)

---

## Auth wiring fix

### Changements réalisés
- Fallback endpoint côté client sur `window.location.origin` quand aucune config explicite n’est fournie.
- Centralisation de la construction des URLs d’auth dans `authRequests` (login, precheck, register).
- Test minimal garantissant que `auth_login_precheck` et `auth_login` utilisent l’endpoint configuré.

### Tests
- [x] `npm run check`
- [!] `npm test` (échec environnement : esbuild linux manquant)

---

## Hotfix UX/Login/Nav/Profil

### Changements réalisés
- Login : focus automatique sur le mot de passe quand il est requis, y compris via la touche Entrée.
- Redirection post-login alignée sur le rôle (coach/admin/comité) sans impacter les nageurs.
- Navigation coach restaurée avec l’onglet Coach en première position + icône Messagerie mise à jour.
- Profil : libellé du rôle affiché sous le nom et sections de records masquées hors nageur.
- Tests ajoutés : focus login, navigation coach, affichage profil par rôle.

### Tests
- [x] `npm run check`
- [x] `npm test`

---

## Lot 4.3.C — Musculation

### Changements réalisés
- Séances nageur : ordre des exercices aligné sur `DIM_seance_deroule` via `order_index` (fallback : ordre courant si les valeurs manquent).
- Coach : pré-remplissage des champs (séries/reps/%1RM/repos) lors de l’ajout d’un exercice à une séance à partir des valeurs de `DIM_exercices`.
- Tests ciblés pour l’ordre des séances et le pré-remplissage.

### Tests
- [x] `npm run check`
- [x] `npm test`

---

## Coach & Catalogue — Messagerie / Suivi / Natation / Musculation

### Changements réalisés
- Messagerie rapide coach : sélection d’un nageur **ou** d’un groupe pour l’envoi.
- Suivi nageurs : suppression du doublon “Anniversaires à venir”.
- Édition exercices muscu : modales avec scroll/safe-area pour éviter l’overflow iPhone.
- Catalogue natation : archivage **local-only** (localStorage, non synchronisé), suppression autorisée **uniquement** si aucune assignation ne référence `swim_catalog_id` ; sinon suppression désactivée (mode safe si assignations non vérifiables).

### Tests
- [x] `npm run check`
- [x] `npm test`

---

## Pointage — Lieux

### Changements réalisés
- Conversion du champ Lieu en liste déroulante avec panneau compact “Gérer les lieux” (ajout/suppression).
- Migration SQL : nouvelle table `timesheet_locations` + seed par défaut (Piscine, Compétition).
- Lieu par défaut réglé sur “Piscine” (sans option “Aucun”) + ajout du KPI histogramme heures/jour sur le dashboard.

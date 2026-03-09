# Design — Refonte UX Parcours Musculation Mobile

**Date** : 2026-03-09
**Contexte** : Le parcours athlète musculation est utilisé à 100% sur mobile en salle de sport avec réseau instable. L'audit a révélé des problèmes de layout (overflow, radius iPhone), de compréhension (cycle, auto repos), de performance (GIFs) et de friction (étapes inutiles, bannières disruptives).

## Principes

- **Zéro friction** : chaque écran = une seule action claire
- **Gym-first** : réseau instable, mains moites, attention limitée
- **Autonomie encadrée** : le nageur peut adapter sa séance mais le coach voit le résultat réel

---

## 1. Bannière cycle contextuelle (Preview)

Le sélecteur de cycle dans la liste des séances reste inchangé (3 boutons Endurance/Hypertrophie/Force).

Dans la **preview de la séance**, ajout d'une bannière colorée selon le cycle sélectionné :
- **Couleur** : teinte du cycle (bleu endurance, orange hypertrophie, rouge force)
- **Titre** : "Cycle Force sélectionné" (dynamique)
- **Description** : 1 phrase explicative ("Charges lourdes, peu de répétitions, récupération longue")
- **Recommandation coach** (si séance assignée avec cycle prédéfini) : "Recommandé par votre coach : Hypertrophie" + bouton "Changer" inline
- Les exercices listés en dessous affichent les params résolus pour CE cycle (séries × reps, charge, repos)

## 2. Fix bottom bar overflow + radius iPhone

**Preview** :
- `pb-44` (au lieu de `pb-36`) pour le contenu scrollable
- BottomActionBar : `bg-background/95 backdrop-blur-sm`, `rounded-t-2xl`, `border-t` subtile
- Bouton "Lancer la séance" : `rounded-2xl` complet
- Padding bottom `safe-area-inset-bottom` correct via `pb-[env(safe-area-inset-bottom)]`

**Focus mode** :
- Même traitement pour la bottom bar d'actions

## 3. Suppression Step 0

**Avant** : Preview → "Lancer" → Step 0 "COMMENCER SÉANCE" → Exercice 1
**Après** : Preview → "Lancer" → Exercice 1 directement

Supprimer le bloc `if (currentStep === 0)` dans WorkoutRunner. `handleLaunchFocus` crée déjà le run et set `activeRunnerStep = 1`. Le `initialStep` sera toujours ≥ 1.

## 4. Refonte bottom bar focus mode

**Avant** : 3 boutons au même niveau (Valider série, Repos, Passer)
**Après** :
- **Un seul bouton principal** : "Valider série" — pleine largeur, prominent
- **"Passer"** : lien texte discret sous le bouton principal
- **Suppression du bouton "Repos" manuel** et du toggle "Auto repos" — le repos est TOUJOURS automatique après validation d'une série (si `rest_seconds > 0`)
- Le nageur peut skip le repos depuis l'écran de repos lui-même

## 5. Timer repos full-screen enrichi

**Avant** : Grand compteur + boutons +30s/Reset/Pause/Passer confus

**Après** :
- **Zone haute (60%)** : Compteur circulaire (arc SVG animé) avec temps au centre en gros
- **Zone basse (40%)** : Carte "Prochain exercice" :
  - GIF miniature (préchargé)
  - Nom exercice + charge cible + reps cible
  - Note machine si existante
- **Boutons simplifiés** : "+30s" et "Passer" uniquement (suppression Reset et Pause)
- **Tap sur le compteur** = raccourci pour Passer

## 6. Fix scroll aperçu séance en focus

Le Sheet "Voir les séries" : ajouter `-webkit-overflow-scrolling: touch` et `overscroll-behavior: contain` pour iOS.
Rendre chaque exercice plus compact (une ligne par exercice au lieu d'une Card complète).

## 7. Suppression bannières disruptives en focus

- Les toasts save state ("Enregistrement...", "Enregistré") sont supprimés en focus mode
- Seuls les toasts d'erreur (variant destructive) persistent
- Le feedback de sauvegarde est porté par l'indicateur de connexion (point 8)

## 8. Indicateur connexion + sauvegarde locale optimiste

- **Pastille discrète** dans le header focus : point vert (connecté), orange (instable/sets en attente), rouge (offline)
- **Sauvegarde locale d'abord** : chaque `logStrengthSet` écrit en localStorage immédiatement, puis sync Supabase en arrière-plan
- **Sync queue** : les sets en attente de sync sont comptés (pastille orange avec nombre)
- Aucun blocage en cas d'échec réseau — le nageur continue, la sync reprend automatiquement

## 9. Optimisation GIFs

- Précharger le GIF du prochain exercice pendant le repos (affiché dans le timer enrichi)
- `fetchpriority="low"` sur les GIFs non visibles
- Placeholder gris animé pendant le chargement
- Limiter le décodage avec `max-width` CSS sur les containers

## 10. Substitution & ajout d'exercices

### Substitution (Preview + Focus)

**Preview** : Chaque exercice a un bouton "..." ou swipe-left → "Remplacer". Sheet bottom avec :
- Recherche dans le catalogue `dim_exercices`
- Filtre par même groupe musculaire en priorité
- Swap local uniquement (pas de mutation serveur)
- Badge "Modifié" sur l'exercice remplacé

**Focus** : Bouton "Remplacer" dans le menu "..." du header exercice. Remplacement à chaud.

### Ajout (Preview + Écran fin)

**Preview** : Bouton "+ Ajouter un exercice" en bas de la liste des exercices. Picker catalogue → exercice ajouté en fin de liste avec badge "Ajouté".

**Écran de fin** : Bouton "Continuer — ajouter des exercices" avant le formulaire difficulté/fatigue. Même picker, le nageur ajoute un par un, puis "Terminer" pour revenir à la complétion.

### Disclaimer responsabilité

Affiché **une seule fois** au premier geste de modification dans la session :
- Bannière warning jaune
- "Toute modification ou ajout se fait sous ta responsabilité. Le coach aura accès à la séance réelle effectuée. Des changements incohérents avec le travail demandé peuvent entraîner des risques de blessure ou une perte de performance."
- Bouton "J'ai compris" pour dismiss — ne réapparaît plus dans la session

### Traçabilité

Les logs contiennent l'`exercise_id` réel. Le diff template vs réel suffit pour que le coach voie les écarts. Pas de champ supplémentaire nécessaire.

---

## Hors scope

- Restructuration du numpad input (fonctionne bien)
- Refonte de l'écran de complétion (au-delà du bouton "Continuer")
- Historique des séances
- Sync bidirectionnelle offline complète (juste buffer write)
- Workflow de validation coach pour les modifications

# Rapport de conformité — Audit UI/UX competition

**Date :** 2026-02-07
**Branche :** `claude/verify-ui-ux-audit-kpf9c`
**Compilation TypeScript :** `npx tsc --noEmit` → 0 erreur

---

## PHASE 1 — Quick fixes

### 1.1 Emojis remplacés par des icônes Lucide SVG

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 1 | `SwimSessionConsultation.tsx` : 🔁 → `<Repeat />` | ✅ | L:12 import `Repeat`, L:254 `<Repeat className="mr-1 h-3 w-3" />` |
| 2 | `WorkoutRunner.tsx` : ⌫ → `<Delete />` + aria-label | ✅ | L:14 import `Delete`, L:972 `aria-label="Effacer le dernier caractère"`, L:974 `<Delete className="h-5 w-5" />` |
| 3 | `TimesheetTotals.tsx` : ▴▾ → `<ChevronUp/Down />` | ✅ | L:2 import, L:35 `<ChevronUp />` / `<ChevronDown />` |

### 1.2 cursor-pointer sur les éléments interactifs

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 4 | `AppLayout.tsx` : Desktop nav links | ✅ | L:60 `cursor-pointer` |
| 5 | `AppLayout.tsx` : Mobile nav items | ✅ | L:91 `cursor-pointer` |
| 6 | `Tile.tsx` : Bouton | ✅ | L:18 `cursor-pointer` |
| 7 | `Records.tsx` : Toggle piscine | ✅ | L:544 `cursor-pointer` |
| 8 | `TimesheetTotals.tsx` : Bouton Totaux | ✅ | L:32 `cursor-pointer` |

### 1.3 focus-visible:ring-2 sur les éléments interactifs

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 9 | `AppLayout.tsx` : Desktop nav links | ✅ | L:60 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |
| 10 | `AppLayout.tsx` : Mobile nav items | ✅ | L:91 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |
| 11 | `Tile.tsx` : Bouton | ✅ | L:19 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |
| 12 | `Records.tsx` : Toggle | ✅ | L:544 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |
| 13 | `TimesheetTotals.tsx` : Bouton | ✅ | L:32 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |
| 14 | `TimesheetShiftList.tsx` : Modifier/Suppr | ✅ | L:78,86 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |

### 1.4 motion-reduce:animate-none

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 15 | `AppLayout.tsx` : Badge notification pulse | ✅ | L:103 `animate-pulse motion-reduce:animate-none` |

### 1.5 Touch targets ≥ 44px

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 16 | `ScaleSelector5.tsx` : sm→h-10 w-10, default→h-11 w-11 | ✅ | L:24-26 `sm ? "h-10 w-10" : "h-11 w-11"` |
| 17 | `FlatScale.tsx` : Boutons h-11 | ✅ | L:54 `h-11` |
| 18 | `TimesheetShiftList.tsx` : min-h/min-w 44px | ✅ | L:78,86 `min-h-[44px] min-w-[44px]` |

### 1.6 Skeletons de chargement

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 19 | `StrengthCatalog.tsx` : Skeleton cards loading | ✅ | L:1025-1029 skeleton divs avec `animate-pulse` quand loading |
| 20 | `Coach.tsx` : Skeleton rows au lieu de texte | ✅ | L:572-580 skeleton rows animées (`animate-pulse`) au lieu de "Chargement des nageurs..." |

### 1.7 Correctifs divers

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 21 | `use-mobile.tsx` : `isMobile` init `false` | ✅ | L:6 `useState<boolean>(false)` |
| 22 | `use-toast.ts` : `TOAST_LIMIT = 3` | ✅ | L:8 `const TOAST_LIMIT = 3` |

---

## PHASE 2 — Accessibilité & tokens

### 2.1 Attributs ARIA

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 23 | `AppLayout.tsx` : Mobile nav role + aria-label | ✅ | L:78 `aria-label="Navigation principale"` (nav element natif) |
| 24 | `Records.tsx` : TabsTrigger aria-label + boutons édition aria-label | ✅ | L:468 `aria-label="Records de natation"`, L:478 `aria-label="Records de musculation"`, L:657 `aria-label="Modifier ${record.event_name}"` |
| 25 | `BottomSheet.tsx` : Backdrop role + aria-label, dialog + aria-modal | ✅ | L:19-24 `<button>` backdrop avec `aria-label="Fermer"`, L:26-27 `role="dialog" aria-modal="true"` |
| 26 | `TimesheetShiftForm.tsx` : dialog + aria-modal + aria-labels | ✅ | L:103-105 `role="dialog" aria-modal="true"`, L:141 `aria-label="Heure d'arrivée maintenant"`, L:162 `aria-label="Heure de sortie maintenant"`, L:173 `aria-label="Marquer comme en cours"` |
| 27 | `Coach.tsx` : Boutons 7j/30j/365j aria-pressed | ⚠️ | L:249,252,255 `aria-label="Période X jours"` sur `ToggleGroupItem` — ToggleGroup de shadcn gère `aria-pressed` en interne mais ce sont des `aria-label` pas `aria-pressed` explicites. Radix Toggle gère data-state et le rôle implicitement. |
| 28 | `IntensityDots.tsx` : role="img" + aria-label | ✅ | L:29 `role="img" aria-label="Intensité ${formatIntensityLabel(normalized)}"` |
| 29 | `BottomActionBar.tsx` : role="region" + aria-label="Actions" | ✅ | L:13-14 `role="region" aria-label="Actions"` |
| 30 | `ScrollContainer.tsx` : role="region" + aria-label | ✅ | L:11 `role="region" aria-label="Contenu défilable"` |
| 31 | `Dashboard.tsx` : IconButton aria-label + focus-visible | ✅ | L:476 `aria-label={label}`, L:472 classes transition standard |
| 32 | `Strength.tsx` : aria-label sur info/settings/retour | ✅ | L:738 `aria-label="Informations sur le calcul du 1RM"`, L:749 `aria-label="Paramètres"`, L:1051 `aria-label="Retour"` |
| 33 | `Login.tsx` : aria-label email/password | ✅ | L:124 `aria-label="Email"`, L:142 `aria-label="Mot de passe"` |
| 34 | `not-found.tsx` : AlertCircle aria-hidden | ✅ | L:10 `aria-hidden="true"` |
| 35 | `Administratif.tsx` : aria-current="page" | ✅ | L:369,377 `aria-current={activeTab === "..." ? "page" : undefined}` |

### 2.2 Couleurs hardcodées → tokens thème

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 36 | `Administratif.tsx` : tokens thème | ✅ | Plus de `bg-slate-900 text-white` (→ `bg-primary text-primary-foreground` L:368). Plus de `border-red-200` (→ `border-destructive/20` L:391). Plus de `border-slate-200 bg-white` (→ `border-border bg-card` L:365,403). Plus de `text-slate-500` (→ `text-muted-foreground` L:386). FAB `bg-destructive` L:473. |
| 37 | `SwimSessionView.tsx` : tokens thème | ✅ | Plus de `border-slate-200` → `border-border` L:115. Plus de `bg-slate-50` → `bg-muted` L:189,217. (Fichier à `src/pages/SwimSessionView.tsx`) |
| 38 | `not-found.tsx` : tokens thème | ✅ | `bg-background` L:6, `text-destructive` L:10, `text-foreground` L:11, `text-muted-foreground` L:14 |
| 39 | `Dashboard.tsx` : tokens thème | ⚠️ | Majorité convertie (`bg-muted`, `border-border`, `text-foreground`). **Restent** : `bg-zinc-300` L:1173,1179,1319,1325, `border-zinc-900` L:1263,1508, `ring-zinc-900/10` L:1614, `bg-zinc-200` L:1636 — 8 occurrences non converties. |
| 40 | `IntensityDots.tsx` : inactive dot bg-muted | ✅ | L:36 `bg-muted` pour dot inactif. Couleurs emerald→red intentionnellement conservées L:5-11. |
| 41 | `TimesheetShiftForm.tsx` : tokens thème | ✅ | Plus de `bg-slate-200` / `border-slate-200 bg-white text-slate-900`. L:110 `bg-card`, L:142,163,174 `border-border bg-card text-card-foreground` |
| 42 | `TimesheetTimeWheel.tsx` : gradients #fff | ❌ | L:117 `linear-gradient(#fff, rgba(255,255,255,0))` et L:121 `linear-gradient(rgba(255,255,255,0), #fff)` — **non converti** en `hsl(var(--background))`. Container OK (`border-border bg-card` L:114). |
| 43 | `Login.tsx` : bg-foreground au lieu de bg-black | ✅ | L:113 `bg-foreground` |
| 44 | `SwimCatalog.tsx` : tokens thème | ⚠️ | `bg-primary text-primary-foreground` OK (L:592,602). `text-destructive hover:bg-destructive/10` OK (L:716,793,1018). **Restent** : `bg-slate-300` fallback L:676,943, `🔁` emoji L:637. |
| 45 | `CoachAssignScreen.tsx` : border-l-primary | ✅ | L:229 `border-l-primary` |
| 46 | `HallOfFame.tsx` : couleurs podium conservées | ⚠️ | Couleurs jaune/orange/rose/emerald/violet conservées (L:50,73,102,128,158,184) — **correct** mais le commentaire explicatif demandé est **absent**. |

### 2.3 prefers-reduced-motion sur toutes les animations

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 47 | `Dashboard.tsx` : animate-in + motion-reduce | ✅ | Aucune occurrence de `animate-in`/`slide-in` dans Dashboard.tsx (pas de classes d'animation dans ce fichier) |
| 48 | `SwimCatalog.tsx` : slide-in-from-bottom-4 | ✅ | L:479 `animate-in slide-in-from-bottom-4 motion-reduce:animate-none` |
| 49 | `Progress.tsx` : 2× animate-in fade-in | ✅ | L:398,500 `animate-in fade-in motion-reduce:animate-none` |
| 50 | `Strength.tsx` : 2× animate-in fade-in | ✅ | L:641,764 `animate-in fade-in motion-reduce:animate-none` (+ L:1044) |
| 51 | `Coach.tsx` : animate-in fade-in | ✅ | L:465 `animate-in fade-in motion-reduce:animate-none` |
| 52 | `HallOfFame.tsx` : slide-in-from-left/right | ✅ | L:71,156 `animate-in slide-in-from-left/right-4 motion-reduce:animate-none` |
| 53 | `Login.tsx` : fade-in zoom-in | ✅ | L:111 `animate-in fade-in zoom-in duration-500 motion-reduce:animate-none` |

### 2.4 Skeletons de chargement supplémentaires

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 54 | `SwimCatalog.tsx` : skeleton cards | ❌ | Pas d'`isLoading` extrait du useQuery, pas de skeleton. Sessions affichées directement. |
| 55 | `Progress.tsx` : skeleton graphique loading | ❌ | Pas de skeleton sur le chargement des graphiques. |
| 56 | `Strength.tsx` : skeleton cards focus mode | ✅ | L:720-727 skeleton structure (`animate-pulse`) quand la session n'est pas trouvée en focus mode. |
| 57 | `RecordsAdmin.tsx` : skeleton table rows | ✅ | L:205-215 skeleton rows animées (`animate-pulse`) pendant isLoading. |
| 58 | `RecordsClub.tsx` : skeleton table rows | ✅ | L:189-193 skeleton cards (`animate-pulse`) pendant isLoading. |
| 59 | `Notifications.tsx` : skeleton message cards | ✅ | L:270-278 skeleton cards (`animate-pulse`) pendant isLoading. |
| 60 | `WorkoutRunner.tsx` : skeleton structure initial | ⚠️ | L:406-435 : Écran initial présent avec animation (`animate-in zoom-in`), mais ce n'est pas un skeleton — c'est un écran d'accueil statique avec un `animate-pulse` sur l'icône (L:409). Pas strictement un skeleton de chargement. |

### 2.5 États d'erreur améliorés

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 61 | `Records.tsx` : erreur styled destructive | ✅ | L:577 `border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive` |
| 62 | `RecordsClub.tsx` : bouton Réessayer | ✅ | L:199-200 `<Button onClick={() => refetch()}>Réessayer</Button>` |
| 63 | `SwimCatalog.tsx` : erreur UI si getAssignments échoue | ❌ | Pas de `isError` extrait, pas d'état d'erreur UI pour le query `getAssignmentsForCoach()`. |
| 64 | `Login.tsx` : erreur styled destructive | ✅ | L:151 `rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive` |

### 2.6 Warnings changements non sauvegardés

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 65 | `SwimCatalog.tsx` : useBeforeUnload | ✅ | L:42 import, L:255 `useBeforeUnload(isCreating)` |
| 66 | `StrengthCatalog.tsx` : useBeforeUnload si isDirty | ✅ | L:14 import, L:277 `useBeforeUnload(isCreating \|\| editingSessionId !== null)` |

---

## PHASE 3 — Polish & performance

### 3.1 Échelle z-index unifiée

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 67 | Config Tailwind : z-index custom | ✅ | `src/index.css` L:49-56 `@theme inline` avec `--z-index-overlay: 30` à `--z-index-toast: 70` |
| 68 | `AppLayout.tsx` : z-nav, z-mobilenav | ✅ | L:45 `z-nav`, L:80 `z-mobilenav` |
| 69 | `Dashboard.tsx` : z-modal, z-overlay | ✅ | L:346 `z-overlay`, L:354 `z-modal`, L:410 `z-overlay`, L:418 `z-modal` |
| 70 | `BottomActionBar.tsx` : z-bar | ✅ | L:17 `z-bar` |
| 71 | `Strength.tsx` : FAB z-fab | ✅ | Pas de FAB dans Strength.tsx ; utilise `<BottomActionBar>` L:1255 qui a `z-bar` en interne. L'Administratif.tsx a `z-fab` L:473 pour son FAB. |

### 3.2 Layout shift (CLS) fixes

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 72 | `AppLayout.tsx` : padding main uniforme | ✅ | L:72 `container max-w-lg mx-auto p-4 md:max-w-3xl lg:max-w-4xl` — padding `p-4` constant |
| 73 | `Dashboard.tsx` : invisible/visible pour header | ❌ | L:1109 utilise `fixed` pour le header mobile, et L:1134 `hidden sm:flex` pour le desktop header — `hidden/flex` au lieu de `invisible/visible`. |
| 74 | `ModalMaxSize.tsx` : min-h-[200px] | ✅ | L:13 `min-h-[200px]` |
| 75 | `Records.tsx` : scroll-mt-* sticky header | ✅ | L:434,456 `scroll-mt-16` |
| 76 | `Strength.tsx` : taille titre uniforme | ✅ | Un seul `text-3xl` L:733. Pas de variation `text-2xl/text-3xl`. |

### 3.3 Responsive fixes

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 77 | `AppLayout.tsx` : plus de max-w-md seul | ✅ | L:72 `max-w-lg mx-auto ... md:max-w-3xl lg:max-w-4xl` |
| 78 | `Dashboard.tsx` : drawer max-h dynamique | ⚠️ | L:356 `h-[88vh] ... supports-[height:100dvh]:h-[88dvh]` — utilise `88vh/88dvh` **pas** `calc(100dvh-env(...))`. |
| 79 | `Records.tsx` : grid min-w-0 + overflow-x-auto | ⚠️ | L:630 `min-w-0` sur les cellules de contenu, mais pas de `overflow-x-auto` sur le conteneur de la grille. |
| 80 | `Notifications.tsx` : break-words + min-w-0 | ✅ | L:329,367 `min-w-0` et L:336,374 `break-words` |
| 81 | `HallOfFame.tsx` : grid-cols-1 md:grid-cols-2 | ⚠️ | L:72,157 `grid gap-6 md:grid-cols-2` — pas de `grid-cols-1` explicite (implicite par défaut). Pas de `grid-cols-2 md:grid-cols-2` redondant donc c'est correct, mais techniquement la classe `grid-cols-1` explicite n'est pas présente. |

### 3.4 Formulaires et UX

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 82 | `Login.tsx` : id + htmlFor | ⚠️ | Login form : `id="login-email"` L:123, `id="login-password"` L:141 **mais pas de `<Label htmlFor>`** — les labels sont absents sur le login form. Le register dialog a `htmlFor` correct (L:262,272,283,311). |
| 83 | `CoachMessagesScreen.tsx` : maxLength + compteur | ✅ | L:163 `maxLength={500}`, L:165 `{messageBody.length}/500` |
| 84 | `RecordsAdmin.tsx` : feedback visuel onBlur | ⚠️ | L:248-249 `onBlur` déclenche `updateSwimmerEntry` qui appelle un mutation. L:67 toast `"Nageur ajouté"` mais pas de toast spécifique après update onBlur (L:83 toast seulement en erreur). Pas de feedback positif visible après save onBlur. |
| 85 | `StrengthCatalog.tsx` : highlight drag-and-drop | ❌ | L:886-891 drag/drop natif avec `onDragOver`/`onDrop` mais **pas de highlight visuel** (pas de `dragging` ou `bg-primary/10` class conditionnelle sur le drop target). |

### 3.5 Performance UI

| # | Item | Statut | Détail |
|---|------|--------|--------|
| 86 | Web fonts font-display: swap | ✅ | `index.html` L:27 `display=swap` dans l'URL Google Fonts |
| 87 | Images below-fold loading="lazy" | ⚠️ | `Strength.tsx` L:1202 `loading="lazy"` OK. Mais `WorkoutRunner.tsx` L:533,789 `<img>` sans `loading="lazy"`. `SwimCatalog.tsx` L:989 `<img>` sans `loading="lazy"`. `Login.tsx` L:114 logo above-fold (OK sans lazy). |
| 88 | Boutons mutation disabled={isPending} + spinner | ⚠️ | Beaucoup sont OK (`Login.tsx` L:157, `Profile.tsx` L:285,347,386, `Records.tsx` L:725,811, `CoachMessagesScreen.tsx` L:172). Mais certaines mutations n'ont pas de spinner visible (juste texte "Enregistrement..."). Pas de composant `<Spinner>` systématique. |

---

## VÉRIFICATIONS GLOBALES

### 1. Compilation TypeScript
```
npx tsc --noEmit → ✅ 0 erreur
```

### 2. Emojis restants
```
grep -rn '🔁\|⌫\|▴\|▾' src/
→ ❌ 1 résultat : src/pages/coach/SwimCatalog.tsx:637 — 🔁 encore présent
```

### 3. Couleurs hardcodées restantes (hors /ui/)
```
→ ⚠️ Nombreuses occurrences restantes :
  - SwimSessionConsultation.tsx : 18 occurrences (slate-200, bg-slate-50, text-slate-900, text-slate-600)
  - TimesheetShiftList.tsx : 14 occurrences (slate-200, text-slate-500, text-slate-900, text-slate-700)
  - TimesheetTotals.tsx : 12 occurrences (slate-200, text-slate-500, text-slate-900)
  - IntensityDotsSelector.tsx : 1 occurrence (bg-slate-200)
  - SwimCatalog.tsx : 2 occurrences (bg-slate-300 fallback)
  - Dashboard.tsx : 8 occurrences (zinc-300, zinc-900, zinc-200)
  - TimesheetTimeWheel.tsx : 2 occurrences (#fff gradients)
```

### 4. Animations sans motion-reduce (hors /ui/ et skeletons `animate-pulse`)
```
→ ⚠️ animate-pulse sans motion-reduce sur skeletons :
  - WorkoutRunner.tsx:409, Coach.tsx:576-578, Notifications.tsx:273,
    Records.tsx:142, RecordsAdmin.tsx:209-212, RecordsClub.tsx:192,
    Strength.tsx:721-725, StrengthCatalog.tsx:1025-1091
  Note : animate-pulse sur des skeletons est généralement acceptable.
```

### 5. Texte "Chargement" brut restant
```
→ ⚠️ 7 occurrences restantes :
  - Coach.tsx:206,270 ("Chargement..." dans KPI cards)
  - Login.tsx:299 (placeholder Select "Chargement...")
  - Profile.tsx:229 (placeholder Select "Chargement...")
  - Progress.tsx:692 (bouton "Chargement..." fetchNextPage)
  - Strength.tsx:1327 (bouton "Chargement..." fetchNextPage)
  - CoachMessagesScreen.tsx:112 (placeholder Select "Chargement...")
  Note : Certains sont dans des Select placeholders (acceptable) ou des boutons "load more" (acceptable).
```

### 6. z-index hardcodés restants (hors /ui/)
```
→ ✅ Aucun z-50/z-40/z-[60] dans le code applicatif (seulement dans shadcn/ui)
```

---

## TABLEAU RÉCAPITULATIF

| Phase | Catégorie | Total items | ✅ Fait | ⚠️ Partiel | ❌ Non fait | % |
|-------|-----------|-------------|---------|------------|-------------|---|
| 1 | Emojis → SVG | 3 | 3 | 0 | 0 | 100% |
| 1 | cursor-pointer | 5 | 5 | 0 | 0 | 100% |
| 1 | focus-visible | 6 | 6 | 0 | 0 | 100% |
| 1 | motion-reduce | 1 | 1 | 0 | 0 | 100% |
| 1 | Touch targets | 3 | 3 | 0 | 0 | 100% |
| 1 | Skeletons | 2 | 2 | 0 | 0 | 100% |
| 1 | Divers | 2 | 2 | 0 | 0 | 100% |
| 2 | ARIA | 13 | 12 | 1 | 0 | 96% |
| 2 | Tokens couleurs | 11 | 6 | 3 | 2 | 68% |
| 2 | reduced-motion | 7 | 7 | 0 | 0 | 100% |
| 2 | Skeletons | 7 | 4 | 1 | 2 | 64% |
| 2 | États erreur | 4 | 3 | 0 | 1 | 75% |
| 2 | Unsaved changes | 2 | 2 | 0 | 0 | 100% |
| 3 | z-index | 5 | 5 | 0 | 0 | 100% |
| 3 | CLS | 5 | 4 | 0 | 1 | 80% |
| 3 | Responsive | 5 | 2 | 3 | 0 | 70% |
| 3 | Formulaires | 4 | 1 | 2 | 1 | 38% |
| 3 | Performance | 3 | 1 | 2 | 0 | 67% |
| **TOTAL** | | **88** | **69** | **12** | **7** | **78%** |

---

## DÉTAIL DES ITEMS ⚠️ ET ❌

### ❌ Items non implémentés (7)

1. **TimesheetTimeWheel.tsx L:117,121** — Gradients `#fff` non convertis en `hsl(var(--background))`.
   ```tsx
   // Actuel :
   style={{ background: "linear-gradient(#fff, rgba(255,255,255,0))" }}
   // Attendu :
   style={{ background: "linear-gradient(hsl(var(--background)), transparent)" }}
   ```

2. **Dashboard.tsx L:1173,1179,1263,1319,1325,1508,1614,1636** — Couleurs `zinc-*` hardcodées restantes.
   ```tsx
   // Remplacer bg-zinc-300 → bg-muted, border-zinc-900 → border-foreground,
   // bg-zinc-200 → bg-muted, ring-zinc-900/10 → ring-foreground/10
   ```

3. **SwimCatalog.tsx** — Pas de skeleton cards pendant le chargement et emoji 🔁 restant L:637.
   ```tsx
   // Ajouter isLoading au useQuery et afficher des skeletons
   // Remplacer 🔁 par <Repeat />
   ```

4. **Progress.tsx** — Pas de skeleton graphique pendant le chargement.

5. **SwimCatalog.tsx** — Pas d'état d'erreur UI si `getAssignmentsForCoach()` échoue.

6. **Dashboard.tsx L:1109,1134** — Utilise `hidden/flex` au lieu de `invisible/visible` pour le header.

7. **StrengthCatalog.tsx** — Pas de highlight visuel pendant le drag-and-drop.

### ⚠️ Items partiellement implémentés (12)

1. **Coach.tsx** — `ToggleGroupItem` a `aria-label` mais pas `aria-pressed` explicite (géré implicitement par Radix).
2. **Dashboard.tsx** — Majorité des couleurs converties mais 8 `zinc-*` restantes.
3. **SwimCatalog.tsx** — Tokens OK pour l'essentiel mais `bg-slate-300` fallback L:676,943.
4. **HallOfFame.tsx** — Couleurs podium conservées correctement mais commentaire explicatif absent.
5. **WorkoutRunner.tsx** — Écran initial a un `animate-pulse` sur l'icône, pas un vrai skeleton de chargement.
6. **Dashboard.tsx** — Drawer `88vh/88dvh` au lieu de `calc(100dvh-env(...))`.
7. **Records.tsx** — `min-w-0` sur les cellules mais pas de `overflow-x-auto` sur le conteneur.
8. **HallOfFame.tsx** — Grid correct (`grid gap-6 md:grid-cols-2`) mais `grid-cols-1` pas explicite.
9. **Login.tsx** — `id` sur inputs mais pas de `<Label htmlFor>` sur le formulaire de connexion principal.
10. **RecordsAdmin.tsx** — `onBlur` save fonctionne mais pas de feedback toast positif de confirmation.
11. **Images** — Certains `<img>` below-fold sans `loading="lazy"` (WorkoutRunner, SwimCatalog).
12. **Boutons mutation** — La plupart ont `disabled={isPending}` mais pas de spinner SVG systématique.

### Couleurs hardcodées dans des composants non listés dans l'audit

Les fichiers suivants n'étaient **pas listés** dans l'audit comme devant être convertis, mais contiennent encore des couleurs `slate-*` :
- `SwimSessionConsultation.tsx` — 18 occurrences `slate-*`
- `TimesheetShiftList.tsx` — 14 occurrences `slate-*`
- `TimesheetTotals.tsx` — 12 occurrences `slate-*`
- `IntensityDotsSelector.tsx` — 1 occurrence `bg-slate-200`

---

## SCORE FINAL

| Métrique | Valeur |
|----------|--------|
| **Items vérifiés** | 88 |
| **✅ Fait** | 69 (78%) |
| **⚠️ Partiel** | 12 (14%) |
| **❌ Non fait** | 7 (8%) |
| **Taux de complétion (✅ seuls)** | **78%** |
| **Taux de complétion (✅ + ⚠️)** | **92%** |
| **Phase 1** | **100%** (22/22 ✅) |
| **Phase 2** | **77%** (34/44 ✅, 5 ⚠️, 5 ❌) |
| **Phase 3** | **59%** (13/22 ✅, 7 ⚠️, 2 ❌) |

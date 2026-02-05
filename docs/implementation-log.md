# Journal d'implémentation

Ce document trace l'avancement des tâches et migrations.

---

## 2026-02-05 — Migration Supabase (en cours)

**Branche** : `claude/cloudflare-to-supabase-migration-Ia5Pa`

### Complété ✅

| Tâche | Commit | Notes |
|-------|--------|-------|
| Migration schéma D1 → PostgreSQL | `00001-00006` | 6 fichiers migration |
| Edge Function ffn-sync | `029771b` | Sync records FFN |
| Edge Function admin-user | — | Gestion utilisateurs |
| Fix CORS headers ffn-sync | `029771b` | Headers sur toutes les réponses |
| Fix record_type='comp' FFN | `1bd610e` | Records FFN en section compétition |
| Fix toggle 25m/50m Records | `840e36c` | useMemo retournait undefined |
| Références Cloudflare → Supabase | `1aa0e99` | Profile.tsx, Records.tsx |
| Redesign liste exercices muscu | `b73611e` | Vue compacte mobile-first |
| Fix bouton "Lancer la séance" | — | z-index BottomActionBar |
| Fix padding reader mode | — | pb-28 → pb-40 |
| Mise à jour README | — | Architecture Supabase |
| Création FEATURES_STATUS.md | — | Matrice fonctionnalités |

### En cours 🔧

| Tâche | Priorité | Notes |
|-------|----------|-------|
| GIF exercices | MOYENNE | Certains exercices ont URL null |
| Commit et push | — | Finaliser PR |

### À faire 📋

| Tâche | Priorité | Effort |
|-------|----------|--------|
| Activer `coachStrength` | HAUTE | 2h |
| Tests unitaires critiques | HAUTE | 4h |
| Refactor api.ts en modules | MOYENNE | 8h |
| Remplacer `any` par types | BASSE | 4h |

---

## 2025-09-27 — Initialisation suivi

**Branche** : `work`

- Création du fichier implementation-log.md
- Snapshot audit README

---

## Workflow de vérification

À chaque itération :

```bash
# Vérifier la branche
git rev-parse --abbrev-ref HEAD

# Vérifier les commits non poussés
git log --oneline --decorate -n 5

# Vérifier l'état
git status -sb

# Build
npm run build
```

---

## Commits récents

```
b73611e Redesign strength exercise list for mobile-first UX
840e36c Fix useMemo not returning filtered records
1aa0e99 Update Cloudflare references to Supabase
1bd610e Set record_type='comp' for FFN swim records
029771b Fix CORS headers on ffn-sync edge function
9865306 Add supabase/.temp/ to gitignore
a37433e Switch to branch-based GitHub Pages deployment
```

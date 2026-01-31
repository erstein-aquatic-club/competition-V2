# Roadmap data contract (front ↔ Worker ↔ D1)

Ce document couvre les besoins **long terme** : impacts data (tables D1), endpoints Worker à ajuster et mapping front ↔ Worker ↔ D1. Il sert de contrat de données pour implémenter la roadmap listée dans le README. La majorité des endpoints listés sont **déjà implémentés** ; la roadmap actuelle vise surtout des ajustements de logique et d’UX.

> **Légende** :
> - ✅ = déjà présent dans `schema.sql`.
> - 🔜 = nécessite uniquement l’implémentation côté Worker/front.
> - 🧭 = décision à finaliser (voir sections “Manques / décisions”).

---

## 1) Tables nécessaires par feature (roadmap long terme)

| Feature (roadmap) | Tables D1 concernées | Notes |
| --- | --- | --- |
| T2 — Authentification (refonte) | `users` ✅ | Aucun changement de table attendu (durcir password + collision username). |
| T3 — Natation (améliorations) | `swim_sessions_catalog`, `swim_session_items`, `DIM_sessions` ✅ | Ajustements de logique/calcul, pas de nouvelles tables. |
| T4 — Correctifs UX & cohérence | `notifications`, `notification_targets`, `users` ✅ | Fiabiliser threads + non‑lu, pas de nouvelles tables. |
| T5 — Pixel‑perfect UI | — | Pas d’impact data. |
| Qualité & tests | — | Pas d’impact data. |

---

## 2) Endpoints Worker read/write (référence + ajustements)

Le Worker utilise la query string `action=...` + JSON en POST. Les endpoints ci-dessous servent de **référence** (majoritairement implémentés). La roadmap actuelle nécessite surtout des **ajustements** de logique.

### Endpoints existants (référence)

| Méthode | action | Usage | Tables D1 |
| --- | --- | --- | --- |
| GET | (vide) | Healthcheck | — |
| GET | `get` | Liste séances natation par `athleteName` | `DIM_sessions` |
| GET | `hall` | Hall of Fame natation | `DIM_sessions` |
| GET | `exercises` | Liste exercices muscu | `DIM_exercices` |
| POST | (vide) | Ajout séance natation | `DIM_sessions` |
| POST | `exercises_add` | Ajout exercice muscu | `DIM_exercices` |
| POST | `exercises_update` | MAJ exercice muscu | `DIM_exercices` |
| GET | `dim_seance` | Liste séances coach (legacy) | `dim_seance` |
| GET | `dim_seance_deroule` | Détail séance coach (legacy) | `dim_seance_deroule` |
| POST | `dim_seance_deroule_add` | Ajout exercice séance (legacy) | `dim_seance_deroule` |
| POST | `dim_seance_deroule_replace` | Remplacement séquence (legacy) | `dim_seance_deroule` |

### Endpoints à ajuster (roadmap T2–T4)

| Roadmap | Endpoints concernés | Ajustements attendus |
| --- | --- | --- |
| T2 — Authentification | `auth_login`, `auth_refresh`, `users_create` | Mot de passe obligatoire + support usernames identiques. |
| T3 — Natation | `swim_catalog_upsert`, `get` | Calcul distance fiable + rendu modalités/équipements. |
| T4 — Messagerie | `notifications_send`, `notifications_list` | Threads systématiques + badge non‑lu fiable + nom coach. |

---

## 3) Indexes D1 (colonnes clés)

Les indexes ci-dessous ont été ajoutés au schéma D1 pour accélérer les lectures par `athlete_id`, `created_at` et autres colonnes clés :

- `users(created_at)`
- `group_members(user_id)`
- `notifications(created_at)`, `notifications(expires_at)`
- `notification_targets(notification_id)`
- `DIM_sessions(athlete_id, sessionDate)`, `DIM_sessions(created_at)`
- `swim_records(record_date)`
- `swim_sessions_catalog(created_by)`, `swim_sessions_catalog(created_at)`
- `strength_sessions(created_by)`
- `session_assignments(assigned_by, scheduled_date)`
- `strength_session_runs(assignment_id, status)`
- `strength_set_logs(completed_at)`
- `user_profiles(updated_at)`
- `dim_seance(numero_seance)`

> 🧭 **À vérifier dans le repo** : ces indexes doivent être présents dans `cloudflare-worker/schema.sql` et/ou `cloudflare-worker/migrations/`. Si ce n’est pas le cas, ajouter des migrations pour éviter un décalage entre ce document et la base Cloudflare.

---

## 4) Mapping front ↔ Worker ↔ D1 (état actuel)

| Front (module/onglet) | Worker (action) | Tables D1 |
| --- | --- | --- |
| Saisie séance natation | POST `(action vide)` | `DIM_sessions` |
| Progression > Mes séances | GET `action=get` | `DIM_sessions` |
| Hall of Fame natation | GET `action=hall` | `DIM_sessions` |
| Coach > Exercices muscu | GET/POST `action=exercises*` | `DIM_exercices` |
| Fiche nageur (infos + objectifs) | GET/POST `users_get`/`users_update` | `users`, `user_profiles` |
| Notifications | GET/POST `notifications_*` | `notifications`, `notification_targets` |
| Catalogue séances natation | GET/POST `swim_catalog_*` | `swim_sessions_catalog`, `swim_session_items` |
| Catalogue séances muscu | GET/POST `strength_catalog_*` | `strength_sessions`, `strength_session_items` |
| Assignations séances | GET/POST `assignments_*` | `session_assignments` |
| Exécution séance muscu | POST `strength_run_*` + `strength_set_log` | `strength_session_runs`, `strength_set_logs` |
| Historique muscu | GET `strength_history` | `strength_session_runs`, `strength_set_logs` |

---

## 5) Convention uniforme de réponse API (à implémenter)

Tous les endpoints devraient répondre avec une structure uniforme :

```json
// succès
{ "ok": true, "data": { ... }, "meta": { ... } }

// erreur
{ "ok": false, "error": "Message lisible", "code": "ERR_CODE" }
```

**Recommandations :**
- Utiliser `code` pour normaliser les erreurs (`ERR_AUTH`, `ERR_VALIDATION`, `ERR_NOT_FOUND`, `ERR_RATE_LIMIT`).
- Retourner `meta.pagination` pour toutes les listes.

---

## 6) Pagination & filtres (standard)

### Paramètres communs (listings)
- `limit` (default 50, max 200)
- `offset` (ou `cursor`)
- `order` (`asc` / `desc`)
- `from` / `to` (dates ISO) si pertinent

### Exemples d’application
- `notifications_list`: filtre par `status`, `type`, `target_*`, pagination.
- `assignments_list`: filtre par `status`, `assignment_type`.
- `strength_history`: filtre par `status`, `from`, `to`.

---

## 7) Schémas de payloads (types & champs requis)

### Auth
```json
// auth_login
{ "identifier": "email|display_name", "password": "string" }

// auth_refresh
{ "refresh_token": "string" }
```

### Users
```json
// users_create
{ "display_name": "string", "role": "athlete|coach|admin", "email": "string", "password": "string" }

// users_update
{ "user_id": "string|number", "display_name?": "string", "email?": "string", "birthdate?": "YYYY-MM-DD" }
```

### Notifications
```json
// notifications_send
{
  "title": "string",
  "body": "string",
  "type": "message|assignment|birthday",
  "targets": [{ "target_user_id": "id" } | { "target_group_id": "id" }]
}
```

### Assignments
```json
// assignments_create
{
  "assignment_type": "swim|strength",
  "session_id": "id",
  "target_user_id?": "id",
  "target_group_id?": "id",
  "scheduled_date?": "YYYY-MM-DD"
}
```

### Strength runs
```json
// strength_run_start
{ "assignment_id": "id", "athlete_id": "id" }

// strength_run_update
{ "run_id": "id", "progress_pct": 0, "status": "in_progress|completed|abandoned" }
```

> 🧭 **À compléter** : payloads détaillés pour `swim_catalog_*`, `strength_catalog_*`, `strength_set_log`.

---

## 8) Stratégie d’identifiants (athlete_id vs athleteName)

### Décision recommandée
- **Pivoter sur `users.id`** (`athlete_id`) pour toutes les nouvelles features.
- Conserver `athleteName` en **champ d’affichage** et compat legacy.

### Plan de transition
1. Ajouter `athlete_id` en POST de séance natation.
2. Supporter GET par `athlete_id` + `athleteName` (pendant migration).
3. Backfill D1 (mapper `athleteName` -> `users.id`).
4. Déprécier `athleteName` côté Worker (v2).

---

## 9) Auth & règles d’autorisation (RBAC)

### Rôles
- `athlete`: accès lecture/écriture sur ses données.
- `coach`: accès lecture sur son groupe + écriture (assignments, notifications).
- `admin`: accès global.

### Règles minimales
- `users_update`: uniquement `self` (athlete) ou `coach` sur ses athlètes.
- `notifications_send`: coach/admin uniquement.
- `assignments_create`: coach/admin uniquement.

---

## 10) Legacy (dim_seance / dim_seance_deroule)

### Options
- **Maintenir** (court terme) + versionner endpoints.
- **Migrer** vers `swim_sessions_catalog` (long terme).

### Plan de migration
1. Export `dim_seance` -> `swim_sessions_catalog`.
2. Export `dim_seance_deroule` -> `swim_session_items`.
3. Déprécier `dim_*` côté front & Worker.

---

## 11) Modules front à prévoir (structure)

> 🧭 Ces modules sont à créer pour aligner la roadmap.

- `js/modules/auth.js` (login, refresh, session)
- `js/modules/profile.js` (fiche nageur)
- `js/modules/notifications.js` (liste, read, send)
- `js/modules/assignments.js` (assignations)
- `js/modules/strengthRun.js` (séance guidée)
- `js/modules/records.js` (swim records + 1RM)

---

## 12) Sécurité, validations & limites

- Validation stricte (types, required, enums) côté Worker.
  - Exemple: `notifications_send` limite taille `body`, `title`.
- Rate limiting (limiter `notifications_send`, `users_create`).
- Logs d’erreurs uniformisés (`request_id`).

---

## 13) Check-list “prêt à implémenter”

Avant d’implémenter les features “à venir” :

1. ✅ Décider **stratégie IDs** (athlete_id vs athleteName).
2. ✅ Définir **auth + RBAC** (token, refresh, roles).
3. ✅ Ajouter **schema payloads** (types & champs requis).
4. ✅ Standardiser **réponses API**.
5. ✅ Valider **pagination** sur toutes les listes.
6. ✅ Aligner **migrations D1** (indexes réellement appliqués).
7. ✅ Documenter **legacy dim_seance** + plan de migration.
8. ✅ Créer **modules front** dédiés (auth, notifications, assignments, etc.).

# Suivi Natation - Cloudflare Worker Backend

This project contains the backend logic for the "Suivi Natation" application, designed to run on Cloudflare Workers with D1 database.

## Prerequisites

1.  Cloudflare Account
2.  Node.js & npm
3.  Wrangler CLI (`npm install -g wrangler`)

## Setup

1.  **Login to Cloudflare:**
    ```bash
    wrangler login
    ```

2.  **Create D1 Database:**
    ```bash
    wrangler d1 create suivi-natation-db
    ```
    Copy the `database_id` from the output.

3.  **Configure `wrangler.toml`:**
    Create a `wrangler.toml` file in this directory:
    ```toml
    name = "suivi-natation-worker"
    main = "src/index.js"
    compatibility_date = "2023-10-30"

    [[d1_databases]]
    binding = "DB"
    database_name = "suivi-natation-db"
    database_id = "<YOUR_DATABASE_ID>"
    ```

4.  **Initialize Schema:**
    ```bash
    wrangler d1 execute suivi-natation-db --file=./schema.sql
    ```

## Deployment

1.  **Deploy Worker:**
    ```bash
    wrangler deploy
    ```

2.  **Get URL:**
    Note the URL provided after deployment (e.g., `https://suivi-natation-worker.your-name.workers.dev`).

## Frontend Configuration

Update the frontend configuration (usually in a config file or environment variable) with your new Worker URL and any specific Token you decide to enforce.

## API conventions

### Response format

```json
// success
{ "ok": true, "data": { ... }, "meta": { ... } }

// error
{ "ok": false, "error": "Message lisible", "code": "ERR_CODE" }
```

### Authentication

- **Shared token** (optional): set `SHARED_TOKEN` and pass it via `Authorization: Bearer <token>`, `token` query param, or `token` in the JSON body.
- **JWT auth**: set `AUTH_SECRET`. Login returns an access token (15 min) + refresh token (30 days).
- **Password hashing**: `PASSWORD_HASH_ITERATIONS` controls PBKDF2 iterations (default/max: 100000).
- **Login rate limit**: `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS`, and `LOGIN_LOCK_SECONDS` control temporary lockouts.
- **Account creation**: `auth_login` returns `account_not_found` when the identifier is unknown. Use `auth_register` to create a new athlete with `group_id` and `birthdate`.
- Endpoints requiring roles enforce:
  - `athlete`: access only to own data.
  - `coach`/`admin`: manage assignments, notifications, catalogs, and user creation.

### Pagination & filters

List endpoints support `limit`, `offset`, `order=asc|desc`, and date range filters with `from`/`to` when applicable. Responses include `meta.pagination`.

## API Endpoints (Worker action)

### Health & legacy

- `GET /` : Healthcheck.
- `GET /?action=get&athleteName=<name>|athlete_id=<id>` : Swim sessions list (legacy).
- `GET /?action=hall&days=<n>` : Hall of fame.
- `GET /?action=strength_hall&days=<n>` : Strength hall of fame.
- `GET /?action=exercises` : Strength exercises.
- `POST /?action=exercises_add` : Create exercise.
- `POST /?action=exercises_update` : Update exercise.
- `GET /?action=dim_seance` : Legacy coach sessions.
- `GET /?action=dim_seance_deroule&numero_seance=<n>` : Legacy session detail.
- `POST /?action=dim_seance_deroule_add` : Add legacy item.
- `POST /?action=dim_seance_deroule_replace` : Replace legacy items.
- `POST /` : Sync a swim session (supports `athlete_id` + `athleteName` for legacy).

### Auth

- `POST /?action=auth_login` : `{ identifier, password }`
- `POST /?action=auth_register` : `{ identifier, password, group_id, birthdate, email? }`
- `POST /?action=auth_refresh` : `{ refresh_token }` (returns rotated refresh token)
- `POST /?action=auth_logout` : `{ refresh_token }`
- `GET /?action=auth_me`

### Users & groups

- `GET /?action=users_get&user_id=<id>|display_name=<name>`
- `POST /?action=users_create` : `{ display_name, role, email?, password? }`
- `POST /?action=users_update` : `{ user_id?, display_name?, email?, birthdate?, profile? }`
- `GET /?action=groups_get&group_id=<id>`
- `POST /?action=groups_add_member` : `{ group_id, user_id, role_in_group? }`

### Notifications

- `GET /?action=notifications_list&target_user_id=<id>&status=read|unread&type=message|assignment|birthday`
- `POST /?action=notifications_send` : `{ title, body, type, targets[] }`
- `POST /?action=notifications_mark_read` : `{ target_id }`

### Catalogs

- `GET /?action=swim_catalog_list`
- `POST /?action=swim_catalog_upsert` : `{ catalog, items[] }`
- `GET /?action=strength_catalog_list`
- `POST /?action=strength_catalog_upsert` : `{ session, items[] }`

### Assignments

- `POST /?action=assignments_create` : `{ assignment_type, session_id, target_user_id?, target_group_id?, scheduled_date? }`
- `GET /?action=assignments_list&target_user_id=<id>&status=assigned|in_progress|completed|cancelled`

### Strength runs

- `POST /?action=strength_run_start` : `{ assignment_id, athlete_id }`
- `POST /?action=strength_run_update` : `{ run_id, progress_pct?, status? }`
- `POST /?action=strength_set_log` : `{ run_id, exercise_id, set_index?, reps?, weight? }`
- `GET /?action=strength_history&athlete_id=<id>&status=in_progress|completed|abandoned`
- `GET /?action=strength_history_aggregate&athlete_id=<id>&period=day|week|month&from=2024-01-01&to=2024-01-31`

### Records

- `GET /?action=swim_records&athlete_id=<id>`
- `POST /?action=swim_records_upsert` : `{ athlete_id, event_name, pool_length?, time_seconds?, record_date? }`
- `POST /?action=one_rm_upsert` : `{ athlete_id, exercise_id, one_rm }`

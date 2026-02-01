-- =============================================================================
-- Migration 00006: Convert dim_seance/dim_seance_deroule → strength_sessions
--
-- The 10 predefined session templates (S1→S10) are unused legacy tables.
-- This migration converts them into strength_sessions + strength_session_items
-- so they appear in the athlete "Catalogue" tab, then drops the legacy tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Insert 10 strength_sessions from dim_seance
--    created_by = NULL (system-generated, no specific coach)
-- ---------------------------------------------------------------------------
INSERT INTO strength_sessions (id, name, description, created_by, created_at)
SELECT
  ds.id,
  ds.nom_seance,
  ds.description,
  NULL,
  now()
FROM dim_seance ds
ORDER BY ds.id
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Insert strength_session_items from dim_seance_deroule + dim_exercices
--
--    Each deroule row links a seance to an exercise (by numero_exercice = exercise id).
--    We pull default parameters from dim_exercices (endurance cycle as baseline).
--    block = 'main' for all (these templates don't distinguish warmup/main).
--    cycle_type = 'endurance' as default — coaches can edit per-item later.
-- ---------------------------------------------------------------------------
INSERT INTO strength_session_items (
  session_id, ordre, exercise_id, block, cycle_type,
  sets, reps, pct_1rm, rest_series_s, rest_exercise_s, notes
)
SELECT
  ss.id                              AS session_id,
  dsd.ordre                          AS ordre,
  dsd.numero_exercice                AS exercise_id,
  'main'                             AS block,
  'endurance'                        AS cycle_type,
  de.nb_series_endurance             AS sets,
  de.nb_reps_endurance               AS reps,
  de.pourcentage_charge_1rm_endurance AS pct_1rm,
  de.recup_series_endurance          AS rest_series_s,
  de.recup_exercices_endurance       AS rest_exercise_s,
  NULL                               AS notes
FROM dim_seance_deroule dsd
JOIN dim_seance ds ON ds.numero_seance = dsd.numero_seance
JOIN strength_sessions ss ON ss.id = ds.id
JOIN dim_exercices de ON de.id = dsd.numero_exercice
ORDER BY ss.id, dsd.ordre;

-- ---------------------------------------------------------------------------
-- 3. Reset sequences to avoid ID conflicts with future inserts
-- ---------------------------------------------------------------------------
SELECT setval('strength_sessions_id_seq', (SELECT COALESCE(MAX(id), 0) FROM strength_sessions));
SELECT setval('strength_session_items_id_seq', (SELECT COALESCE(MAX(id), 0) FROM strength_session_items));

-- ---------------------------------------------------------------------------
-- 4. Drop legacy tables (no longer referenced anywhere in the codebase)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_dim_seance_numero;
DROP TABLE IF EXISTS dim_seance_deroule;
DROP TABLE IF EXISTS dim_seance;

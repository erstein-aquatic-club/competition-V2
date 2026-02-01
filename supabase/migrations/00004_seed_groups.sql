-- Seed the real Erstein Aquatic Club groups (from Cloudflare D1 DIM_groupes).
-- These replace any previous generic seeds.

DELETE FROM groups WHERE true;
DELETE FROM dim_groupes WHERE true;

INSERT INTO groups (id, name, description) VALUES
  (1, 'Elite', NULL),
  (2, 'Performance', NULL),
  (3, 'Excellence', NULL)
ON CONFLICT (name) DO NOTHING;

INSERT INTO dim_groupes (id, name, description) VALUES
  (1, 'Elite', NULL),
  (2, 'Performance', NULL),
  (3, 'Excellence', NULL)
ON CONFLICT (name) DO NOTHING;

-- Reset sequences
SELECT setval('groups_id_seq', (SELECT COALESCE(MAX(id), 0) FROM groups));
SELECT setval('dim_groupes_id_seq', (SELECT COALESCE(MAX(id), 0) FROM dim_groupes));

-- =============================================================================
-- 00007_add_missing_exercise_gifs.sql
-- Add missing illustration_gif URLs to dim_exercices
-- Source: fitnessprogramer.com (free exercise GIF library)
-- =============================================================================

-- 40: Back Extension 45°
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2021/02/hyperextension.gif'
WHERE id = 40;

-- 41: Standing Calf Raise
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Standing-Calf-Raise.gif'
WHERE id = 41;

-- 42: Seated Soleus Raise
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2021/10/Weighted-Seated-Calf-Raise.gif'
WHERE id = 42;

-- 53: Rotational Med Ball Throw
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2023/12/Medicine-Ball-Rotational-Throw.gif'
WHERE id = 53;

-- 54: Med Ball Side Toss (using Step Behind Rotational as close match)
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2024/03/Step-Behind-Rotational-Med-Ball-Throw.gif'
WHERE id = 54;

-- 55: Med Ball Shot Put (using Overhead Throw as close match)
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2023/09/Medicine-Ball-Overhead-Throw.gif'
WHERE id = 55;

-- 56: Drop Jump to Stick
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2023/09/Depth-Jump-to-Hurdle-Hop.gif'
WHERE id = 56;

-- 57: Isometric Split Squat Hold (using Bulgarian Split Squat as close match)
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dumbbell-Bulgarian-Split-Squat.gif'
WHERE id = 57;

-- 58: Copenhagen Plank
UPDATE dim_exercices
SET illustration_gif = 'https://fitnessprogramer.com/wp-content/uploads/2025/03/Side-Plank-Hip-Adduction-Copenhagen-adduction.gif'
WHERE id = 58;

-- =============================================================================
-- Exercises still missing GIFs (no good match found):
-- 39: Sliding Leg Curl - needs floor/slider hamstring curl GIF
-- 43: Pogo Hops - needs pogo/ankle hop plyometric GIF
-- 44: Ankle Isometric Hold - needs ankle isometric exercise GIF
-- 59: Hip Airplane - needs hip airplane/tippy bird GIF
-- =============================================================================

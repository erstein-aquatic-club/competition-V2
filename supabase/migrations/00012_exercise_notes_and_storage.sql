-- Task 5: Add private notes column to one_rm_records (for swimmer machine settings etc.)
ALTER TABLE one_rm_records ADD COLUMN IF NOT EXISTS notes TEXT;

-- Task 3: Create storage bucket for exercise GIF uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-gifs', 'exercise-gifs', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for exercise GIFs
CREATE POLICY "exercise_gifs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-gifs');

-- Authenticated users can upload exercise GIFs
CREATE POLICY "exercise_gifs_auth_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exercise-gifs' AND auth.role() = 'authenticated');

-- Authenticated users can update their uploads
CREATE POLICY "exercise_gifs_auth_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'exercise-gifs' AND auth.role() = 'authenticated');

-- Authenticated users can delete exercise GIFs
CREATE POLICY "exercise_gifs_auth_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'exercise-gifs' AND auth.role() = 'authenticated');

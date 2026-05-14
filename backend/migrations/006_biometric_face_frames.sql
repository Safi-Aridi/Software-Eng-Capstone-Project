-- 006_biometric_face_frames.sql
-- Adds face_frame_urls JSONB column for storing Supabase Storage paths
-- of captured face frames (3 positions × 3 frames = 9 paths total).
--
-- Frame paths look like: "<application_id>/face_<position>_<n>.jpg"
-- where position ∈ {center, right, left} and n ∈ {1, 2, 3}.

ALTER TABLE biometric_data
  ADD COLUMN IF NOT EXISTS face_frame_urls JSONB DEFAULT '[]'::jsonb;

-- Ensure one biometric_data row per application so ON CONFLICT works.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'biometric_data_application_id_key'
  ) THEN
    ALTER TABLE biometric_data
      ADD CONSTRAINT biometric_data_application_id_key UNIQUE (application_id);
  END IF;
END$$;

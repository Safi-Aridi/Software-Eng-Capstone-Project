-- =============================================================================
-- NPIS - Migration 005
-- Supabase Storage bucket for uploaded passport application documents.
-- Safe to run multiple times in the Supabase SQL editor.
-- =============================================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'documents',
  'documents',
  true,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read documents bucket'
  ) THEN
    CREATE POLICY "Public read documents bucket"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'documents');
  END IF;
END $$;

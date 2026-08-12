/*
# Create uploaded_videos table and videos storage bucket

## Purpose
Stores metadata for every video file a user uploads to Supabase Storage
(through the Upload Center on /dashboard/publishing). Each row tracks the
storage path, public URL, file size, mime type, duration, and a status
lifecycle: UPLOADING -> READY -> PUBLISHING -> PUBLISHED (or FAILED).

## 1. New Tables
- `uploaded_videos`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `user_id` (uuid, not null, default auth.uid(), references auth.users ON DELETE CASCADE)
  - `storage_path` (text, not null) - path inside the `videos` bucket, e.g. "<user-id>/<uuid>.mp4"
  - `public_url` (text) - public URL of the object in the `videos` bucket
  - `filename` (text, not null) - original file name from the user's machine
  - `filesize` (bigint) - size in bytes
  - `mime_type` (text) - e.g. "video/mp4"
  - `duration` (double precision) - duration in seconds (nullable, may be filled later)
  - `status` (text, not null, default 'UPLOADING') - one of: UPLOADING, READY, FAILED, PUBLISHING, PUBLISHED
  - `error_message` (text) - last error message if status is FAILED
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## 2. Indexes
- `idx_uploaded_videos_user_id` on `user_id` for per-user queries
- `idx_uploaded_videos_status` on `status` for filtering READY videos

## 3. Storage Bucket
- Creates a `videos` storage bucket (private, 2 GB file size limit enforced in app/edge function)
- Storage policies allow authenticated users to manage only their own folder: `videos/<user-id>/...`

## 4. Security (RLS)
- Enable RLS on `uploaded_videos`
- 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE) using auth.uid() = user_id
- `user_id` defaults to auth.uid() so inserts that omit it still pass the WITH CHECK

## 5. Important Notes
1. The `videos` bucket is created as private. Public URLs are still generated for
   convenience, but the edge function uses the service role key to download.
2. Storage policies enforce folder-level isolation: a user can only read/write
   objects whose path starts with their own user id.
3. The status lifecycle is enforced in application code, not via DB constraints,
   to keep transitions flexible.
*/

CREATE TABLE IF NOT EXISTS uploaded_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text,
  filename text NOT NULL,
  filesize bigint,
  mime_type text,
  duration double precision,
  status text NOT NULL DEFAULT 'UPLOADING',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_videos_user_id ON uploaded_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_status ON uploaded_videos(status);

ALTER TABLE uploaded_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_uploaded_videos" ON uploaded_videos;
CREATE POLICY "select_own_uploaded_videos" ON uploaded_videos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_uploaded_videos" ON uploaded_videos;
CREATE POLICY "insert_own_uploaded_videos" ON uploaded_videos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_uploaded_videos" ON uploaded_videos;
CREATE POLICY "update_own_uploaded_videos" ON uploaded_videos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_uploaded_videos" ON uploaded_videos;
CREATE POLICY "delete_own_uploaded_videos" ON uploaded_videos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION set_updated_at_uploaded_videos()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_uploaded_videos_updated_at ON uploaded_videos;
CREATE TRIGGER trg_uploaded_videos_updated_at
  BEFORE UPDATE ON uploaded_videos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_uploaded_videos();

-- Storage bucket: videos (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  false,
  2147483648, -- 2 GB
  ARRAY['video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: users can only access their own folder videos/<user-id>/...
DROP POLICY IF EXISTS "videos_select_own" ON storage.objects;
CREATE POLICY "videos_select_own" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "videos_insert_own" ON storage.objects;
CREATE POLICY "videos_insert_own" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "videos_update_own" ON storage.objects;
CREATE POLICY "videos_update_own" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "videos_delete_own" ON storage.objects;
CREATE POLICY "videos_delete_own" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

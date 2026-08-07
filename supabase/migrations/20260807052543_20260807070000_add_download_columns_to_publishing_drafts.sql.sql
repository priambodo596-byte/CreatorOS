-- Add columns to support the YouTube download → Storage → publish pipeline.
-- The old flow stored a YouTube watch URL in video_url and tried to fetch()
-- it at publish time (HTTP 429, malformed multipart). The new flow downloads
-- the video file to Supabase Storage and uses video_storage_path as the
-- single source of truth for the file.

ALTER TABLE public.publishing_drafts
  ADD COLUMN IF NOT EXISTS original_youtube_url text,
  ADD COLUMN IF NOT EXISTS storage_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_size bigint,
  ADD COLUMN IF NOT EXISTS storage_mime text,
  ADD COLUMN IF NOT EXISTS download_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS download_error text;

-- Migrate existing rows: if video_url looks like a YouTube watch URL and
-- there is no storage path, move it to original_youtube_url and null out
-- video_url so the publish flow can no longer try to fetch() it.
UPDATE public.publishing_drafts
  SET original_youtube_url = video_url,
      video_url = NULL,
      download_status = 'needed'
WHERE video_storage_path IS NULL
  AND video_url IS NOT NULL
  AND video_url ~* 'youtube\.com|youtu\.be';

-- Add index for download_status lookups
CREATE INDEX IF NOT EXISTS idx_publishing_drafts_download_status
  ON public.publishing_drafts(download_status);

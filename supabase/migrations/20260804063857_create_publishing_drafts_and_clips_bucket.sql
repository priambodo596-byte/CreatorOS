/*
# Create publishing_drafts table and clips storage bucket

## Purpose
When a user generates clips in the AI Clipper, the results need to be saved
so they can be published to YouTube from the Publishing Center. This migration
creates a dedicated `publishing_drafts` table that stores clip metadata, the
storage path for the rendered video, thumbnail, SEO fields, visibility/schedule
settings, and publication status. It also creates a `clips` storage bucket
for the rendered clip video files.

## New Tables
- `publishing_drafts`
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() — owner
  - `clip_id` uuid nullable FK → video_clips.id — link back to the clipper clip
  - `title` text NOT NULL — video title for YouTube
  - `description` text — video description
  - `category` text DEFAULT 'Science & Technology'
  - `language` text DEFAULT 'English'
  - `tags` text[] DEFAULT '{}' — YouTube tags
  - `hashtags` text[] DEFAULT '{}' — hashtags
  - `thumbnail_url` text nullable — public URL of thumbnail
  - `video_storage_path` text nullable — path in the clips bucket
  - `video_url` text nullable — public URL of the rendered clip
  - `platform` text DEFAULT 'youtube-shorts'
  - `visibility` text DEFAULT 'public' — public | unlisted | private
  - `scheduled` boolean DEFAULT false
  - `scheduled_at` timestamptz nullable — when to publish
  - `status` text DEFAULT 'draft' — draft | ready | publishing | published | failed
  - `youtube_video_id` text nullable — returned by YouTube API after publish
  - `publish_error` text nullable — error message if publish failed
  - `metadata` jsonb DEFAULT '{}' — extra fields (viral_score, seo_score, etc.)
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()

## New Storage Bucket
- `clips` (public) — stores rendered clip video files

## Security
- RLS enabled on `publishing_drafts`
- 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE) for authenticated users
- Storage bucket policies for clips bucket (authenticated users manage own files)
*/

-- ─── Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id uuid REFERENCES video_clips(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  description text DEFAULT '',
  category text DEFAULT 'Science & Technology',
  language text DEFAULT 'English',
  tags text[] DEFAULT '{}',
  hashtags text[] DEFAULT '{}',
  thumbnail_url text,
  video_storage_path text,
  video_url text,
  platform text DEFAULT 'youtube-shorts',
  visibility text DEFAULT 'public',
  scheduled boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  youtube_video_id text,
  publish_error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publishing_drafts_user_id ON publishing_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_drafts_status ON publishing_drafts(status);
CREATE INDEX IF NOT EXISTS idx_publishing_drafts_clip_id ON publishing_drafts(clip_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE publishing_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_publishing_drafts" ON publishing_drafts;
CREATE POLICY "select_own_publishing_drafts"
  ON publishing_drafts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_publishing_drafts" ON publishing_drafts;
CREATE POLICY "insert_own_publishing_drafts"
  ON publishing_drafts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_publishing_drafts" ON publishing_drafts;
CREATE POLICY "update_own_publishing_drafts"
  ON publishing_drafts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_publishing_drafts" ON publishing_drafts;
CREATE POLICY "delete_own_publishing_drafts"
  ON publishing_drafts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── Storage Bucket ───────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('clips', 'clips', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for clips bucket
DROP POLICY IF EXISTS "clips_select_own" ON storage.objects;
CREATE POLICY "clips_select_own"
  ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'clips');

DROP POLICY IF EXISTS "clips_insert_own" ON storage.objects;
CREATE POLICY "clips_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'clips' AND auth.uid() = (storage.foldername(name))[1]::uuid);

DROP POLICY IF EXISTS "clips_update_own" ON storage.objects;
CREATE POLICY "clips_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'clips' AND auth.uid() = (storage.foldername(name))[1]::uuid)
  WITH CHECK (bucket_id = 'clips' AND auth.uid() = (storage.foldername(name))[1]::uuid);

DROP POLICY IF EXISTS "clips_delete_own" ON storage.objects;
CREATE POLICY "clips_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'clips' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- ─── updated_at trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_publishing_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publishing_drafts_updated_at ON publishing_drafts;
CREATE TRIGGER trg_publishing_drafts_updated_at
  BEFORE UPDATE ON publishing_drafts
  FOR EACH ROW EXECUTE FUNCTION update_publishing_drafts_updated_at();

/*
# Full YouTube Channel Content Synchronization Tables

## Purpose
Extends existing youtube_videos table and creates new tables for full content sync.

## Changes to existing tables
### youtube_videos (ALTER)
Adds columns: category_id, tags, favorite_count, caption_status, made_for_kids,
is_short, live_status, default_language, default_audio_language, synced_at.
Renames fetched_at to synced_at (keeps fetched_at for backward compat).

## New Tables
1. youtube_channels — Complete channel metadata
2. youtube_playlists — All channel playlists
3. youtube_comments — Comments from all videos
4. youtube_analytics_daily — Daily aggregated analytics
5. youtube_sync_logs — Tracks sync operations

## Security
- RLS enabled on all new tables, owner-scoped CRUD via auth.uid()
*/

-- ALTER existing youtube_videos table to add new columns
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS category_id text;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS favorite_count bigint DEFAULT 0;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS caption_status text;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS made_for_kids boolean DEFAULT false;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS is_short boolean DEFAULT false;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS live_status text DEFAULT 'none';
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS default_language text;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS default_audio_language text;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_youtube_videos_user_published ON youtube_videos(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_user_shorts ON youtube_videos(user_id, is_short);

-- youtube_channels
CREATE TABLE IF NOT EXISTS youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  title text,
  description text,
  custom_url text,
  country text,
  published_at timestamptz,
  subscriber_count bigint DEFAULT 0,
  view_count bigint DEFAULT 0,
  video_count bigint DEFAULT 0,
  thumbnail_url text,
  banner_url text,
  keywords text[] DEFAULT '{}',
  topic_categories text[] DEFAULT '{}',
  uploads_playlist_id text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_channels" ON youtube_channels;
CREATE POLICY "select_own_channels" ON youtube_channels FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_channels" ON youtube_channels;
CREATE POLICY "insert_own_channels" ON youtube_channels FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_channels" ON youtube_channels;
CREATE POLICY "update_own_channels" ON youtube_channels FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_channels" ON youtube_channels;
CREATE POLICY "delete_own_channels" ON youtube_channels FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_user_id ON youtube_channels(user_id);

-- youtube_playlists
CREATE TABLE IF NOT EXISTS youtube_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  playlist_id text NOT NULL,
  title text,
  description text,
  item_count integer DEFAULT 0,
  published_at timestamptz,
  thumbnail_url text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_id, playlist_id)
);

ALTER TABLE youtube_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_playlists" ON youtube_playlists;
CREATE POLICY "select_own_playlists" ON youtube_playlists FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_playlists" ON youtube_playlists;
CREATE POLICY "insert_own_playlists" ON youtube_playlists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_playlists" ON youtube_playlists;
CREATE POLICY "update_own_playlists" ON youtube_playlists FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_playlists" ON youtube_playlists;
CREATE POLICY "delete_own_playlists" ON youtube_playlists FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_playlists_user_id ON youtube_playlists(user_id);

-- youtube_comments
CREATE TABLE IF NOT EXISTS youtube_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  video_id text NOT NULL,
  comment_id text NOT NULL,
  author text,
  author_channel_id text,
  text text,
  like_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  published_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE youtube_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_comments" ON youtube_comments;
CREATE POLICY "select_own_comments" ON youtube_comments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_comments" ON youtube_comments;
CREATE POLICY "insert_own_comments" ON youtube_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_comments" ON youtube_comments;
CREATE POLICY "update_own_comments" ON youtube_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_comments" ON youtube_comments;
CREATE POLICY "delete_own_comments" ON youtube_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_comments_user_video ON youtube_comments(user_id, video_id);

-- youtube_analytics_daily
CREATE TABLE IF NOT EXISTS youtube_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  date date NOT NULL,
  views bigint DEFAULT 0,
  estimated_minutes_watched bigint DEFAULT 0,
  average_view_duration numeric(10, 2) DEFAULT 0,
  impressions bigint DEFAULT 0,
  impressions_ctr numeric(5, 2) DEFAULT 0,
  subscribers_gained integer DEFAULT 0,
  subscribers_lost integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  estimated_revenue numeric(10, 2) DEFAULT 0,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id, date)
);

ALTER TABLE youtube_analytics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analytics_daily" ON youtube_analytics_daily;
CREATE POLICY "select_own_analytics_daily" ON youtube_analytics_daily FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_analytics_daily" ON youtube_analytics_daily;
CREATE POLICY "insert_own_analytics_daily" ON youtube_analytics_daily FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_analytics_daily" ON youtube_analytics_daily;
CREATE POLICY "update_own_analytics_daily" ON youtube_analytics_daily FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_analytics_daily" ON youtube_analytics_daily;
CREATE POLICY "delete_own_analytics_daily" ON youtube_analytics_daily FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_analytics_daily_user_date ON youtube_analytics_daily(user_id, date DESC);

-- youtube_sync_logs
CREATE TABLE IF NOT EXISTS youtube_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  videos_synced integer DEFAULT 0,
  comments_synced integer DEFAULT 0,
  playlists_synced integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE youtube_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sync_logs" ON youtube_sync_logs;
CREATE POLICY "select_own_sync_logs" ON youtube_sync_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_sync_logs" ON youtube_sync_logs;
CREATE POLICY "insert_own_sync_logs" ON youtube_sync_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_sync_logs" ON youtube_sync_logs;
CREATE POLICY "update_own_sync_logs" ON youtube_sync_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_sync_logs" ON youtube_sync_logs;
CREATE POLICY "delete_own_sync_logs" ON youtube_sync_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_sync_logs_user_started ON youtube_sync_logs(user_id, started_at DESC);

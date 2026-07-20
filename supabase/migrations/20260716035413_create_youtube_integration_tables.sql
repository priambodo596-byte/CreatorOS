/*
# YouTube Integration Tables

## Purpose
Stores YouTube OAuth connections and channel analytics data for the CreatorOS AI platform.
This enables real YouTube Data API integration — users connect their YouTube channel
via OAuth, and we persist their tokens and fetched analytics data.

## New Tables

### 1. youtube_connections
Stores OAuth tokens and channel metadata for connected YouTube accounts.
- `id` — UUID primary key
- `user_id` — UUID, references auth.users, identifies the owner
- `channel_id` — YouTube channel ID (text)
- `channel_title` — Channel display name (text)
- `channel_thumbnail` — URL to channel avatar (text)
- `access_token` — OAuth access token (text, encrypted at app level)
- `refresh_token` — OAuth refresh token (text)
- `token_expires_at` — When the access token expires (timestamptz)
- `scope` — OAuth scopes granted (text)
- `connected_at` — When the connection was established (timestamptz)
- `updated_at` — Last token refresh timestamp (timestamptz)

### 2. youtube_analytics
Stores cached analytics data fetched from the YouTube Data API.
- `id` — UUID primary key
- `user_id` — UUID, references auth.users, identifies the owner
- `channel_id` — YouTube channel ID (text)
- `date` — The date this data corresponds to (date)
- `views` — Total views for that date (bigint)
- `subscribers_gained` — New subscribers (integer)
- `subscribers_lost` — Lost subscribers (integer)
- `watch_time_minutes` — Total watch time in minutes (bigint)
- `estimated_revenue` — Estimated revenue in USD (numeric)
- `estimated_minutes_watched` — Minutes watched (bigint)
- `average_view_duration` — Avg view duration in seconds (numeric)
- `impressions` — Thumbnail impressions (bigint)
- `impressions_ctr` — CTR percentage (numeric)
- `likes` — Total likes (integer)
- `comments` — Total comments (integer)
- `shares` — Total shares (integer)
- `fetched_at` — When this data was fetched (timestamptz)

### 3. youtube_videos
Stores metadata for the user's YouTube videos.
- `id` — UUID primary key
- `user_id` — UUID, references auth.users
- `channel_id` — YouTube channel ID (text)
- `video_id` — YouTube video ID (text, unique per user+video)
- `title` — Video title (text)
- `description` — Video description (text)
- `thumbnail_url` — Thumbnail URL (text)
- `published_at` — Publish date (timestamptz)
- `duration` — Video duration ISO 8601 (text)
- `view_count` — Total views (bigint)
- `like_count` — Total likes (bigint)
- `comment_count` — Total comments (bigint)
- `privacy_status` — public/unlisted/private (text)
- `fetched_at` — When metadata was last refreshed (timestamptz)

## Security
- RLS enabled on all three tables.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
- `user_id` columns default to `auth.uid()` so inserts work even when the client omits the field.
- No public/anon access — YouTube data is private to the authenticated user.

## Indexes
- `youtube_connections`: index on `user_id` for fast lookups
- `youtube_analytics`: composite index on `user_id` + `date` for time-range queries
- `youtube_videos`: index on `user_id` + `published_at` for recent-video queries
*/

-- youtube_connections
CREATE TABLE IF NOT EXISTS youtube_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_title text,
  channel_thumbnail text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE youtube_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_connections" ON youtube_connections;
CREATE POLICY "select_own_connections" ON youtube_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_connections" ON youtube_connections;
CREATE POLICY "insert_own_connections" ON youtube_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_connections" ON youtube_connections;
CREATE POLICY "update_own_connections" ON youtube_connections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_connections" ON youtube_connections;
CREATE POLICY "delete_own_connections" ON youtube_connections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_connections_user_id ON youtube_connections(user_id);

-- youtube_analytics
CREATE TABLE IF NOT EXISTS youtube_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  date date NOT NULL,
  views bigint DEFAULT 0,
  subscribers_gained integer DEFAULT 0,
  subscribers_lost integer DEFAULT 0,
  watch_time_minutes bigint DEFAULT 0,
  estimated_revenue numeric(10, 2) DEFAULT 0,
  estimated_minutes_watched bigint DEFAULT 0,
  average_view_duration numeric(10, 2) DEFAULT 0,
  impressions bigint DEFAULT 0,
  impressions_ctr numeric(5, 2) DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id, date)
);

ALTER TABLE youtube_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analytics" ON youtube_analytics;
CREATE POLICY "select_own_analytics" ON youtube_analytics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_analytics" ON youtube_analytics;
CREATE POLICY "insert_own_analytics" ON youtube_analytics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_analytics" ON youtube_analytics;
CREATE POLICY "update_own_analytics" ON youtube_analytics FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_analytics" ON youtube_analytics;
CREATE POLICY "delete_own_analytics" ON youtube_analytics FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_analytics_user_date ON youtube_analytics(user_id, date DESC);

-- youtube_videos
CREATE TABLE IF NOT EXISTS youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  video_id text NOT NULL,
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration text,
  view_count bigint DEFAULT 0,
  like_count bigint DEFAULT 0,
  comment_count bigint DEFAULT 0,
  privacy_status text DEFAULT 'public',
  fetched_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_videos" ON youtube_videos;
CREATE POLICY "select_own_videos" ON youtube_videos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_videos" ON youtube_videos;
CREATE POLICY "insert_own_videos" ON youtube_videos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_videos" ON youtube_videos;
CREATE POLICY "update_own_videos" ON youtube_videos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_videos" ON youtube_videos;
CREATE POLICY "delete_own_videos" ON youtube_videos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_user_published ON youtube_videos(user_id, published_at DESC);

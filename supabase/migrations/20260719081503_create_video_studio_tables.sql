/*
# Create Video Studio tables: imports, projects, trending cache

## Purpose
Supports the Video Studio module - imported videos from multiple sources,
video editing projects with timeline state, and cached trending video data.

## New Tables
1. video_imports - imported videos from various sources (local, YouTube, Google Drive, etc.)
2. video_projects - video editing projects with timeline state
3. trending_videos_cache - cached trending video data from YouTube API

## Security
- All tables RLS enabled, owner-scoped (user_id = auth.uid())
- trending_videos_cache is readable by all authenticated users (shared data)
*/

-- ─── video_imports (must exist before video_projects FK) ─────────────────────
CREATE TABLE IF NOT EXISTS video_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'local',
  name text NOT NULL DEFAULT 'Untitled Video',
  url text,
  thumbnail_url text,
  duration_seconds integer DEFAULT 0,
  size_bytes bigint DEFAULT 0,
  video_id text,
  channel_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  analysis_status text DEFAULT 'pending',
  analysis_data jsonb DEFAULT '{}'::jsonb,
  favorite boolean NOT NULL DEFAULT false,
  storage_path text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_video_imports" ON video_imports;
CREATE POLICY "select_own_video_imports" ON video_imports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_video_imports" ON video_imports;
CREATE POLICY "insert_own_video_imports" ON video_imports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_video_imports" ON video_imports;
CREATE POLICY "update_own_video_imports" ON video_imports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_video_imports" ON video_imports;
CREATE POLICY "delete_own_video_imports" ON video_imports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_imports_user_id ON video_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_video_imports_source ON video_imports(source);

-- ─── video_projects ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Project',
  source_video_id uuid REFERENCES video_imports(id) ON DELETE SET NULL,
  source_video_url text,
  duration_seconds integer DEFAULT 0,
  status text DEFAULT 'draft',
  timeline_data jsonb DEFAULT '{}'::jsonb,
  render_progress integer DEFAULT 0,
  render_status text DEFAULT 'idle',
  output_url text,
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_video_projects" ON video_projects;
CREATE POLICY "select_own_video_projects" ON video_projects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_video_projects" ON video_projects;
CREATE POLICY "insert_own_video_projects" ON video_projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_video_projects" ON video_projects;
CREATE POLICY "update_own_video_projects" ON video_projects
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_video_projects" ON video_projects;
CREATE POLICY "delete_own_video_projects" ON video_projects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_projects_user_id ON video_projects(user_id);

-- ─── trending_videos_cache ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_videos_cache (
  id text PRIMARY KEY,
  video_id text NOT NULL,
  title text NOT NULL,
  channel_title text NOT NULL,
  channel_id text,
  thumbnail_url text,
  published_at timestamptz,
  view_count bigint DEFAULT 0,
  like_count bigint DEFAULT 0,
  comment_count bigint DEFAULT 0,
  duration text,
  category_id text,
  country text DEFAULT 'US',
  language text DEFAULT 'en',
  growth_rate numeric DEFAULT 0,
  trend_score numeric DEFAULT 0,
  virality_score numeric DEFAULT 0,
  estimated_audience text,
  cached_at timestamptz DEFAULT now()
);

ALTER TABLE trending_videos_cache ENABLE ROW LEVEL SECURITY;

-- Trending cache is shared read-only data for all authenticated users
DROP POLICY IF EXISTS "select_trending_videos" ON trending_videos_cache;
CREATE POLICY "select_trending_videos" ON trending_videos_cache
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_trending_cached_at ON trending_videos_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_trending_category ON trending_videos_cache(category_id);
CREATE INDEX IF NOT EXISTS idx_trending_country ON trending_videos_cache(country);

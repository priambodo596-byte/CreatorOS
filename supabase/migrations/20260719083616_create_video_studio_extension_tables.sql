/*
# Create Video Studio extension tables: trending cache, video analysis, clips, hook analysis, brand kits

## Purpose
Supports Trending Videos, Video Analyzer, AI Clipper, Viral Finder, Hook Analyzer,
Scene Editor, and expanded Thumbnail/SEO Studio features.

## New Tables
1. trending_videos_cache - real-time trending video cache (shared read-only)
2. video_analyses - AI analysis results for analyzed videos (owner-scoped)
3. video_clips - generated short-form clips from AI Clipper (owner-scoped)
4. hook_analyses - 30-second hook scoring results (owner-scoped)
5. brand_kits - user brand kits for thumbnails (owner-scoped)
6. seo_analytics_cache - SEO performance analytics cache (owner-scoped)

## Security
- trending_videos_cache: shared read for all authenticated
- All others: owner-scoped RLS (user_id = auth.uid())
*/

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
  view_velocity numeric DEFAULT 0,
  cached_at timestamptz DEFAULT now()
);

ALTER TABLE trending_videos_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_trending_videos" ON trending_videos_cache;
CREATE POLICY "select_trending_videos" ON trending_videos_cache
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_trending_cached_at ON trending_videos_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_trending_category ON trending_videos_cache(category_id);
CREATE INDEX IF NOT EXISTS idx_trending_country ON trending_videos_cache(country);

-- ─── video_analyses ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text,
  video_url text,
  video_title text,
  source text DEFAULT 'youtube',
  status text DEFAULT 'pending',
  hook_score integer DEFAULT 0,
  cta_detected boolean DEFAULT false,
  scene_count integer DEFAULT 0,
  avg_scene_duration numeric DEFAULT 0,
  speaking_speed numeric DEFAULT 0,
  editing_pace numeric DEFAULT 0,
  avg_shot_length numeric DEFAULT 0,
  retention_prediction integer DEFAULT 0,
  estimated_ctr numeric DEFAULT 0,
  seo_score integer DEFAULT 0,
  thumbnail_score integer DEFAULT 0,
  emotions jsonb DEFAULT '[]'::jsonb,
  keywords jsonb DEFAULT '[]'::jsonb,
  objects jsonb DEFAULT '[]'::jsonb,
  faces jsonb DEFAULT '[]'::jsonb,
  scenes jsonb DEFAULT '[]'::jsonb,
  best_moments jsonb DEFAULT '[]'::jsonb,
  viral_moments jsonb DEFAULT '[]'::jsonb,
  shorts_moments jsonb DEFAULT '[]'::jsonb,
  timeline_markers jsonb DEFAULT '[]'::jsonb,
  suggestions jsonb DEFAULT '[]'::jsonb,
  analysis_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_video_analyses" ON video_analyses;
CREATE POLICY "select_own_video_analyses" ON video_analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_video_analyses" ON video_analyses;
CREATE POLICY "insert_own_video_analyses" ON video_analyses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_video_analyses" ON video_analyses;
CREATE POLICY "update_own_video_analyses" ON video_analyses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_video_analyses" ON video_analyses;
CREATE POLICY "delete_own_video_analyses" ON video_analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_analyses_user_id ON video_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_video_id ON video_analyses(video_id);

-- ─── video_clips ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_video_id text,
  source_video_url text,
  source_video_title text,
  title text NOT NULL DEFAULT 'Untitled Clip',
  platform text DEFAULT 'youtube-shorts',
  version text DEFAULT 'standard',
  start_time numeric DEFAULT 0,
  end_time numeric DEFAULT 0,
  duration_seconds numeric DEFAULT 0,
  viral_score integer DEFAULT 0,
  ctr_prediction numeric DEFAULT 0,
  retention_prediction integer DEFAULT 0,
  watch_time_prediction numeric DEFAULT 0,
  seo_score integer DEFAULT 0,
  status text DEFAULT 'generated',
  output_url text,
  thumbnail_url text,
  has_captions boolean DEFAULT true,
  has_auto_crop boolean DEFAULT true,
  has_face_tracking boolean DEFAULT false,
  has_noise_reduction boolean DEFAULT true,
  has_silence_removal boolean DEFAULT true,
  has_jump_cuts boolean DEFAULT false,
  has_transitions boolean DEFAULT true,
  has_brand_watermark boolean DEFAULT false,
  seo_title text,
  seo_description text,
  hashtags jsonb DEFAULT '[]'::jsonb,
  ai_recommendation text,
  metadata jsonb DEFAULT '{}'::jsonb,
  favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_video_clips" ON video_clips;
CREATE POLICY "select_own_video_clips" ON video_clips
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_video_clips" ON video_clips;
CREATE POLICY "insert_own_video_clips" ON video_clips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_video_clips" ON video_clips;
CREATE POLICY "update_own_video_clips" ON video_clips
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_video_clips" ON video_clips;
CREATE POLICY "delete_own_video_clips" ON video_clips
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_clips_user_id ON video_clips(user_id);

-- ─── hook_analyses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hook_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text,
  video_url text,
  video_title text,
  hook_score integer DEFAULT 0,
  hook_type text,
  hook_duration numeric DEFAULT 0,
  first_30_seconds jsonb DEFAULT '{}'::jsonb,
  retention_prediction integer DEFAULT 0,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  alternative_hooks jsonb DEFAULT '[]'::jsonb,
  emotion_timeline jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hook_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_hook_analyses" ON hook_analyses;
CREATE POLICY "select_own_hook_analyses" ON hook_analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_hook_analyses" ON hook_analyses;
CREATE POLICY "insert_own_hook_analyses" ON hook_analyses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_hook_analyses" ON hook_analyses;
CREATE POLICY "update_own_hook_analyses" ON hook_analyses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_hook_analyses" ON hook_analyses;
CREATE POLICY "delete_own_hook_analyses" ON hook_analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hook_analyses_user_id ON hook_analyses(user_id);

-- ─── brand_kits ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default Brand Kit',
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  secondary_color text DEFAULT '#8b5cf6',
  accent_color text DEFAULT '#f59e0b',
  background_color text DEFAULT '#0a0a0a',
  text_color text DEFAULT '#ffffff',
  font_family text DEFAULT 'Inter',
  font_size text DEFAULT 'medium',
  logo_position text DEFAULT 'bottom-right',
  watermark_url text,
  watermark_opacity numeric DEFAULT 50,
  style_preset text DEFAULT 'modern',
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_brand_kits" ON brand_kits;
CREATE POLICY "select_own_brand_kits" ON brand_kits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_brand_kits" ON brand_kits;
CREATE POLICY "insert_own_brand_kits" ON brand_kits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_brand_kits" ON brand_kits;
CREATE POLICY "update_own_brand_kits" ON brand_kits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_brand_kits" ON brand_kits;
CREATE POLICY "delete_own_brand_kits" ON brand_kits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user_id ON brand_kits(user_id);

-- ─── seo_analytics_cache ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id text,
  video_title text,
  seo_score integer DEFAULT 0,
  title_score integer DEFAULT 0,
  description_score integer DEFAULT 0,
  tags_score integer DEFAULT 0,
  thumbnail_score integer DEFAULT 0,
  keyword_rankings jsonb DEFAULT '[]'::jsonb,
  search_impressions bigint DEFAULT 0,
  search_clicks bigint DEFAULT 0,
  avg_position numeric DEFAULT 0,
  ctr numeric DEFAULT 0,
  traffic_sources jsonb DEFAULT '{}'::jsonb,
  suggestions jsonb DEFAULT '[]'::jsonb,
  cached_at timestamptz DEFAULT now()
);

ALTER TABLE seo_analytics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_seo_analytics" ON seo_analytics_cache;
CREATE POLICY "select_own_seo_analytics" ON seo_analytics_cache
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_seo_analytics" ON seo_analytics_cache;
CREATE POLICY "insert_own_seo_analytics" ON seo_analytics_cache
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_seo_analytics" ON seo_analytics_cache;
CREATE POLICY "update_own_seo_analytics" ON seo_analytics_cache
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_seo_analytics" ON seo_analytics_cache;
CREATE POLICY "delete_own_seo_analytics" ON seo_analytics_cache
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_seo_analytics_user_id ON seo_analytics_cache(user_id);

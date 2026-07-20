/*
# Thumbnail Studio — full schema

## Purpose
Rebuild the Thumbnail Studio module as an AI-powered design workspace.
Creates dedicated tables for generated thumbnails, their versions, A/B
test results, marketplace templates, and AI prompt history. Also creates
a dedicated `creatoros-assets` storage bucket with public read +
authenticated write policies so every thumbnail file lives in Supabase
Storage (never on the client).

## 1. New Tables
- `thumbnails` — one row per generated/saved thumbnail, with status
  (draft/generated/published), CTR + visual/SEO/readability/emotion
  scores, mobile/desktop visibility, favorite flag, metadata.
- `thumbnail_versions` — every save creates a version (auto-save +
  manual). Stores full layer state for restore/compare.
- `thumbnail_ab_tests` — persisted A/B test results, up to 4 variants,
  winner prediction, confidence, AI recommendation.
- `thumbnail_templates` — marketplace templates by niche. Null user_id =
  marketplace; set = user-saved copy.
- `ai_prompts` — AI Prompt Studio prompt history, model selection, result
  image, favorite flag.

## 2. Storage
Creates `creatoros-assets` bucket (public) if it does not exist.

## 3. Security
- RLS enabled on every table.
- Owner-scoped CRUD (4 policies per table) using auth.uid() = user_id.
- Storage policies: public read, authenticated write scoped to the
  user's own folder prefix.
*/

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS thumbnails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  image_url text,
  storage_path text,
  ctr_prediction numeric DEFAULT 0,
  visual_score numeric DEFAULT 0,
  seo_score numeric DEFAULT 0,
  readability_score numeric DEFAULT 0,
  emotion_score numeric DEFAULT 0,
  mobile_visibility numeric DEFAULT 0,
  desktop_visibility numeric DEFAULT 0,
  is_favorite boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thumbnails ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS thumbnail_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thumbnail_id uuid NOT NULL REFERENCES thumbnails(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 1,
  label text,
  image_url text,
  storage_path text,
  layers jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thumbnail_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS thumbnail_ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_title text NOT NULL DEFAULT '',
  target_audience text,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_index int,
  confidence_score numeric DEFAULT 0,
  ai_recommendation text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thumbnail_ab_tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS thumbnail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  niche text NOT NULL DEFAULT 'General',
  preview_url text,
  layers jsonb DEFAULT '{}'::jsonb,
  brand_style text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thumbnail_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'gpt-image',
  style text,
  result_url text,
  storage_path text,
  is_favorite boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thumbnails_user ON thumbnails(user_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_versions_thumb ON thumbnail_versions(thumbnail_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_ab_tests_user ON thumbnail_ab_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_templates_niche ON thumbnail_templates(niche);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_user ON ai_prompts(user_id);

-- ============================================================
-- RLS POLICIES (4 per table, owner-scoped)
-- ============================================================

-- thumbnails
DROP POLICY IF EXISTS "select_own_thumbnails" ON thumbnails;
CREATE POLICY "select_own_thumbnails" ON thumbnails FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_thumbnails" ON thumbnails;
CREATE POLICY "insert_own_thumbnails" ON thumbnails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_thumbnails" ON thumbnails;
CREATE POLICY "update_own_thumbnails" ON thumbnails FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_thumbnails" ON thumbnails;
CREATE POLICY "delete_own_thumbnails" ON thumbnails FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- thumbnail_versions
DROP POLICY IF EXISTS "select_own_thumbnail_versions" ON thumbnail_versions;
CREATE POLICY "select_own_thumbnail_versions" ON thumbnail_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_thumbnail_versions" ON thumbnail_versions;
CREATE POLICY "insert_own_thumbnail_versions" ON thumbnail_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_thumbnail_versions" ON thumbnail_versions;
CREATE POLICY "update_own_thumbnail_versions" ON thumbnail_versions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_thumbnail_versions" ON thumbnail_versions;
CREATE POLICY "delete_own_thumbnail_versions" ON thumbnail_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- thumbnail_ab_tests
DROP POLICY IF EXISTS "select_own_thumbnail_ab_tests" ON thumbnail_ab_tests;
CREATE POLICY "select_own_thumbnail_ab_tests" ON thumbnail_ab_tests FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_thumbnail_ab_tests" ON thumbnail_ab_tests;
CREATE POLICY "insert_own_thumbnail_ab_tests" ON thumbnail_ab_tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_thumbnail_ab_tests" ON thumbnail_ab_tests;
CREATE POLICY "update_own_thumbnail_ab_tests" ON thumbnail_ab_tests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_thumbnail_ab_tests" ON thumbnail_ab_tests;
CREATE POLICY "delete_own_thumbnail_ab_tests" ON thumbnail_ab_tests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- thumbnail_templates: marketplace (public) + own
DROP POLICY IF EXISTS "select_thumbnail_templates" ON thumbnail_templates;
CREATE POLICY "select_thumbnail_templates" ON thumbnail_templates FOR SELECT TO authenticated USING (is_public = true OR auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_thumbnail_templates" ON thumbnail_templates;
CREATE POLICY "insert_own_thumbnail_templates" ON thumbnail_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_thumbnail_templates" ON thumbnail_templates;
CREATE POLICY "update_own_thumbnail_templates" ON thumbnail_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_thumbnail_templates" ON thumbnail_templates;
CREATE POLICY "delete_own_thumbnail_templates" ON thumbnail_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_prompts
DROP POLICY IF EXISTS "select_own_ai_prompts" ON ai_prompts;
CREATE POLICY "select_own_ai_prompts" ON ai_prompts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ai_prompts" ON ai_prompts;
CREATE POLICY "insert_own_ai_prompts" ON ai_prompts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ai_prompts" ON ai_prompts;
CREATE POLICY "update_own_ai_prompts" ON ai_prompts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ai_prompts" ON ai_prompts;
CREATE POLICY "delete_own_ai_prompts" ON ai_prompts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('creatoros-assets', 'creatoros-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write to own folder
DROP POLICY IF EXISTS "read_creatoros_assets" ON storage.objects;
CREATE POLICY "read_creatoros_assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'creatoros-assets');

DROP POLICY IF EXISTS "insert_own_creatoros_assets" ON storage.objects;
CREATE POLICY "insert_own_creatoros_assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'creatoros-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "update_own_creatoros_assets" ON storage.objects;
CREATE POLICY "update_own_creatoros_assets" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'creatoros-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
) WITH CHECK (
  bucket_id = 'creatoros-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "delete_own_creatoros_assets" ON storage.objects;
CREATE POLICY "delete_own_creatoros_assets" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'creatoros-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
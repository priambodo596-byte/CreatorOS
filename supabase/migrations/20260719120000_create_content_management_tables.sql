/*
# Content Management Tables for CreatorOS AI

## Purpose
Powers the Home Dashboard and the new Content Management section: unified
content items (videos/shorts/posts) with categories, tags, playlists,
soft-delete (trash), and an activity timeline for the detail page.

## New Tables
1. content_categories - user-defined categories
2. content_playlists  - user-defined playlists/collections
3. content_items      - the core content entity (draft/scheduled/published/archived)
4. content_activities - activity timeline per content item

## Security
- RLS enabled on all tables, owner-scoped via auth.uid()
*/

-- ─── content_categories ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8b5cf6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE content_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_content_categories" ON content_categories;
CREATE POLICY "select_own_content_categories" ON content_categories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_content_categories" ON content_categories;
CREATE POLICY "insert_own_content_categories" ON content_categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_content_categories" ON content_categories;
CREATE POLICY "update_own_content_categories" ON content_categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_content_categories" ON content_categories;
CREATE POLICY "delete_own_content_categories" ON content_categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_categories_user_id ON content_categories(user_id);

-- ─── content_playlists ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE content_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_content_playlists" ON content_playlists;
CREATE POLICY "select_own_content_playlists" ON content_playlists FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_content_playlists" ON content_playlists;
CREATE POLICY "insert_own_content_playlists" ON content_playlists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_content_playlists" ON content_playlists;
CREATE POLICY "update_own_content_playlists" ON content_playlists FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_content_playlists" ON content_playlists;
CREATE POLICY "delete_own_content_playlists" ON content_playlists FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_playlists_user_id ON content_playlists(user_id);

-- ─── content_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  category_id uuid REFERENCES content_categories(id) ON DELETE SET NULL,
  playlist_id uuid REFERENCES content_playlists(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  description text,
  content_type text NOT NULL DEFAULT 'video',
  thumbnail_url text,
  video_url text,
  channel_id text,
  channel_name text,
  status text NOT NULL DEFAULT 'draft',
  visibility text NOT NULL DEFAULT 'private',
  tags text[] NOT NULL DEFAULT '{}',
  seo_score integer,
  thumbnail_score integer,
  author text,
  scheduled_at timestamptz,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_content_items" ON content_items;
CREATE POLICY "select_own_content_items" ON content_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_content_items" ON content_items;
CREATE POLICY "insert_own_content_items" ON content_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_content_items" ON content_items;
CREATE POLICY "update_own_content_items" ON content_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_content_items" ON content_items;
CREATE POLICY "delete_own_content_items" ON content_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_items_user_id ON content_items(user_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_category_id ON content_items(category_id);
CREATE INDEX IF NOT EXISTS idx_content_items_playlist_id ON content_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_content_items_deleted_at ON content_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at);

-- ─── content_activities (activity timeline, per content item) ────────────────
CREATE TABLE IF NOT EXISTS content_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE content_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_content_activities" ON content_activities;
CREATE POLICY "select_own_content_activities" ON content_activities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_content_activities" ON content_activities;
CREATE POLICY "insert_own_content_activities" ON content_activities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_content_activities" ON content_activities;
CREATE POLICY "delete_own_content_activities" ON content_activities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_activities_content_id ON content_activities(content_id);
CREATE INDEX IF NOT EXISTS idx_content_activities_user_id ON content_activities(user_id);

-- ─── auto-update updated_at + auto-log activity ───────────────────────────────
CREATE OR REPLACE FUNCTION set_content_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_items_updated_at ON content_items;
CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION set_content_items_updated_at();

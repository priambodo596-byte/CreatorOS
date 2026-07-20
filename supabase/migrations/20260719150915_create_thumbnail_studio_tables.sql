/*
# Thumbnail Studio — full schema

## Purpose
Rebuild the Thumbnail Studio module as an AI-powered design workspace.
This migration creates dedicated tables for generated thumbnails, their
versions, A/B test results, marketplace templates, and AI prompt history.
It also creates a dedicated `creatoros-assets` storage bucket with public
read + authenticated write policies so every thumbnail file lives in
Supabase Storage (never on the client).

## 1. New Tables

### `thumbnails`
One row per generated/saved thumbnail. Each thumbnail belongs to a
project (optional) and has a status that drives the Storage folder layout
(`draft`, `generated`, `published`).
- `id` uuid pk
- `user_id` uuid, defaults to auth.uid()
- `project_id` uuid nullable (future project link)
- `title` text — the video title the thumbnail is for
- `status` text ('draft' | 'generated' | 'published'), default 'draft'
- `image_url` text — public URL of the rendered image in Storage
- `storage_path` text — the object path inside the bucket (for deletion)
- `ctr_prediction` numeric (0-100) — predicted click-through rate
- `visual_score` numeric (0-100)
- `seo_score` numeric (0-100)
- `readability_score` numeric (0-100)
- `emotion_score` numeric (0-100)
- `mobile_visibility` numeric (0-100)
- `desktop_visibility` numeric (0-100)
- `is_favorite` boolean default false
- `metadata` jsonb — free-form extra data (script, keywords, audience, etc.)
- `created_at` / `updated_at` timestamptz

### `thumbnail_versions`
Every save creates a new version (auto-save + manual save). Allows
preview, restore, duplicate, rename, delete, compare.
- `id` uuid pk
- `thumbnail_id` uuid fk -> thumbnails(id) on delete cascade
- `user_id` uuid default auth.uid()
- `version_number` int
- `label` text — optional human label
- `image_url` text
- `storage_path` text
- `layers` jsonb — full layer state for the editor
- `created_at` timestamptz

### `thumbnail_ab_tests`
Persisted A/B test results. Supports up to 4 variants.
- `id` uuid pk
- `user_id` uuid default auth.uid()
- `video_title` text
- `target_audience` text
- `variants` jsonb — array of {thumbnail_id, image_url, scores}
- `winner_index` int
- `confidence_score` numeric
- `ai_recommendation` text
- `published` boolean default false
- `created_at` timestamptz

### `thumbnail_templates`
Marketplace templates organized by niche. Users can save, modify, and
duplicate into their own brand templates.
- `id` uuid pk
- `user_id` uuid nullable — null = marketplace template, set = user-saved copy
- `name` text
- `niche` text (Gaming, Education, Podcast, Review, Vlog, Finance, etc.)
- `preview_url` text
- `layers` jsonb — full editable layer state
- `brand_style` text
- `is_public` boolean default false
- `created_at` timestamptz

### `ai_prompts`
AI Prompt Studio — stores prompts for AI thumbnail generation, model
selection, and generation history.
- `id` uuid pk
- `user_id` uuid default auth.uid()
- `prompt` text
- `model` text (gpt-image, gemini-image, stable-diffusion, flux, midjourney)
- `style` text — optional style variation
- `result_url` text — generated image URL
- `storage_path` text
- `is_favorite` boolean default false
- `metadata` jsonb
- `created_at` timestamptz

## 2. Storage
Creates `creatoros-assets` bucket (public) if it does not exist. The
folder structure (projects/{id}/thumbnails/draft|generated|published|
versions, brand-kit, assets, exports) is enforced by path conventions in
the app code, not by the database.

## 3. Security
- RLS enabled on every table.
- Owner-scoped CRUD (4 policies per table) using auth.uid() = user_id.
- Storage policies: public read, authenticated write scoped to the
  user's own folder prefix.
*/
/*
# Add metadata column to content_items

## Purpose
The New Video Wizard (components/dashboard/new-video-wizard.tsx) stores
per-step working data (research, script, storyboard, video render state,
review checklist, publish settings) as a JSON blob so a project can be
fully resumed across sessions. This column was missing, causing wizard
saves for anything beyond Step 1 to be rejected by PostgREST.

## Changes
- Add `metadata jsonb NOT NULL DEFAULT '{}'::jsonb` to content_items
- Add `wizard_step` + `wizard_completed` generated helper index for fast
  "resume my in-progress project" lookups
*/

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_content_items_wizard_step
  ON content_items (((metadata->>'wizard_step')::int))
  WHERE deleted_at IS NULL;

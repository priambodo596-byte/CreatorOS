-- Add storage path column to video_clips for persisted clip video files
ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS output_storage_path text;

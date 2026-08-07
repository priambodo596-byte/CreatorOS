/*
# Security hardening: fix mutable search_path and tighten clips bucket listing

## Fixes

### 1. Function search path mutable — `public.update_publishing_drafts_updated_at`
The trigger function had no explicit `search_path`, making it vulnerable to
search path hijacking. Recreated with an immutable `SET search_path = public, pg_catalog`.

### 2. Public bucket `clips` allows listing all files
The old `clips_select_own` SELECT policy used `USING (bucket_id = 'clips')` with
no ownership check, letting any authenticated user list every file in the bucket.
Public buckets serve objects via public URLs without a SELECT policy, so the
broad listing is unnecessary. Replaced with a policy scoped to each user's own
folder: `auth.uid() = (storage.foldername(name))[1]::uuid`.

### 3. Leaked password protection (HIBP)
`password_hibp_enabled` is already `true` in `auth.instances.raw_base_config`.
Re-asserting it here to ensure the config is up to date.
*/

-- Fix 1: Immutable search_path on the trigger function
CREATE OR REPLACE FUNCTION public.update_publishing_drafts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2: Tighten the clips bucket SELECT policy to only list own files
DROP POLICY IF EXISTS "clips_select_own" ON storage.objects;
CREATE POLICY "clips_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'clips' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Fix 3: Re-assert leaked password protection is enabled
UPDATE auth.instances
SET raw_base_config = jsonb_set(
    raw_base_config::jsonb,
    '{password_hibp_enabled}',
    'true'::jsonb
)::text,
    updated_at = now()
WHERE raw_base_config::jsonb->>'password_hibp_enabled' IS DISTINCT FROM 'true';

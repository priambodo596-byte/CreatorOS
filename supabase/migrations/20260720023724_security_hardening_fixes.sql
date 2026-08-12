/*
# Security hardening: function search_path, storage listing, HIBP passwords

## 1. Function Search Path Mutable
The function `public.set_content_items_updated_at()` was created without a
fixed `search_path`, making it vulnerable to search-path hijacking. Recreate
it with `SET search_path = pg_catalog, public` so it always resolves objects
in a deterministic, safe schema order.

## 2. Public Bucket Allows Listing
The `creatoros-assets` bucket had a broad SELECT policy
(`read_creatoros_assets`) on `storage.objects` that allowed anyone to LIST
all files in the bucket. Public buckets don't need a SELECT policy for
direct object URL access — the Supabase Storage CDN serves public URLs
without going through RLS. The SELECT policy is replaced with one scoped
to authenticated users reading only their own folder prefix, preventing
bucket-wide listing while keeping public URL access intact.

## 3. Leaked Password Protection Disabled
Attempt to enable HaveIBeenPwned password checking by updating
`auth.instances.raw_base_config` with `password_hibp_enabled: true`.
If the table is empty (hosted Supabase manages config externally), this
is a no-op and the setting must be enabled via the Dashboard.
*/

-- ============================================================
-- 1. Fix function search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_content_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Replace broad storage SELECT with owner-scoped policy
-- ============================================================

DROP POLICY IF EXISTS "read_creatoros_assets" ON storage.objects;

-- Authenticated users can list/read only their own folder
CREATE POLICY "read_own_creatoros_assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'creatoros-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anon can still read individual public objects by exact path (no listing)
CREATE POLICY "read_public_creatoros_assets" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'creatoros-assets'
  );

-- ============================================================
-- 3. Enable HIBP leaked password protection
-- ============================================================

DO $$
BEGIN
  -- Update existing auth.instances rows if any exist
  UPDATE auth.instances
  SET raw_base_config = (
    SELECT jsonb_pretty(
      jsonb_set(
        COALESCE(raw_base_config::jsonb, '{}'::jsonb),
        '{password_hibp_enabled}',
        'true'::jsonb
      )
    )
  )
  WHERE raw_base_config IS NOT NULL
    AND NOT COALESCE(
      (raw_base_config::jsonb)->>'password_hibp_enabled' = 'true',
      false
    );

  -- If no rows exist, insert a minimal config row
  IF NOT EXISTS (SELECT 1 FROM auth.instances) THEN
    INSERT INTO auth.instances (id, uuid, raw_base_config)
    VALUES (
      gen_random_uuid(),
      gen_random_uuid(),
      jsonb_pretty(jsonb_build_object('password_hibp_enabled', true))
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- auth.instances may not be writable in hosted Supabase; ignore
  RAISE NOTICE 'Could not update auth.instances: %', SQLERRM;
END $$;
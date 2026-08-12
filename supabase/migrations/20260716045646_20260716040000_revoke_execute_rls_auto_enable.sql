-- Fix: rls_auto_enable() is a SECURITY DEFINER function that was executable
-- by anon and authenticated roles via /rest/v1/rpc/rls_auto_enable.
-- This is a maintenance helper that should only be run by the database owner.
-- Revoke EXECUTE from public, anon, and authenticated; keep it for service_role.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

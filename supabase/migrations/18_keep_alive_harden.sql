-- Migration 18: Harden keep-alive view privileges
-- Supabase default privileges grant ALL on new public views to anon,
-- authenticated, and service_role. The heartbeat endpoint only needs SELECT.

REVOKE ALL ON public.keep_alive_ping FROM PUBLIC;
REVOKE ALL ON public.keep_alive_ping FROM anon, authenticated, service_role;
GRANT SELECT ON public.keep_alive_ping TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

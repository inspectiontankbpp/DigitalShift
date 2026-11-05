-- Migration 17: Supabase Free keep-alive endpoint
-- Read-only view for external uptime monitors. Running a SELECT against this
-- view creates database activity without storing rows or exposing app data.

CREATE OR REPLACE VIEW public.keep_alive_ping
WITH (security_invoker = true)
AS
SELECT now() AS pinged_at;

COMMENT ON VIEW public.keep_alive_ping IS
  'Read-only heartbeat endpoint to prevent Supabase Free inactivity pause.';

REVOKE ALL ON public.keep_alive_ping FROM PUBLIC;
REVOKE ALL ON public.keep_alive_ping FROM anon, authenticated, service_role;
GRANT SELECT ON public.keep_alive_ping TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

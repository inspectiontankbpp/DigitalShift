-- Migration 21: cabut grant PUBLIC pada guard role.
--
-- REVOKE dari anon/authenticated tidak cukup karena EXECUTE masih
-- diwarisi dari PUBLIC. Trigger tetap berjalan tanpa grant client.

revoke execute on function public.guard_profiles_role() from public;
revoke execute on function public.guard_profiles_role() from anon, authenticated;

-- Migration 19: hardening hasil review database.
--
-- 1. Hapus trigger audit duplikat di public.handovers.
-- 2. Cegah operator mengubah role profilnya sendiri (eskalasi ke supervisor).
-- 3. Batasi SELECT handovers ke pemilik atau supervisor.
-- 4. Cabut seluruh grant anon di schema public (kecuali keep_alive_ping).

-- ============================================================
-- 1. Trigger audit duplikat
-- ============================================================
-- Tersisa satu trigger: audit_handovers -> audit_handovers_trigger()
drop trigger if exists audit_handovers_trigger on public.handovers;
drop function if exists public.audit_handovers();

-- ============================================================
-- 2. Guard role profiles
-- ============================================================
-- Hanya berlaku untuk request client (authenticated/anon).
-- Fungsi SECURITY DEFINER (handle_new_user) berjalan sebagai owner
-- sehingga tidak terpengaruh guard ini.
create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user::text in ('authenticated', 'anon')
     and public.get_current_user_role() is distinct from 'supervisor' then
    if tg_op = 'INSERT' and new.role is distinct from 'operator' then
      raise exception 'Hanya supervisor yang dapat menetapkan role';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Hanya supervisor yang dapat mengubah role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profiles_role on public.profiles;
create trigger guard_profiles_role
  before insert or update on public.profiles
  for each row execute function public.guard_profiles_role();

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (get_current_user_role() = 'supervisor');

-- ============================================================
-- 3. Policy SELECT handovers
-- ============================================================
drop policy if exists handovers_select on public.handovers;
create policy handovers_select on public.handovers
  for select to authenticated
  using (
    get_current_user_role() = 'supervisor'
    or operator_id = (select auth.uid())
  );

-- ============================================================
-- 4. Cabut grant anon
-- ============================================================
revoke all on public.approvals from anon;
revoke all on public.audit_trail from anon;
revoke all on public.handover_activities from anon;
revoke all on public.handovers from anon;
revoke all on public.outstanding_jobs from anon;
revoke all on public.profiles from anon;
revoke all on public.shifts from anon;
revoke all on public.tank_products from anon;
revoke all on public.handover_sync from anon;

-- keep_alive_ping tetap dapat dibaca anon untuk uptime monitor.
grant select on public.keep_alive_ping to anon;

-- Migration 20: perbaikan guard role profiles.
--
-- Trigger SECURITY DEFINER membuat current_user menjadi pemilik fungsi
-- (postgres), sehingga pengecekan current_user pada migration 19 tidak
-- pernah aktif. Gunakan auth.uid() untuk mendeteksi request client.

create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
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

revoke execute on function public.guard_profiles_role() from anon, authenticated;

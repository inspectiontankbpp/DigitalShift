-- Private bucket for the downloadable Power BI report.
-- Upload the file manually from Supabase Dashboard > Storage:
-- bucket: powerbi
-- object: ShiftHandover.pbix

insert into storage.buckets (id, name, public, file_size_limit)
values ('powerbi', 'powerbi', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "powerbi_supervisor_read" on storage.objects;

create policy "powerbi_supervisor_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'powerbi'
  and public.get_current_user_role() = 'supervisor'
);

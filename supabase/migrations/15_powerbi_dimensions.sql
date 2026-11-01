-- Power BI dimension views.
--
-- Tujuan:
-- - Melengkapi fact view di migration 14 dengan dimensi star schema.
-- - Memberi label, urutan, dan atribut yang stabil untuk visual Power BI.
--
-- Catatan:
-- - View dimiliki oleh postgres dan memakai owner rights, sehingga
--   powerbi_reader tidak perlu akses ke tabel public.
-- - Role powerbi_reader hanya diberi SELECT ke view reporting.

create or replace view reporting.dim_date as
with bounds as (
  select
    coalesce(min(tanggal_operasional), current_date) as min_date,
    coalesce(max(tanggal_operasional), current_date) as max_date
  from reporting.handover_fact
),
dates as (
  select generate_series(
    bounds.min_date::timestamp,
    bounds.max_date + interval '1 year',
    interval '1 day'
  )::date as date
  from bounds
)
select
  date,
  extract(year from date)::int as year,
  extract(quarter from date)::int as quarter,
  'Q' || extract(quarter from date)::int as quarter_name,
  extract(month from date)::int as month_number,
  case extract(month from date)::int
    when 1 then 'Januari'
    when 2 then 'Februari'
    when 3 then 'Maret'
    when 4 then 'April'
    when 5 then 'Mei'
    when 6 then 'Juni'
    when 7 then 'Juli'
    when 8 then 'Agustus'
    when 9 then 'September'
    when 10 then 'Oktober'
    when 11 then 'November'
    when 12 then 'Desember'
  end as month_name,
  to_char(date::timestamp with time zone, 'Mon') as month_short,
  extract(day from date)::int as day_of_month,
  extract(isodow from date)::int as day_of_week,
  case extract(isodow from date)::int
    when 1 then 'Senin'
    when 2 then 'Selasa'
    when 3 then 'Rabu'
    when 4 then 'Kamis'
    when 5 then 'Jumat'
    when 6 then 'Sabtu'
    when 7 then 'Minggu'
  end as day_name,
  extract(week from date)::int as week_of_year,
  extract(isodow from date)::int in (6, 7) as is_weekend,
  to_char(date::timestamp with time zone, 'YYYY-MM') as year_month,
  date_trunc('month', date::timestamp with time zone)::date as month_start,
  date_trunc('quarter', date::timestamp with time zone)::date as quarter_start,
  date_trunc('year', date::timestamp with time zone)::date as year_start
from dates;

create or replace view reporting.dim_operator as
select
  id as operator_id,
  full_name as operator_name,
  role,
  created_at
from public.profiles;

create or replace view reporting.dim_supervisor as
select
  id as supervisor_id,
  full_name as supervisor_name,
  role,
  created_at
from public.profiles;

create or replace view reporting.dim_shift as
select
  id as shift_id,
  name as shift_name,
  start_time,
  end_time
from public.shifts;

create or replace view reporting.dim_regu as
select
  regu_shift,
  initcap(regu_shift) as regu_name,
  case
    when regu_shift ~* '^regu[0-9]+$' then substring(regu_shift from '[0-9]+')::int
    else 99
  end as regu_sort
from (
  select distinct nullif(operational_data ->> 'reguShift', '') as regu_shift
  from public.handovers
) r
where regu_shift is not null;

create or replace view reporting.dim_handover_status as
select status_code, status_name, status_sort, is_final, is_pending
from (values
  ('draft', 'Draft', 1, false, true),
  ('submitted', 'Submitted', 2, false, true),
  ('approved', 'Approved', 3, true, false),
  ('rejected', 'Rejected', 4, true, false),
  ('reopened', 'Reopened', 5, false, true)
) v(status_code, status_name, status_sort, is_final, is_pending);

create or replace view reporting.dim_approval_status as
select status_code, status_name, status_sort, is_final
from (values
  ('approved', 'Approved', 1, true),
  ('rejected', 'Rejected', 2, true)
) v(status_code, status_name, status_sort, is_final);

create or replace view reporting.dim_activity_status as
select status_code, status_name, status_sort, is_final
from (values
  ('pending', 'Pending', 1, false),
  ('in_progress', 'In Progress', 2, false),
  ('completed', 'Completed', 3, true),
  ('cancelled', 'Cancelled', 4, true)
) v(status_code, status_name, status_sort, is_final);

create or replace view reporting.dim_job_status as
select status_code, status_name, status_sort, is_final
from (values
  ('pending', 'Pending', 1, false),
  ('in_progress', 'In Progress', 2, false),
  ('completed', 'Completed', 3, true),
  ('cancelled', 'Cancelled', 4, true)
) v(status_code, status_name, status_sort, is_final);

create or replace view reporting.dim_priority as
select priority_code, priority_name, priority_sort
from (values
  ('low', 'Low', 1),
  ('medium', 'Medium', 2),
  ('high', 'High', 3),
  ('critical', 'Critical', 4)
) v(priority_code, priority_name, priority_sort);

create or replace view reporting.dim_product as
select produk, produk as produk_name
from (
  select distinct produk
  from public.tank_products
  where produk is not null
  union
  select distinct produk
  from reporting.tank_level_fact
  where produk is not null
  union
  select distinct nama_produk as produk
  from reporting.transfer_request_fact
  where nama_produk is not null
) p;

create or replace view reporting.dim_tank as
select
  no_tanki_normalized as no_tanki_key,
  max(no_tanki) as no_tanki_label,
  max(produk) as produk
from (
  select
    no_tanki as no_tanki_normalized,
    no_tanki,
    produk
  from public.tank_products
  where no_tanki is not null
  union all
  select
    no_tanki_normalized,
    no_tanki,
    produk
  from reporting.tank_level_fact
  where no_tanki_normalized is not null
) t
group by no_tanki_normalized;

grant select on
  reporting.dim_date,
  reporting.dim_operator,
  reporting.dim_supervisor,
  reporting.dim_shift,
  reporting.dim_regu,
  reporting.dim_handover_status,
  reporting.dim_approval_status,
  reporting.dim_activity_status,
  reporting.dim_job_status,
  reporting.dim_priority,
  reporting.dim_product,
  reporting.dim_tank
to powerbi_reader;

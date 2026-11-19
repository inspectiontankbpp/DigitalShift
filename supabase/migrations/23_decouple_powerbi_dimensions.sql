-- Migration 23: decouple Power BI dimensions from fact views.
--
-- Power BI DirectQuery melaporkan "A cyclic reference was encountered during
-- evaluation" ketika sebuah dimensi dibangun dari fact view yang berelasi
-- balik ke dimensi tersebut. Di model ini:
--   - dim_date   -> reporting.handover_fact
--   - dim_product -> reporting.tank_level_fact / transfer_request_fact / receiving_tank_fact
--   - dim_tank    -> reporting.tank_level_fact / receiving_tank_fact
--
-- Solusi: bangun ulang dimensi langsung dari tabel public (handovers,
-- tank_products), bukan dari reporting.*_fact. Nilai yang dihasilkan tetap
-- sama karena fact view juga membaca tabel public yang sama.

create or replace view reporting.dim_date as
with bounds as (
  select
    coalesce(min(tanggal), current_date) as min_date,
    coalesce(max(tanggal), current_date) as max_date
  from public.handovers
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

create or replace view reporting.dim_product as
select produk, produk as produk_name
from (
  select distinct produk
  from public.tank_products
  where produk is not null
  union
  select distinct tp.produk
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'tankLevels') = 'array'
        then h.operational_data->'tankLevels'
      else '[]'::jsonb
    end
  ) e
  left join public.tank_products tp
    on tp.no_tanki = nullif(substring(coalesce(e.value->>'noTanki', '') from '([0-9]+)'), '')
  where tp.produk is not null
  union
  select distinct nullif(e.value->>'produk', '')
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'tankLevels') = 'array'
        then h.operational_data->'tankLevels'
      else '[]'::jsonb
    end
  ) e
  where nullif(e.value->>'produk', '') is not null
  union
  select distinct nullif(e.value->>'namaProduk', '')
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'transferRequests') = 'array'
        then h.operational_data->'transferRequests'
      else '[]'::jsonb
    end
  ) e
  where nullif(e.value->>'namaProduk', '') is not null
  union
  select distinct tp.produk
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'receivingTanks') = 'array'
        then h.operational_data->'receivingTanks'
      else '[]'::jsonb
    end
  ) e
  left join public.tank_products tp
    on tp.no_tanki = nullif(substring(coalesce(e.value->>'noTangki', '') from '([0-9]+)'), '')
  where tp.produk is not null
  union
  select distinct nullif(e.value->>'namaProduk', '')
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'receivingTanks') = 'array'
        then h.operational_data->'receivingTanks'
      else '[]'::jsonb
    end
  ) e
  where nullif(e.value->>'namaProduk', '') is not null
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
    nullif(substring(coalesce(e.value->>'noTanki', '') from '([0-9]+)'), '') as no_tanki_normalized,
    coalesce(nullif(e.value->>'noTanki', ''), tp.no_tanki) as no_tanki,
    coalesce(tp.produk, nullif(e.value->>'produk', '')) as produk
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'tankLevels') = 'array'
        then h.operational_data->'tankLevels'
      else '[]'::jsonb
    end
  ) e
  left join public.tank_products tp
    on tp.no_tanki = nullif(substring(coalesce(e.value->>'noTanki', '') from '([0-9]+)'), '')
  union all
  select
    nullif(substring(coalesce(e.value->>'noTangki', '') from '([0-9]+)'), '') as no_tanki_normalized,
    coalesce(nullif(e.value->>'noTangki', ''), tp.no_tanki) as no_tanki,
    coalesce(tp.produk, nullif(e.value->>'namaProduk', '')) as produk
  from public.handovers h
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'receivingTanks') = 'array'
        then h.operational_data->'receivingTanks'
      else '[]'::jsonb
    end
  ) e
  left join public.tank_products tp
    on tp.no_tanki = nullif(substring(coalesce(e.value->>'noTangki', '') from '([0-9]+)'), '')
) t
where no_tanki_normalized is not null
group by no_tanki_normalized;

grant select on
  reporting.dim_date,
  reporting.dim_product,
  reporting.dim_tank
to powerbi_reader;

comment on view reporting.dim_date is 'Kalender; dibangun dari public.handovers agar tidak siklus dengan handover_fact.';
comment on view reporting.dim_product is 'Daftar produk; dibangun dari tabel public agar tidak siklus dengan fact view.';
comment on view reporting.dim_tank is 'Daftar tank; dibangun dari tabel public agar tidak siklus dengan fact view.';

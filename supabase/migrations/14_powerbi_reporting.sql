-- Power BI reporting layer.
--
-- Tujuan:
-- - Menyediakan view analytics yang sudah flatten dari operational_data JSONB.
-- - Memberi akses read-only ke role powerbi_reader.
-- - Power BI Desktop memakai DirectQuery ke view ini agar data live.
--
-- Catatan:
-- - View dimiliki oleh postgres dan memakai owner rights, sehingga tidak
--   bergantung pada auth.uid()/RLS aplikasi.
-- - Role powerbi_reader hanya diberi akses ke schema reporting, bukan public.
-- - Password role tidak disimpan di migration ini. Set password secara manual
--   setelah migration (lihat docs/integrasi-power-bi.md).

create schema if not exists reporting;

revoke all on schema reporting from public;
revoke all on all tables in schema reporting from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powerbi_reader') then
    execute 'create role powerbi_reader login noinherit';
  end if;
end $$;

alter role powerbi_reader set default_transaction_read_only = on;
alter role powerbi_reader set statement_timeout = '60s';
alter role powerbi_reader set idle_in_transaction_session_timeout = '60s';

grant connect on database postgres to powerbi_reader;
grant usage on schema reporting to powerbi_reader;

-- ============================================================
-- handover_fact: satu baris per handover
-- ============================================================
create or replace view reporting.handover_fact as
with
activity_stats as (
  select handover_id, count(*)::int as activity_count
  from public.handover_activities
  group by handover_id
),
approval_stats as (
  select handover_id, count(*)::int as approval_count
  from public.approvals
  group by handover_id
),
job_stats as (
  select
    handover_id,
    count(*)::int as outstanding_job_count,
    count(*) filter (where status in ('pending', 'in_progress'))::int as open_job_count
  from public.outstanding_jobs
  group by handover_id
),
tank_stats as (
  select
    h.id as handover_id,
    count(e.value)::int as tank_level_count
  from public.handovers h
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'tankLevels') = 'array'
        then h.operational_data->'tankLevels'
      else '[]'::jsonb
    end
  ) e on true
  group by h.id
),
qc_stats as (
  select
    h.id as handover_id,
    count(e.value)::int as qc_count
  from public.handovers h
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'qcChecks') = 'array'
        then h.operational_data->'qcChecks'
      else '[]'::jsonb
    end
  ) e on true
  group by h.id
),
critical_stats as (
  select
    h.id as handover_id,
    count(e.value)::int as critical_equipment_count,
    count(*) filter (
      where lower(coalesce(e.value->>'status', '')) not in ('ok', 'ada', 'berfungsi')
         or lower(coalesce(e.value->>'kondisi', '')) not in ('berfungsi', 'ok')
    )::int as critical_equipment_issue_count
  from public.handovers h
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'criticalEquipment') = 'array'
        then h.operational_data->'criticalEquipment'
      else '[]'::jsonb
    end
  ) e on true
  group by h.id
),
safety_stats as (
  select
    h.id as handover_id,
    count(e.value)::int as safety_tool_count,
    count(*) filter (
      where lower(coalesce(e.value->>'status', '')) not in ('ada', 'ok', 'berfungsi')
         or lower(coalesce(e.value->>'kondisi', '')) not in ('berfungsi', 'ok')
    )::int as safety_tool_issue_count
  from public.handovers h
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'safetyTools') = 'array'
        then h.operational_data->'safetyTools'
      else '[]'::jsonb
    end
  ) e on true
  group by h.id
),
transfer_stats as (
  select
    h.id as handover_id,
    count(e.value)::int as transfer_request_count,
    sum(
      nullif(
        regexp_replace(
          replace(coalesce(e.value->>'estJumlahKL', ''), ',', '.'),
          '[^0-9.]',
          '',
          'g'
        ),
        ''
      )::numeric
    ) as estimated_transfer_kl
  from public.handovers h
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'transferRequests') = 'array'
        then h.operational_data->'transferRequests'
      else '[]'::jsonb
    end
  ) e on true
  group by h.id
)
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.status,
  h.shift_id,
  s.name as shift_name,
  s.start_time as shift_start_time,
  s.end_time as shift_end_time,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  nullif(h.operational_data->>'shiftName', '') as shift_name_operational,
  nullif(h.operational_data->>'jamShift', '') as jam_shift,
  h.operator_id,
  op.full_name as operator_name,
  h.supervisor_id,
  sp.full_name as supervisor_name,
  h.kondisi_operasional,
  h.kendala,
  h.safety_issue,
  h.catatan,
  h.created_at,
  h.submitted_at,
  h.approved_at,
  h.rejected_at,
  h.reopened_at,
  h.updated_at,
  coalesce(h.rejected_at, h.approved_at) as decision_at,
  case
    when h.submitted_at is not null
      then round(extract(epoch from (h.submitted_at - h.created_at)) / 60.0, 2)
  end as submission_delay_minutes,
  case
    when coalesce(h.rejected_at, h.approved_at) is not null
     and h.submitted_at is not null
      then round(extract(epoch from (coalesce(h.rejected_at, h.approved_at) - h.submitted_at)) / 60.0, 2)
  end as decision_minutes,
  (h.status = 'draft') as is_draft,
  (h.status = 'submitted') as is_submitted,
  (h.status = 'approved') as is_approved,
  (h.status = 'rejected') as is_rejected,
  (h.status = 'reopened') as is_reopened,
  (h.status in ('submitted', 'reopened')) as is_pending,
  (nullif(btrim(coalesce(h.kendala, '')), '') is not null) as has_kendala,
  (nullif(btrim(coalesce(h.safety_issue, '')), '') is not null) as has_safety_issue,
  (nullif(btrim(coalesce(h.catatan, '')), '') is not null) as has_catatan,
  h.operational_data #>> '{teams,yangMenyerahkan,danru}' as menyerahkan_danru,
  h.operational_data #>> '{teams,yangMenerima,danru}' as menerima_danru,
  h.operational_data #>> '{teams,mengetahui,spv}' as mengetahui_spv,
  coalesce(act.activity_count, 0) as activity_count,
  coalesce(app.approval_count, 0) as approval_count,
  coalesce(job.outstanding_job_count, 0) as outstanding_job_count,
  coalesce(job.open_job_count, 0) as open_job_count,
  coalesce(tank.tank_level_count, 0) as tank_level_count,
  coalesce(qc.qc_count, 0) as qc_count,
  coalesce(crit.critical_equipment_count, 0) as critical_equipment_count,
  coalesce(crit.critical_equipment_issue_count, 0) as critical_equipment_issue_count,
  coalesce(safety.safety_tool_count, 0) as safety_tool_count,
  coalesce(safety.safety_tool_issue_count, 0) as safety_tool_issue_count,
  coalesce(tr.transfer_request_count, 0) as transfer_request_count,
  coalesce(tr.estimated_transfer_kl, 0) as estimated_transfer_kl,
  round(
    (
      (case when coalesce(act.activity_count, 0) > 0 then 1 else 0 end) +
      (case when coalesce(tank.tank_level_count, 0) > 0 then 1 else 0 end) +
      (case when coalesce(qc.qc_count, 0) > 0 then 1 else 0 end) +
      (case when coalesce(crit.critical_equipment_count, 0) > 0 then 1 else 0 end) +
      (case when coalesce(safety.safety_tool_count, 0) > 0 then 1 else 0 end)
    )::numeric / 5.0,
    2
  ) as data_completeness_score
from public.handovers h
left join public.shifts s on s.id = h.shift_id
left join public.profiles op on op.id = h.operator_id
left join public.profiles sp on sp.id = h.supervisor_id
left join activity_stats act on act.handover_id = h.id
left join approval_stats app on app.handover_id = h.id
left join job_stats job on job.handover_id = h.id
left join tank_stats tank on tank.handover_id = h.id
left join qc_stats qc on qc.handover_id = h.id
left join critical_stats crit on crit.handover_id = h.id
left join safety_stats safety on safety.handover_id = h.id
left join transfer_stats tr on tr.handover_id = h.id;

-- ============================================================
-- activity_fact: satu baris per activity
-- ============================================================
create or replace view reporting.activity_fact as
select
  a.id as activity_id,
  a.handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.status as handover_status,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  a.waktu,
  a.aktivitas,
  a.deskripsi,
  a.status,
  a.created_at,
  a.updated_at
from public.handover_activities a
join public.handovers h on h.id = a.handover_id
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id;

-- ============================================================
-- approval_fact: satu baris per approval event
-- ============================================================
create or replace view reporting.approval_fact as
select
  a.id as approval_id,
  a.handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.status as handover_status,
  a.supervisor_id,
  p.full_name as supervisor_name,
  a.status,
  a.comment,
  a.created_at,
  a.approved_at,
  h.submitted_at,
  case
    when a.approved_at is not null
     and h.submitted_at is not null
      then round(extract(epoch from (a.approved_at - h.submitted_at)) / 60.0, 2)
  end as decision_minutes,
  row_number() over (
    partition by a.handover_id
    order by a.created_at
  ) as approval_sequence
from public.approvals a
join public.handovers h on h.id = a.handover_id
left join public.profiles p on p.id = a.supervisor_id;

-- ============================================================
-- outstanding_job_fact: satu baris per outstanding job
-- ============================================================
create or replace view reporting.outstanding_job_fact as
select
  o.id as job_id,
  o.handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  o.judul,
  o.deskripsi,
  o.prioritas,
  o.pic,
  o.deadline,
  o.status,
  o.created_at,
  o.updated_at,
  (o.status in ('pending', 'in_progress')) as is_open,
  (o.status = 'completed') as is_completed,
  (o.status = 'cancelled') as is_cancelled,
  (
    o.deadline is not null
    and o.status not in ('completed', 'cancelled')
    and o.deadline < now()
  ) as is_overdue,
  case
    when o.status not in ('completed', 'cancelled')
      then round(extract(epoch from (now() - o.created_at)) / 86400.0, 2)
  end as aging_days
from public.outstanding_jobs o
join public.handovers h on h.id = o.handover_id
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id;

-- ============================================================
-- tank_level_fact: satu baris per tank level entry
-- ============================================================
create or replace view reporting.tank_level_fact as
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  nullif(e.value->>'jam', '') as jam,
  nullif(substring(coalesce(e.value->>'noTanki', '') from '([0-9]+)'), '') as no_tanki_normalized,
  coalesce(nullif(e.value->>'noTanki', ''), tp.no_tanki) as no_tanki,
  coalesce(tp.produk, nullif(e.value->>'produk', '')) as produk,
  nullif(e.value->>'level', '') as level_text,
  nullif(regexp_replace(coalesce(e.value->>'level', ''), '[^0-9]', '', 'g'), '')::numeric as level_mm,
  nullif(e.value->>'water', '') as water_text,
  nullif(regexp_replace(coalesce(e.value->>'water', ''), '[^0-9]', '', 'g'), '')::numeric as water_mm,
  nullif(e.value->>'keterangan', '') as keterangan
from public.handovers h
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(h.operational_data->'tankLevels') = 'array'
      then h.operational_data->'tankLevels'
    else '[]'::jsonb
  end
) e
left join public.tank_products tp
  on tp.no_tanki = nullif(substring(coalesce(e.value->>'noTanki', '') from '([0-9]+)'), '');

-- ============================================================
-- qc_fact: satu baris per QC check
-- ============================================================
create or replace view reporting.qc_fact as
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  nullif(e.value->>'noSarfas', '') as no_sarfas,
  nullif(e.value->>'visual', '') as visual,
  nullif(e.value->>'density', '') as density_text,
  nullif(
    regexp_replace(
      replace(coalesce(e.value->>'density', ''), ',', '.'),
      '[^0-9.]',
      '',
      'g'
    ),
    ''
  )::numeric as density,
  nullif(e.value->>'temperatur', '') as temperatur_text,
  nullif(
    regexp_replace(
      replace(coalesce(e.value->>'temperatur', ''), ',', '.'),
      '[^0-9.]',
      '',
      'g'
    ),
    ''
  )::numeric as temperatur_c,
  nullif(e.value->>'keterangan', '') as keterangan
from public.handovers h
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(h.operational_data->'qcChecks') = 'array'
      then h.operational_data->'qcChecks'
    else '[]'::jsonb
  end
) e;

-- ============================================================
-- critical_equipment_fact: satu baris per equipment check
-- ============================================================
create or replace view reporting.critical_equipment_fact as
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  nullif(e.value->>'kategori', '') as kategori,
  nullif(e.value->>'namaPeralatan', '') as nama_peralatan,
  nullif(e.value->>'status', '') as status,
  nullif(e.value->>'kondisi', '') as kondisi,
  nullif(e.value->>'keterangan', '') as keterangan,
  (
    lower(coalesce(e.value->>'status', '')) not in ('ok', 'ada', 'berfungsi')
    or lower(coalesce(e.value->>'kondisi', '')) not in ('berfungsi', 'ok')
  ) as is_issue
from public.handovers h
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(h.operational_data->'criticalEquipment') = 'array'
      then h.operational_data->'criticalEquipment'
    else '[]'::jsonb
  end
) e;

-- ============================================================
-- safety_tool_fact: satu baris per safety tool check
-- ============================================================
create or replace view reporting.safety_tool_fact as
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  nullif(e.value->>'nama', '') as nama,
  nullif(e.value->>'status', '') as status,
  nullif(e.value->>'kondisi', '') as kondisi,
  nullif(e.value->>'keterangan', '') as keterangan,
  (
    lower(coalesce(e.value->>'status', '')) not in ('ada', 'ok', 'berfungsi')
    or lower(coalesce(e.value->>'kondisi', '')) not in ('berfungsi', 'ok')
  ) as is_issue
from public.handovers h
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(h.operational_data->'safetyTools') = 'array'
      then h.operational_data->'safetyTools'
    else '[]'::jsonb
  end
) e;

-- ============================================================
-- transfer_request_fact: satu baris per transfer request
-- ============================================================
create or replace view reporting.transfer_request_fact as
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  nullif(e.value->>'noTangki', '') as no_tangki,
  nullif(e.value->>'namaProduk', '') as nama_produk,
  nullif(e.value->>'estJumlahKL', '') as est_jumlah_kl_text,
  nullif(
    regexp_replace(
      replace(coalesce(e.value->>'estJumlahKL', ''), ',', '.'),
      '[^0-9.]',
      '',
      'g'
    ),
    ''
  )::numeric as est_jumlah_kl,
  nullif(e.value->>'estimasiJam', '') as estimasi_jam,
  nullif(e.value->>'keterangan', '') as keterangan
from public.handovers h
left join public.shifts s on s.id = h.shift_id
left join public.profiles p on p.id = h.operator_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(h.operational_data->'transferRequests') = 'array'
      then h.operational_data->'transferRequests'
    else '[]'::jsonb
  end
) e;

-- ============================================================
-- Grants
-- ============================================================
grant select on all tables in schema reporting to powerbi_reader;
alter default privileges in schema reporting grant select on tables to powerbi_reader;

comment on schema reporting is 'Analytics views untuk Power BI (read-only, owner rights).';
comment on view reporting.handover_fact is 'Satu baris per handover, sudah flatten JSONB dan metrics.';
comment on view reporting.activity_fact is 'Satu baris per activity handover.';
comment on view reporting.approval_fact is 'Satu baris per approval event.';
comment on view reporting.outstanding_job_fact is 'Satu baris per outstanding job.';
comment on view reporting.tank_level_fact is 'Satu baris per tank level entry.';
comment on view reporting.qc_fact is 'Satu baris per QC check.';
comment on view reporting.critical_equipment_fact is 'Satu baris per critical equipment check.';
comment on view reporting.safety_tool_fact is 'Satu baris per safety tool check.';
comment on view reporting.transfer_request_fact is 'Satu baris per transfer request.';

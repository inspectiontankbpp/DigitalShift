-- Migration 22: reporting layer untuk Tangki Penerimaan.
--
-- Menambah fact view baru, agregat di handover_fact, dan memperluas
-- dimensi tank/produk agar data tangki penerimaan ikut terwakili.

create or replace view reporting.receiving_tank_fact as
select
  h.id as handover_id,
  h.form_number,
  h.tanggal as tanggal_operasional,
  h.shift_id,
  s.name as shift_name,
  nullif(h.operational_data->>'reguShift', '') as regu_shift,
  h.operator_id,
  p.full_name as operator_name,
  nullif(substring(coalesce(e.value->>'noTangki', '') from '([0-9]+)'), '') as no_tanki_normalized,
  coalesce(nullif(e.value->>'noTangki', ''), tp.no_tanki) as no_tangki,
  coalesce(tp.produk, nullif(e.value->>'namaProduk', '')) as nama_produk,
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
    when jsonb_typeof(h.operational_data->'receivingTanks') = 'array'
      then h.operational_data->'receivingTanks'
    else '[]'::jsonb
  end
) e
left join public.tank_products tp
  on tp.no_tanki = nullif(substring(coalesce(e.value->>'noTangki', '') from '([0-9]+)'), '');

grant select on reporting.receiving_tank_fact to powerbi_reader;
comment on view reporting.receiving_tank_fact is 'Satu baris per tangki penerimaan.';

-- ============================================================
-- handover_fact: tambah agregat penerimaan (kolom baru di akhir).
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
),
receiving_stats as (
  select
    h.id as handover_id,
    count(e.value)::int as receiving_tank_count,
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
    ) as estimated_receiving_kl
  from public.handovers h
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(h.operational_data->'receivingTanks') = 'array'
        then h.operational_data->'receivingTanks'
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
  ) as data_completeness_score,
  coalesce(recv.receiving_tank_count, 0) as receiving_tank_count,
  coalesce(recv.estimated_receiving_kl, 0) as estimated_receiving_kl
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
left join transfer_stats tr on tr.handover_id = h.id
left join receiving_stats recv on recv.handover_id = h.id;

-- ============================================================
-- Dimensi: sertakan tank/produk dari tangki penerimaan.
-- ============================================================
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
  union all
  select
    no_tanki_normalized,
    no_tangki as no_tanki,
    nama_produk as produk
  from reporting.receiving_tank_fact
  where no_tanki_normalized is not null
) t
group by no_tanki_normalized;

create or replace view reporting.dim_product as
select
  produk,
  produk as produk_name
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
  union
  select distinct nama_produk as produk
  from reporting.receiving_tank_fact
  where nama_produk is not null
) p;

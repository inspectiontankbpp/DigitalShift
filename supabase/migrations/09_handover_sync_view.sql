-- SQL Migration: View untuk sinkronisasi Supabase → Google Sheets (satu arah)
-- View ini mengekspos hanya kolom terpilih ke role anon.
-- SECURITY DEFINER: query berjalan sebagai pembuat view (postgres), bukan role anon.

CREATE OR REPLACE VIEW public.handover_sync AS
SELECT
  h.form_number,
  h.tanggal,
  s.name                                      AS shift,
  h.operational_data ->> 'reguShift'          AS regu_shift,
  h.operational_data ->> 'jamShift'           AS jam_shift,
  p.full_name                                 AS operator,
  h.kondisi_operasional,
  h.status,
  h.submitted_at,
  h.approved_at,
  h.catatan,
  h.safety_issue,
  h.kendala,
  h.operational_data #>> '{teams,yangMenyerahkan,danru}' AS menyerahkan_danru,
  h.operational_data #>> '{teams,yangMenerima,danru}'   AS menerima_danru,
  h.operational_data #>> '{teams,mengetahui,spv}'       AS mengetahui_spv,
  h.updated_at
FROM public.handovers h
LEFT JOIN public.shifts s   ON s.id = h.shift_id
LEFT JOIN public.profiles p ON p.id = h.operator_id;

ALTER VIEW public.handover_sync SET (security_invoker = false);

GRANT SELECT ON public.handover_sync TO anon;

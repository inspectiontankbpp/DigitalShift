-- Migration 04: Hapus fitur acknowledge dari database
-- Jalankan di Supabase Dashboard > SQL Editor.
-- 1) Drop tabel acknowledgements
-- 2) Drop kolom acknowledged_at di handovers (bila ada)
-- 3) Bersihkan status 'acknowledged' dari CHECK constraint handovers.status

DROP TABLE IF EXISTS public.acknowledgements;

ALTER TABLE public.handovers DROP COLUMN IF EXISTS acknowledged_at;

DO $$
DECLARE
  cons TEXT;
BEGIN
  SELECT conname INTO cons
  FROM pg_constraint
  WHERE conrelid = 'handovers'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%acknowledged%'
  LIMIT 1;

  IF cons IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.handovers DROP CONSTRAINT %I', cons);
    ALTER TABLE public.handovers
      ADD CONSTRAINT handovers_status_check
      CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'reopened'));
    RAISE NOTICE 'CHECK constraint % dihapus & diganti tanpa status acknowledged', cons;
  ELSE
    RAISE NOTICE 'Tidak ada CHECK constraint yang mengandung acknowledged';
  END IF;
END $$;

-- Migration 03: Hapus handover beserta seluruh data turunannya di database
-- Jalankan di Supabase Dashboard > SQL Editor.
-- 1) Izinkan DELETE pada handovers (app memanggil supabase.from("handovers").delete())
-- 2) Pastikan semua FK anak memakai ON DELETE CASCADE (aktif/koreksi bila belum)
-- 3) Tambah policy DELETE pada tabel anak yang sudah mengaktifkan RLS

-- ===== 1. Policy DELETE pada handovers =====
DROP POLICY IF EXISTS handovers_delete ON public.handovers;
CREATE POLICY handovers_delete ON public.handovers FOR DELETE USING (true);

-- ===== 2. Pastikan FK anak -> handovers(id) ON DELETE CASCADE =====
DO $$
DECLARE
  t    TEXT;
  cons TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'handover_activities',
    'outstanding_jobs',
    'approvals',
    'acknowledgements',
    'attachments',
    'handover_tank_levels',
    'handover_qc_checks',
    'handover_critical_equipment',
    'handover_safety_tools',
    'handover_transfer_requests'
  ]
  LOOP
    -- hanya proses bila tabel ada
    IF to_regclass(t) IS NOT NULL THEN
      SELECT conname INTO cons
      FROM pg_constraint
      WHERE conrelid = to_regclass(t)
        AND contype = 'f'
        AND confrelid = 'handovers'::regclass
      LIMIT 1;

      IF cons IS NOT NULL THEN
        -- FK sudah ada tapi belum CASCADE -> bangun ulang
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = cons AND confdeltype <> 'c'
        ) THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, cons);
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (handover_id) REFERENCES handovers(id) ON DELETE CASCADE',
            t, t || '_handover_id_fkey'
          );
          RAISE NOTICE 'FK %I pada tabel % diperbaiki menjadi ON DELETE CASCADE', cons, t;
        END IF;
      ELSE
        -- FK belum ada -> buat dengan CASCADE
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (handover_id) REFERENCES handovers(id) ON DELETE CASCADE',
          t, t || '_handover_id_fkey'
        );
        RAISE NOTICE 'FK baru ditambahkan ke tabel % dengan ON DELETE CASCADE', t;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ===== 3. Policy DELETE pada tabel anak yang RLS-nya aktif =====
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'handover_activities',
    'outstanding_jobs',
    'approvals',
    'acknowledgements',
    'attachments'
  ]
  LOOP
    IF to_regclass(t) IS NOT NULL AND EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (true)', t || '_delete', t);
      RAISE NOTICE 'Policy DELETE ditambahkan ke tabel %', t;
    END IF;
  END LOOP;
END $$;

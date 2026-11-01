-- Migration 12: waktu aktivitas opsional
ALTER TABLE public.handover_activities
  ALTER COLUMN waktu DROP NOT NULL;

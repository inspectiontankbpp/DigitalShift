-- SQL Migration: Remove unused features
-- 1. Departments (feature removed from app)
-- 2. Unused tables: roles, audit_trail, attachments (upload feature removed)
-- 3. Unused columns on handovers: alarm, safety_note, informasi_penting
-- 4. Storage bucket handover-attachments + its policies (upload feature removed)

-- 1. Departments: drop FK + column on profiles, then the table
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_id_fkey;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department_id;
DROP TABLE IF EXISTS public.departments;

-- 2. Unused tables
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.attachments;
DROP TABLE IF EXISTS public.audit_trail;

-- 3. Unused columns on handovers
ALTER TABLE public.handovers DROP COLUMN IF EXISTS alarm;
ALTER TABLE public.handovers DROP COLUMN IF EXISTS safety_note;
ALTER TABLE public.handovers DROP COLUMN IF EXISTS informasi_penting;

-- 4. Storage: drop policies (bucket handover-attachments masih ada tapi kosong;
--    penghapusan bucket hanya bisa lewat Storage API/service role, bukan SQL) 
DROP POLICY IF EXISTS public_read ON storage.objects;
DROP POLICY IF EXISTS authenticated_uploads ON storage.objects;
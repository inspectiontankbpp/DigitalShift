-- Migration 10: Comprehensive Security, RLS, Audit Trail & Performance Fixes
-- Addresses: S1, S2, S3, S4, S5, F1, D1, D2, D3, S7

-- ============================================================
-- S2: Fix handovers_delete — operator can delete own drafts, supervisor can delete non-approved
-- ============================================================
DROP POLICY IF EXISTS handovers_delete ON public.handovers;
CREATE POLICY handovers_delete ON public.handovers
  FOR DELETE USING (
    -- Supervisor can delete any non-approved handover
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'supervisor'))
    OR
    -- Operator can delete their own drafts only
    (operator_id = auth.uid() AND status = 'draft')
  );

-- ============================================================
-- S2: Fix handovers_insert — only operators can create their own handovers
-- ============================================================
DROP POLICY IF EXISTS handovers_insert ON public.handovers;
CREATE POLICY handovers_insert ON public.handovers
  FOR INSERT WITH CHECK (
    operator_id = auth.uid()
  );

-- ============================================================
-- S2: Fix handovers_update — operator can update own drafts, supervisor can update status
-- ============================================================
DROP POLICY IF EXISTS handovers_update ON public.handovers;
CREATE POLICY handovers_update ON public.handovers
  FOR UPDATE USING (
    -- Supervisor can update any handover (for approve/reject/reopen)
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'supervisor'))
    OR
    -- Operator can update their own drafts
    (operator_id = auth.uid() AND status = 'draft')
  );

-- ============================================================
-- S2: Fix handovers_select — operator sees own handovers, supervisor sees all
-- ============================================================
DROP POLICY IF EXISTS handovers_select ON public.handovers;
CREATE POLICY handovers_select ON public.handovers
  FOR SELECT USING (
    -- Supervisor sees all
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'supervisor'))
    OR
    -- Operator sees their own
    (operator_id = auth.uid())
  );

-- ============================================================
-- S3: Fix child tables — restrict SELECT/INSERT/UPDATE/DELETE to handover owner or supervisor
-- For all operational child tables: tank_levels, qc_checks, critical_equipment, safety_tools, transfer_requests
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'handover_tank_levels',
    'handover_qc_checks',
    'handover_critical_equipment',
    'handover_safety_tools',
    'handover_transfer_requests'
  ]
  LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      -- Drop old permissive policies
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated read %I" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated insert %I" ON %I', tbl, tbl);

      -- SELECT: handover owner or supervisor
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT USING (
          EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
            AND (handovers.operator_id = auth.uid()
              OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ''supervisor'')))
        )',
        tbl || '_select', tbl, tbl
      );

      -- INSERT: handover owner (for their own handovers in draft)
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
            AND handovers.operator_id = auth.uid()
            AND handovers.status = ''draft'')
        )',
        tbl || '_insert', tbl, tbl
      );

      -- UPDATE: handover owner (draft) or supervisor
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE USING (
          EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
            AND (handovers.operator_id = auth.uid() AND handovers.status = ''draft''
              OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ''supervisor'')))
        )',
        tbl || '_update', tbl, tbl
      );

      -- DELETE: handover owner (draft) or supervisor
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE USING (
          EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
            AND (handovers.operator_id = auth.uid() AND handovers.status = ''draft''
              OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ''supervisor'')))
        )',
        tbl || '_delete', tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- S4: Fix child tables (activities, outstanding_jobs) — restrict DELETE
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'handover_activities',
    'outstanding_jobs'
  ]
  LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      -- Drop old permissive delete policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_delete', tbl);

      -- Ensure RLS is enabled
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      -- SELECT: owner or supervisor
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = tbl || '_select' AND tablename = tbl
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT USING (
            EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
              AND (handovers.operator_id = auth.uid()
                OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ''supervisor'')))
          )',
          tbl || '_select', tbl, tbl
        );
      END IF;

      -- INSERT: owner (draft)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = tbl || '_insert' AND tablename = tbl
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
              AND handovers.operator_id = auth.uid()
              AND handovers.status = ''draft'')
          )',
          tbl || '_insert', tbl, tbl
        );
      END IF;

      -- UPDATE: owner (draft) or supervisor
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = tbl || '_update' AND tablename = tbl
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR UPDATE USING (
            EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
              AND (handovers.operator_id = auth.uid() AND handovers.status = ''draft''
                OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ''supervisor'')))
          )',
          tbl || '_update', tbl, tbl
        );
      END IF;

      -- DELETE: owner (draft) or supervisor
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE USING (
          EXISTS (SELECT 1 FROM handovers WHERE handovers.id = %I.handover_id
            AND (handovers.operator_id = auth.uid() AND handovers.status = ''draft''
              OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ''supervisor'')))
        )',
        tbl || '_delete', tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- S4: Fix approvals DELETE — only supervisor or handover owner
-- ============================================================
DROP POLICY IF EXISTS approvals_delete ON public.approvals;
CREATE POLICY approvals_delete ON public.approvals
  FOR DELETE USING (
    supervisor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'supervisor')
  );

-- ============================================================
-- S5: Revoke EXECUTE from anon for SECURITY DEFINER functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION audit_handovers() FROM anon;
REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM anon;

-- ============================================================
-- D2: Optimize RLS policies — replace per-row auth.uid() with (select auth.uid())
-- ============================================================
-- profiles_select
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'supervisor')
  );

-- profiles_update
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (
    id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'supervisor')
  );

-- ============================================================
-- F1: Re-create audit_trail table + trigger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Only supervisor can read audit trail
CREATE POLICY audit_trail_select ON public.audit_trail
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'supervisor')
  );

-- System inserts via trigger (no user INSERT policy needed)

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_handovers_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (table_name, record_id, action, new_data, performed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), NEW.operator_id);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail (table_name, record_id, action, old_data, new_data, performed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), (select auth.uid()));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_trail (table_name, record_id, action, old_data, performed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), (select auth.uid()));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, then create
DROP TRIGGER IF EXISTS audit_handovers ON public.handovers;
CREATE TRIGGER audit_handovers
  AFTER INSERT OR UPDATE OR DELETE ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION audit_handovers_trigger();

-- ============================================================
-- D1: Add missing indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_approvals_supervisor ON public.approvals(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_handovers_shift ON public.handovers(shift_id);
CREATE INDEX IF NOT EXISTS idx_handovers_operator ON public.handovers(operator_id);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON public.handovers(status);
CREATE INDEX IF NOT EXISTS idx_audit_trail_table ON public.audit_trail(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_trail_record ON public.audit_trail(record_id);

-- ============================================================
-- D3: Drop orphaned storage bucket (cleanup)
-- ============================================================
DELETE FROM storage.buckets WHERE id = 'handover-attachments';

-- ============================================================
-- S1: Fix handover_sync view security — remove anon grant, use security_invoker
-- ============================================================
GRANT USAGE ON public.handover_sync TO authenticated;
REVOKE SELECT ON public.handover_sync FROM anon;
ALTER VIEW public.handover_sync SET (security_invoker = true);

-- Migration 13: operator boleh mengedit handover miliknya yang reopened
DROP POLICY IF EXISTS handovers_update ON public.handovers;

CREATE POLICY handovers_update ON public.handovers
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() = 'supervisor'
    OR (
      operator_id = (select auth.uid())
      AND status = ANY (ARRAY['draft'::text, 'reopened'::text])
    )
  )
  WITH CHECK (
    get_current_user_role() = 'supervisor'
    OR (
      operator_id = (select auth.uid())
      AND status = ANY (ARRAY['draft'::text, 'submitted'::text])
    )
  );

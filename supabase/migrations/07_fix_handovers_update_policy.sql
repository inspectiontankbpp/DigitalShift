-- SQL Migration: Fix handovers UPDATE policy
-- Supervisor couldn't approve/reject/reopen because the policy only allowed
-- the operator or a supervisor_id that is never populated (silent 0-row UPDATE).

DROP POLICY IF EXISTS handovers_update ON public.handovers;
CREATE POLICY handovers_update ON public.handovers
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = operator_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  )
  WITH CHECK (
    auth.uid() = operator_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  );
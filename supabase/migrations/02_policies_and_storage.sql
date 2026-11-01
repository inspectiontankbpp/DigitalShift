-- Add delete policy for handovers
DROP POLICY IF EXISTS handovers_delete ON public.handovers;
CREATE POLICY handovers_delete ON public.handovers FOR DELETE USING (true);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('handover-attachments', 'handover-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read
CREATE POLICY "authenticated_uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'handover-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'handover-attachments');

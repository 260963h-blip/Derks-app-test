CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'overig',
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own emp docs select" ON public.employee_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own emp docs insert" ON public.employee_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own emp docs update" ON public.employee_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own emp docs delete" ON public.employee_documents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_employee_documents_updated_at
BEFORE UPDATE ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);

CREATE POLICY "own emp files select" ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own emp files insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own emp files update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own emp files delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
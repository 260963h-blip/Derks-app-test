
-- 1. projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_number text NOT NULL,
  title text NOT NULL DEFAULT '',
  customer_id uuid,
  contact_id uuid,
  reference text,
  status text NOT NULL DEFAULT 'nieuw',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_number)
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects select" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own projects insert" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects update" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own projects delete" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. quotes -> project_id
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS project_id uuid;
CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON public.quotes(project_id);

-- 3. work_orders
CREATE TABLE public.work_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  work_date date,
  executor text,
  status text NOT NULL DEFAULT 'gepland',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wo select" ON public.work_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own wo insert" ON public.work_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wo update" ON public.work_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own wo delete" ON public.work_orders FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. invoices
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'concept',
  subtotal numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, invoice_number)
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inv select" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own inv insert" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own inv update" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own inv delete" ON public.invoices FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. project_documents
CREATE TABLE public.project_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  doc_type text NOT NULL DEFAULT 'overig',
  file_name text NOT NULL,
  file_path text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  mime_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pd select" ON public.project_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pd insert" ON public.project_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pd update" ON public.project_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own pd delete" ON public.project_documents FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_project_documents_project ON public.project_documents(project_id);

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own project docs select" ON storage.objects FOR SELECT
  USING (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own project docs insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own project docs update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own project docs delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Invoice number counters
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS invoice_number_prefix text NOT NULL DEFAULT 'F';

-- 8. Migrate existing quotes -> projects
INSERT INTO public.projects (user_id, project_number, title, customer_id, contact_id, reference, status, notes, created_at, updated_at)
SELECT q.user_id,
       q.quote_number,
       COALESCE(q.reference, q.quote_number),
       q.customer_id,
       q.contact_id,
       q.reference,
       CASE WHEN q.status = 'akkoord' THEN 'akkoord'
            WHEN q.status = 'concept' THEN 'offerte'
            ELSE 'offerte' END,
       q.notes,
       q.created_at,
       q.updated_at
FROM public.quotes q
WHERE q.project_id IS NULL;

UPDATE public.quotes q
SET project_id = p.id
FROM public.projects p
WHERE q.project_id IS NULL
  AND p.user_id = q.user_id
  AND p.project_number = q.quote_number;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS location_address text,
  ADD COLUMN IF NOT EXISTS location_postal_code text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_phone text;

CREATE TABLE public.planning_sync_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  external_key text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  last_seen_data jsonb,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_sync_rows TO authenticated;
GRANT ALL ON public.planning_sync_rows TO service_role;
ALTER TABLE public.planning_sync_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own planning_sync_rows select" ON public.planning_sync_rows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own planning_sync_rows insert" ON public.planning_sync_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own planning_sync_rows update" ON public.planning_sync_rows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own planning_sync_rows delete" ON public.planning_sync_rows FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_planning_sync_rows_updated_at BEFORE UPDATE ON public.planning_sync_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.planning_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sync_row_id uuid NOT NULL REFERENCES public.planning_sync_rows(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('nieuw','gewijzigd','verdwenen')),
  old_data jsonb,
  new_data jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','goedgekeurd','afgewezen')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_changes TO authenticated;
GRANT ALL ON public.planning_changes TO service_role;
ALTER TABLE public.planning_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own planning_changes select" ON public.planning_changes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own planning_changes insert" ON public.planning_changes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own planning_changes update" ON public.planning_changes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own planning_changes delete" ON public.planning_changes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_planning_changes_sync_row ON public.planning_changes(sync_row_id);
CREATE TRIGGER update_planning_changes_updated_at BEFORE UPDATE ON public.planning_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.unmatched_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'whatsapp',
  caption text,
  file_path text NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','gekoppeld','genegeerd')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unmatched_photos TO authenticated;
GRANT ALL ON public.unmatched_photos TO service_role;
ALTER TABLE public.unmatched_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own unmatched_photos select" ON public.unmatched_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own unmatched_photos insert" ON public.unmatched_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own unmatched_photos update" ON public.unmatched_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own unmatched_photos delete" ON public.unmatched_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_unmatched_photos_updated_at BEFORE UPDATE ON public.unmatched_photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.customers (user_id, name, customer_type)
SELECT u.id, 'Vlassak B.V.', 'zakelijk'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers c WHERE c.user_id = u.id AND c.name = 'Vlassak B.V.'
);
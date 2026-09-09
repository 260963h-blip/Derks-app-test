-- 1. Voeg qr_token toe aan projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS qr_token text;

-- Vul bestaande projecten met unieke tokens
UPDATE public.projects
SET qr_token = encode(gen_random_bytes(32), 'hex')
WHERE qr_token IS NULL OR qr_token = '';

ALTER TABLE public.projects ALTER COLUMN qr_token SET NOT NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_qr_token_unique UNIQUE (qr_token);
ALTER TABLE public.projects ALTER COLUMN qr_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- 2. Nieuwe tabel time_clock_entries
CREATE TABLE public.time_clock_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  clock_in_at timestamp with time zone NOT NULL DEFAULT now(),
  clock_out_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Grants en RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_clock_entries TO authenticated;
GRANT ALL ON public.time_clock_entries TO service_role;

ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medewerkers kunnen eigen klokregistraties zien"
ON public.time_clock_entries FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Medewerkers kunnen eigen klokregistraties aanmaken"
ON public.time_clock_entries FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
);

CREATE POLICY "Medewerkers kunnen eigen klokregistraties bijwerken"
ON public.time_clock_entries FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
);

CREATE POLICY "Medewerkers kunnen eigen klokregistraties verwijderen"
ON public.time_clock_entries FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 4. Voorkom dubbel inklokken: maximaal één open regel per medewerker
CREATE UNIQUE INDEX idx_time_clock_one_open_per_employee
ON public.time_clock_entries(employee_id)
WHERE clock_out_at IS NULL;

-- 5. Automatisch updated_at bijwerken
CREATE TRIGGER update_time_clock_entries_updated_at
BEFORE UPDATE ON public.time_clock_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
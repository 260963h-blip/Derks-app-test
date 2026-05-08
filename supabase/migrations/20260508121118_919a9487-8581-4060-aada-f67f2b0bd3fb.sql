CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  bsn TEXT,
  date_of_birth DATE,
  street TEXT,
  house_number TEXT,
  house_number_addition TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Nederland',
  phone TEXT,
  mobile TEXT,
  email TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'actief',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own employees select" ON public.employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own employees insert" ON public.employees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own employees update" ON public.employees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own employees delete" ON public.employees FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'in_dienst';

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_employment_type_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employment_type_check
  CHECK (employment_type IN ('in_dienst', 'zzp'));
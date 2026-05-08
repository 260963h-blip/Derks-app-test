-- Add role to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'medewerker';

-- Employee rates table
CREATE TABLE IF NOT EXISTS public.employee_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  name text NOT NULL,
  hourly_rate numeric NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own emp rates select" ON public.employee_rates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own emp rates insert" ON public.employee_rates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own emp rates update" ON public.employee_rates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own emp rates delete" ON public.employee_rates
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_employee_rates_updated_at
  BEFORE UPDATE ON public.employee_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_employee_rates_employee ON public.employee_rates(employee_id);
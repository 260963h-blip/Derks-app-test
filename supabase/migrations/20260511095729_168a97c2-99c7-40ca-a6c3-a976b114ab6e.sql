CREATE TABLE public.finishes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  price_per_m2 numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.finishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own finishes select" ON public.finishes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own finishes insert" ON public.finishes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own finishes update" ON public.finishes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own finishes delete" ON public.finishes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_finishes_updated_at
BEFORE UPDATE ON public.finishes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
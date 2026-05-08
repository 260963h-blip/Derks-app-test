CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  default_walls INTEGER NOT NULL DEFAULT 4,
  include_ceiling BOOLEAN NOT NULL DEFAULT false,
  default_m2 NUMERIC,
  price_per_m2 NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 9,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rooms select" ON public.rooms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rooms insert" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rooms update" ON public.rooms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own rooms delete" ON public.rooms FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
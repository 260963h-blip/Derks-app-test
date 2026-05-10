CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time NOT NULL DEFAULT '07:00',
  end_time time NOT NULL DEFAULT '17:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reservations select" ON public.reservations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own reservations insert" ON public.reservations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reservations update" ON public.reservations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own reservations delete" ON public.reservations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
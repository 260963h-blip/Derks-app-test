CREATE TABLE public.holiday_unblocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  holiday_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, holiday_date)
);

ALTER TABLE public.holiday_unblocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own holiday unblocks select" ON public.holiday_unblocks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own holiday unblocks insert" ON public.holiday_unblocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own holiday unblocks delete" ON public.holiday_unblocks
  FOR DELETE USING (auth.uid() = user_id);
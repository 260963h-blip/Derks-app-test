CREATE TABLE public.planning_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '07:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  employee_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own planning select" ON public.planning_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own planning insert" ON public.planning_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own planning update" ON public.planning_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own planning delete" ON public.planning_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_planning_user_date ON public.planning_items(user_id, work_date);

CREATE TRIGGER update_planning_items_updated_at
BEFORE UPDATE ON public.planning_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
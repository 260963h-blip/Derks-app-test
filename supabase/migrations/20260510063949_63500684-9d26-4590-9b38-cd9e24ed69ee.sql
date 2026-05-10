ALTER TABLE public.planning_items ADD COLUMN end_date DATE;
UPDATE public.planning_items SET end_date = work_date WHERE end_date IS NULL;
ALTER TABLE public.planning_items ALTER COLUMN end_date SET NOT NULL;
ALTER TABLE public.planning_items ALTER COLUMN end_date SET DEFAULT CURRENT_DATE;
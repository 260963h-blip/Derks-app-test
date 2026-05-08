
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  hours NUMERIC NOT NULL DEFAULT 0,
  entry_type TEXT NOT NULL DEFAULT 'regulier',
  customer_id UUID,
  project TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'concept',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own time entries select" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own time entries insert" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own time entries update" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own time entries delete" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_time_entries_employee ON public.time_entries(employee_id, work_date);

CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'vakantie',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'aangevraagd',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own leave select" ON public.leave_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own leave insert" ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own leave update" ON public.leave_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own leave delete" ON public.leave_requests FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id, start_date);

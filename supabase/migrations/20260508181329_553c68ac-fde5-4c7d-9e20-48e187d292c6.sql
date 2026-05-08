CREATE TABLE public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  quote_number text NOT NULL,
  customer_id uuid,
  status text NOT NULL DEFAULT 'concept',
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own quotes select" ON public.quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own quotes insert" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own quotes update" ON public.quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own quotes delete" ON public.quotes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quote_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_type text NOT NULL DEFAULT 'artikel',
  reference_id uuid,
  reference_extra text,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 21,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own quote lines select" ON public.quote_lines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own quote lines insert" ON public.quote_lines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own quote lines update" ON public.quote_lines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own quote lines delete" ON public.quote_lines FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_quote_lines_updated_at BEFORE UPDATE ON public.quote_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quote_lines_quote_id ON public.quote_lines(quote_id);
CREATE INDEX idx_quotes_user_id ON public.quotes(user_id);
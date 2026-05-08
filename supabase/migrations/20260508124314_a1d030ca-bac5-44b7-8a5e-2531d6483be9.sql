CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_type TEXT NOT NULL DEFAULT 'materiaal',
  category TEXT NOT NULL,
  subcategory TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'stuk',
  unit_label TEXT,
  vat_rate NUMERIC NOT NULL DEFAULT 21,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC,
  field_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own articles select" ON public.articles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own articles insert" ON public.articles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own articles update" ON public.articles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own articles delete" ON public.articles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_articles_user_type ON public.articles(user_id, article_type);
CREATE INDEX idx_articles_category ON public.articles(category);
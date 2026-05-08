CREATE TABLE public.article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'materiaal',
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, name)
);
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cats select" ON public.article_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cats insert" ON public.article_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cats update" ON public.article_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own cats delete" ON public.article_categories FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_article_categories_updated_at BEFORE UPDATE ON public.article_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.article_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
ALTER TABLE public.article_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own units select" ON public.article_units FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own units insert" ON public.article_units FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own units update" ON public.article_units FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own units delete" ON public.article_units FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_article_units_updated_at BEFORE UPDATE ON public.article_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for company assets (logo + extra images), public read
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read; user can manage their own folder
CREATE POLICY "company-assets public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

CREATE POLICY "company-assets owner insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "company-assets owner update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "company-assets owner delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Extra images table
CREATE TABLE public.company_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company images select"
ON public.company_images FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "own company images insert"
ON public.company_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own company images update"
ON public.company_images FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "own company images delete"
ON public.company_images FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_company_images_updated_at
BEFORE UPDATE ON public.company_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

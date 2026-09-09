ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS clock_qr_token text;

UPDATE public.company_settings SET clock_qr_token = encode(gen_random_bytes(16), 'hex') WHERE clock_qr_token IS NULL;

ALTER TABLE public.company_settings ALTER COLUMN clock_qr_token SET DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE public.company_settings ALTER COLUMN clock_qr_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_settings_clock_qr_token_key ON public.company_settings (clock_qr_token);
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS quote_number_year integer NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  ADD COLUMN IF NOT EXISTS quote_number_next integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS invoice_number_year integer NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  ADD COLUMN IF NOT EXISTS invoice_number_next integer NOT NULL DEFAULT 1;
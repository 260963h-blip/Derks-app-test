
-- Helper: update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Company settings (1 per user)
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Nederland',
  phone TEXT,
  email TEXT,
  website TEXT,
  kvk_number TEXT,
  vat_number TEXT,
  iban TEXT,
  bic TEXT,
  logo_url TEXT,
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  default_payment_term_days INTEGER NOT NULL DEFAULT 14,
  default_quote_validity_days INTEGER NOT NULL DEFAULT 30,
  quote_footer TEXT,
  invoice_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company select" ON public.company_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own company insert" ON public.company_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own company update" ON public.company_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own company delete" ON public.company_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_company_settings_updated
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Nederland',
  phone TEXT,
  email TEXT,
  kvk_number TEXT,
  vat_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own customers select" ON public.customers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own customers insert" ON public.customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers update" ON public.customers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own customers delete" ON public.customers
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_customers_user ON public.customers(user_id);
CREATE INDEX idx_customers_name ON public.customers(user_id, name);

CREATE TRIGGER trg_customers_updated
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

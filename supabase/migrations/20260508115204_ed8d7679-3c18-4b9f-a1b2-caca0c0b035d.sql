
-- 1) Klanten uitbreiden
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'particulier',
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS house_number_addition text,
  ADD COLUMN IF NOT EXISTS email_invoice text,
  ADD COLUMN IF NOT EXISTS default_vat_type text NOT NULL DEFAULT 'hoog',
  ADD COLUMN IF NOT EXISTS default_vat_rate numeric NOT NULL DEFAULT 21;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_customer_type_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_type_check
  CHECK (customer_type IN ('particulier','zakelijk'));

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_default_vat_type_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_default_vat_type_check
  CHECK (default_vat_type IN ('verlegd','laag','hoog'));

-- 2) Contactpersonen tabel (voor zakelijke klanten, maar technisch op iedere klant toegestaan)
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id
  ON public.customer_contacts(customer_id);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own contacts select" ON public.customer_contacts;
DROP POLICY IF EXISTS "own contacts insert" ON public.customer_contacts;
DROP POLICY IF EXISTS "own contacts update" ON public.customer_contacts;
DROP POLICY IF EXISTS "own contacts delete" ON public.customer_contacts;

CREATE POLICY "own contacts select" ON public.customer_contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own contacts insert" ON public.customer_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contacts update" ON public.customer_contacts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own contacts delete" ON public.customer_contacts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

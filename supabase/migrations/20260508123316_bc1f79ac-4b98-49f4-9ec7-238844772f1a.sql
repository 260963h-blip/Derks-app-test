
ALTER TABLE public.company_settings
  ADD COLUMN owner_first_name TEXT,
  ADD COLUMN owner_middle_name TEXT,
  ADD COLUMN owner_last_name TEXT,
  ADD COLUMN owner_date_of_birth DATE,
  ADD COLUMN owner_bsn TEXT,
  ADD COLUMN owner_street TEXT,
  ADD COLUMN owner_house_number TEXT,
  ADD COLUMN owner_house_number_addition TEXT,
  ADD COLUMN owner_postal_code TEXT,
  ADD COLUMN owner_city TEXT,
  ADD COLUMN owner_phone TEXT,
  ADD COLUMN owner_email TEXT;

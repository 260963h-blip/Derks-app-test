ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'per_m2',
ADD COLUMN IF NOT EXISTS fixed_price numeric NOT NULL DEFAULT 0;
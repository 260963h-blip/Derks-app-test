ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;
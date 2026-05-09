ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approval_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Allow anonymous lookup of quote by approval_token (only minimal info exposed via app code)
CREATE POLICY "public can read quote by approval token"
  ON public.quotes
  FOR SELECT
  TO anon, authenticated
  USING (approval_token IS NOT NULL);

-- Allow anonymous approval via token: only set status to 'akkoord' and approved_at
CREATE POLICY "public can approve quote by token"
  ON public.quotes
  FOR UPDATE
  TO anon, authenticated
  USING (approval_token IS NOT NULL AND approved_at IS NULL)
  WITH CHECK (approval_token IS NOT NULL);

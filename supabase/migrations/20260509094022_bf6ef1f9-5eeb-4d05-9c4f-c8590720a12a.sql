CREATE OR REPLACE FUNCTION public.sync_project_on_quote_akkoord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'akkoord' AND (OLD.status IS DISTINCT FROM 'akkoord') AND NEW.project_id IS NOT NULL THEN
    UPDATE public.projects
      SET status = 'akkoord'
      WHERE id = NEW.project_id
        AND status IN ('nieuw', 'offerte');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_on_quote_akkoord ON public.quotes;
CREATE TRIGGER trg_sync_project_on_quote_akkoord
  AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_on_quote_akkoord();

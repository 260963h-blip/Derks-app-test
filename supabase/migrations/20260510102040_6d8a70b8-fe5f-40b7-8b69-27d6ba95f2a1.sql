DROP TRIGGER IF EXISTS trg_sync_project_on_quote_akkoord ON public.quotes;
CREATE TRIGGER trg_sync_project_on_quote_akkoord
AFTER UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_on_quote_akkoord();
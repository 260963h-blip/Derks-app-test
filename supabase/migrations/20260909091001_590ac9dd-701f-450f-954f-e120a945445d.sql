-- 1. Remove the public quote access policies (approval now handled server-side)
DROP POLICY IF EXISTS "public can read quote by approval token" ON public.quotes;
DROP POLICY IF EXISTS "public can approve quote by token" ON public.quotes;

-- 2. Lock down SECURITY DEFINER functions + fix mutable search_path
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_project_on_quote_akkoord() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

-- 3. Storage: verify real ownership of the employee/project, not just the path prefix
DROP POLICY IF EXISTS "own emp files select" ON storage.objects;
DROP POLICY IF EXISTS "own emp files insert" ON storage.objects;
DROP POLICY IF EXISTS "own emp files update" ON storage.objects;
DROP POLICY IF EXISTS "own emp files delete" ON storage.objects;

CREATE POLICY "own emp files select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id::text = (storage.foldername(name))[2] AND e.user_id = auth.uid())
);
CREATE POLICY "own emp files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id::text = (storage.foldername(name))[2] AND e.user_id = auth.uid())
);
CREATE POLICY "own emp files update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id::text = (storage.foldername(name))[2] AND e.user_id = auth.uid())
);
CREATE POLICY "own emp files delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id::text = (storage.foldername(name))[2] AND e.user_id = auth.uid())
);

DROP POLICY IF EXISTS "own project docs select" ON storage.objects;
DROP POLICY IF EXISTS "own project docs insert" ON storage.objects;
DROP POLICY IF EXISTS "own project docs update" ON storage.objects;
DROP POLICY IF EXISTS "own project docs delete" ON storage.objects;

CREATE POLICY "own project docs select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid())
);
CREATE POLICY "own project docs insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid())
);
CREATE POLICY "own project docs update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid())
);
CREATE POLICY "own project docs delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid())
);
CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_seq int;
BEGIN
  UPDATE public.company_settings
     SET quote_number_next = GREATEST(COALESCE(quote_number_next, 1), 1) + 1
   WHERE user_id = auth.uid()
  RETURNING COALESCE(quote_number_year, EXTRACT(YEAR FROM now())::int),
            quote_number_next - 1
    INTO v_year, v_seq;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'Bedrijfsgegevens ontbreken';
  END IF;

  RETURN v_year::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cur_year int := EXTRACT(YEAR FROM now())::int;
  v_year int;
  v_seq int;
  v_prefix text;
BEGIN
  SELECT COALESCE(invoice_number_year, v_cur_year),
         GREATEST(COALESCE(invoice_number_next, 1), 1),
         COALESCE(invoice_number_prefix, 'F')
    INTO v_year, v_seq, v_prefix
    FROM public.company_settings
   WHERE user_id = auth.uid()
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bedrijfsgegevens ontbreken';
  END IF;

  IF v_year <> v_cur_year THEN
    v_year := v_cur_year;
    v_seq := 1;
  END IF;

  UPDATE public.company_settings
     SET invoice_number_year = v_year,
         invoice_number_next = v_seq + 1
   WHERE user_id = auth.uid();

  RETURN v_prefix || v_year::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_quote_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;
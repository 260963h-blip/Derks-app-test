UPDATE public.company_settings
SET quote_email_body = replace(
  quote_email_body,
  E'Met vriendelijke groet,\n{{company_name}}',
  E'Met vriendelijke groet,\nNick Derks\n{{company_name}}\nTel: 06-51780648'
)
WHERE quote_email_body LIKE '%Met vriendelijke groet,' || E'\n' || '{{company_name}}%';
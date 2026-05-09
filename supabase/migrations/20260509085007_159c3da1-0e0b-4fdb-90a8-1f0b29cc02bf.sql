ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS quote_email_subject text DEFAULT 'Offerte {{quote_number}} - {{company_name}}',
  ADD COLUMN IF NOT EXISTS quote_email_body text DEFAULT 'Beste {{contact_name}},

Hierbij ontvangt u onze offerte met nummer {{quote_number}}.
U kunt de offerte downloaden via onderstaande link.

Heeft u vragen? Neem gerust contact met ons op.

Met vriendelijke groet,
{{company_name}}';
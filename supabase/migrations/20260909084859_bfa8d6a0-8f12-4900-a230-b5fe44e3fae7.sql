create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'planning-sync-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://project--e4992d85-d4c7-4d9d-8b92-2b576b28432f.lovable.app/api/public/planning-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
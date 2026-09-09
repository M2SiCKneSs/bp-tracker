-- Hourly reminder tick. Run once, in the Supabase SQL editor, AFTER the
-- send-reminder function is deployed.
--
-- The job fires every hour; the function itself decides whether the current
-- hour matches the user's configured reminder time in their own timezone.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the service-role key in Vault rather than inlining it in the job body,
-- which would leave it readable in cron.job for anyone with DB access.
-- Run once, replacing the placeholder:
--   select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');

select cron.schedule(
  'bp-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://ezvzkrnsihxmnzwzvdfi.supabase.co/functions/v1/send-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Both header forms are sent so either key format authenticates: the
      -- legacy service_role key is a JWT the gateway validates via
      -- Authorization, while the newer sb_secret_... key is accepted as apikey.
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      ),
      'apikey', (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    )
  );
  $$
);

-- Useful afterwards:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('bp-reminders');

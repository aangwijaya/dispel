-- Schedules the market-read function and the retention sweep.
-- No secret or project URL lives in this file: the jobs read both from Vault at run time.
--
-- Human setup (README): enable pg_cron + pg_net, then create the Vault secrets
-- market_read_url and read_cron_secret, then run:
--   select public.schedule_market_reads();
-- The migration calls the same function, so a fresh project with everything already in place
-- schedules itself; otherwise it logs a notice and can be re-run any time.

create or replace function public.schedule_market_reads()
returns void
language plpgsql
security definer
set search_path = ''
as $do$
declare
  v_has_cron boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
  v_has_net boolean := exists (select 1 from pg_extension where extname = 'pg_net');
  v_has_vault boolean :=
    exists (select 1 from pg_extension where extname = 'supabase_vault')
    or exists (select 1 from pg_extension where extname = 'vault');
  v_has_url boolean := false;
  v_has_secret boolean := false;
begin
  if not (v_has_cron and v_has_net) then
    raise notice 'market-read schedules skipped: enable pg_cron and pg_net first';
    return;
  end if;

  if v_has_vault then
    select exists (select 1 from vault.decrypted_secrets where name = 'market_read_url') into v_has_url;
    select exists (select 1 from vault.decrypted_secrets where name = 'read_cron_secret') into v_has_secret;
  end if;

  if exists (select 1 from cron.job where jobname = 'market-read') then
    perform cron.unschedule('market-read');
  end if;

  if v_has_url and v_has_secret then
    perform cron.schedule(
      'market-read',
      '*/15 * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'market_read_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'read_cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000
        );
      $job$
    );
  else
    raise notice 'market-read schedule skipped: create the Vault secrets market_read_url and read_cron_secret';
  end if;

  if exists (select 1 from cron.job where jobname = 'market-reads-retention') then
    perform cron.unschedule('market-reads-retention');
  end if;

  perform cron.schedule(
    'market-reads-retention',
    '15 3 * * *',
    $job$
      delete from public.market_reads where created_at < now() - interval '14 days';
    $job$
  );
end
$do$;

revoke all on function public.schedule_market_reads() from public;
grant execute on function public.schedule_market_reads() to service_role;

select public.schedule_market_reads();

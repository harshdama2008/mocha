-- Nothing else settles a pending_capture cart once its correction window
-- closes: cartService.captureIfDue exists and is unit/replayer-tested, and
-- the capture-sweep Edge Function that calls it deploys fine, but nothing
-- was ever wired up to actually invoke it on a schedule. Live carts would
-- sit in pending_capture forever. pg_cron + pg_net fixes that by having
-- Postgres itself call the function every minute — capture-sweep is
-- deployed with verify_jwt = false (see supabase/config.toml) specifically
-- so this call needs no credentials.
--
-- The function URL is hardcoded to this project's ref
-- (kqrqhzeugwgtoizubmmq) rather than read from a setting — this is a
-- single-store deployment, not a portable template, and pg_cron has no
-- built-in way to read the project's own URL. Re-running
-- cron.schedule with the same job name replaces the existing job, so this
-- is safe to re-apply if the project is ever recreated under a new ref.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'mocha-capture-sweep',
  '* * * * *', -- every minute; correction window default is 10 minutes (src/config.ts)
  $$
  select net.http_post(
    url := 'https://kqrqhzeugwgtoizubmmq.supabase.co/functions/v1/capture-sweep',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

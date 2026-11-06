# telegram-alert

Edge Function (Deno) that sends one plain-text Telegram message when a user marks a figure or series as wanted (story V2-04). Only this function talks to Telegram, because the bot token is part of the API URL.

## How it works
1. A user marks something wanted. Trigger `marks_wanted_alert_*` (migration `20261106000000_v2_04_wanted_alerts.sql`) inserts a row in `public.wanted_alerts`. An existing unsent row (earlier Telegram failure) is retried; a sent row is not.
2. Only if a row was inserted or retried, the trigger calls this function through `pg_net` with header `x-alert-secret` and a body holding only `{user_id, kind, target_id}`.
3. The function compares the secret in constant time, validates the body and id shapes, claims the alert (`sent_at` null to now, so no double send), reads the profile, sends the message (8 s timeout). On Telegram failure the claim is cleared and the function answers 502; the next re-mark retries.
4. One alert per user and target, ever: rows survive unmarking. Above 20 alerts per user per hour the alert is dropped.

Message: `<display name or "user <8 chars of id>"> wants <figure|series> <id>` plus a link to `https://adisch79.github.io/lego-minifigures-sets/#series/<seriesId>` (figures link to the parent series). Never the email.

## Deploy order
1. Dashboard, Database, Extensions: enable `pg_net` and `supabase_vault`.
2. Set function secrets (never in git):

       npx supabase secrets set TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CHAT_ID=<chat id> ALERT_HOOK_SECRET=<long random string> --project-ref <ref>

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
3. Deploy the function. `config.toml` sets `verify_jwt = false` (the trigger has no user JWT; the shared secret is the gate):

       npx supabase functions deploy telegram-alert --project-ref <ref>

4. Vault secrets (SQL editor, once; `alert_hook_secret` has the same value as `ALERT_HOOK_SECRET`):

       select vault.create_secret('<same random string>', 'alert_hook_secret');
       select vault.create_secret('https://<ref>.supabase.co/functions/v1/telegram-alert', 'alert_hook_url');

5. Apply the migration:

       npx supabase db push --project-ref <ref>

6. Live checks (SQL editor):

       select * from pg_extension where extname in ('pg_net','supabase_vault');
       select has_function_privilege('authenticated','net.http_post(text,jsonb,jsonb,jsonb,integer)','execute'), has_schema_privilege('authenticated','net','usage');

   Both extensions must be listed. The second query must return false, false. If true, apply a revoke migration (the shipped migration already revokes `net` usage and execute from anon and authenticated; grants held through other roles need a follow-up).

## Telegram chat id
Create a bot with @BotFather (`/newbot`) to get the token. Send any message to the bot (or add it to the group), then open `https://api.telegram.org/bot<token>/getUpdates` and read `message.chat.id` (negative for groups). Keep the token out of shell history and git.

## Test
Unit tests of the pure logic and the trigger/dedupe tests run without network:

    cd supabase
    npm test

Live check (after deploy and secrets, owner step): mark a figure wanted as a test user; one message should arrive within a minute. Mark it again, unmark and re-mark: no second message.
A missing or wrong secret returns 401; a bad body returns 400; a failed claim or clear returns 500. Ids are checked by format only (the catalog is static JSON, not in the database).

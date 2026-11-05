# telegram-alert

Edge Function (Deno) that sends one plain-text Telegram message when a user marks a figure or series as wanted (story V2-04). Only this function talks to Telegram, because the bot token is part of the API URL.

## How it works
1. A user marks something wanted. Trigger `marks_wanted_alert_*` (migration `20261106000000_v2_04_wanted_alerts.sql`) inserts a row in `public.wanted_alerts` with `on conflict do nothing`.
2. Only if a row was inserted, the trigger calls this function through `pg_net` with header `x-alert-secret` and a body holding only `{user_id, kind, target_id}`.
3. The function compares the secret in constant time, validates the body and id shapes, re-reads the alert and profile with the service role, sends the message, then sets `sent_at`.
4. One alert per user and target, ever: rows survive unmarking. Above 20 alerts per user per hour the alert is dropped. If Telegram fails there is no retry (the row stays with `sent_at` null).

Message: `<display name or "user <8 chars of id>"> wants <figure|series> <id>` plus a link to `https://adisch79.github.io/lego-minifigures-sets/#series/<seriesId>` (figures link to the parent series). Never the email.

## Secrets
Function secrets (never in git):

    npx supabase secrets set TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CHAT_ID=<chat id> ALERT_HOOK_SECRET=<long random string> --project-ref <ref>

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

Vault secrets (SQL editor, once, same random string as `ALERT_HOOK_SECRET`):

    select vault.create_secret('<same random string>', 'alert_hook_secret');
    select vault.create_secret('https://<ref>.supabase.co/functions/v1/telegram-alert', 'alert_hook_url');

Also enable the `pg_net` and `supabase_vault` extensions (dashboard, Database, Extensions) before applying the migration.

## Deploy
`config.toml` sets `verify_jwt = false` for this function (the trigger has no user JWT; the shared secret is the gate).

    npx supabase functions deploy telegram-alert --project-ref <ref>

## Test
Unit tests of the pure logic and the trigger/dedupe tests run without network:

    cd supabase
    npm test

Live check (after deploy and secrets, owner step): mark a figure wanted as a test user; one message should arrive within a minute. Mark it again, unmark and re-mark: no second message.
A missing or wrong secret returns 401; a bad body returns 400.

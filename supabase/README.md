# supabase/

Database layer for V2-01 (see `docs/design/V2-01-schema.md`): tables `allowlist`, `admins`, `profiles`, `marks`, grants, row level security, constraints and triggers.

## Contents
- `migrations/20261102000000_v2_01_schema.sql` - the migration. Contains no emails, admin ids or secrets.
- `config.toml` - records the intended auth settings (signups off, email only). Live settings are not changed by this file; the live smoke test in the design doc checks them. `supabase config push` is not part of the process: it would apply this file and defaults for anything unset.
- `tests/stub.sql` - TEST FIXTURE ONLY. Fakes the parts Supabase provides (`auth` schema, `auth.users`, `auth.uid()`, roles). Never apply it to a real project.
- `tests/schema.test.js` - runs stub + migration in PGlite (in-process Postgres, no Docker) and checks the access rules.

## Install (tests)
Needs Node 20+.

    cd supabase
    npm ci

## Run the tests

    cd supabase
    npm test

## Apply to a project
Not done by this folder's tooling. Applying to the live project is a separate, owner-approved step.
The owner's admin row is added by one-off SQL, never in a migration.

## Alerts paused (V2-08)
Owner paused Telegram alerts on wanted marks on 2026-11-08. Migration `migrations/20261108000000_v2_08_pause_wanted_alerts.sql` drops the two triggers only. Functions, table, edge function `telegram-alert`, Vault entries and secrets stay. Paste this in the Supabase SQL Editor (no `supabase db push`):

    drop trigger if exists marks_wanted_alert_insert on public.marks;
    drop trigger if exists marks_wanted_alert_update on public.marks;

To re-enable, run the two `create trigger` statements in the header comment of that file.

## Auth emails (V2-16)
Branded templates live in `templates/magic_link.html` and `templates/confirmation.html`. Links use `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email` (the app verifies the token itself); the 6-digit `{{ .Token }}` is shown too. Not applied by this folder's tooling. Paste in the Supabase Dashboard > Authentication > Email Templates:

- Magic link: subject `Your Minifig Hunt sign-in link`, body = `templates/magic_link.html`.
- Confirm signup: subject `Confirm your Minifig Hunt account`, body = `templates/confirmation.html`.

`config.toml` has the same entries for local dev. Site URL must be `https://minifighunt.com/` (trailing slash). A custom sender name or domain needs custom SMTP (owner step); the default Supabase sender stays until then. Figure images are PNG copies (240 px wide, `site/email/`, served at `https://minifighunt.com/email/...`) because desktop Outlook does not show webp.

Links use `{{ .SiteURL }}`, so mails sent from a preview or localhost app still point to production. Accepted. The link opens a "Continue sign-in" button; verification runs only on that click (login CSRF, mail scanners that open links).

## Not covered yet
Admin RPCs (V2-05), alerts (V2-04) and the private-function checks that depend on them. Auth settings (signups off) live outside migrations and need a live smoke test. PGlite has one connection, so the cap's advisory lock is not tested under real concurrency.

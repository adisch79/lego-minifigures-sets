# admin-people

Edge Function (Deno) that adds or removes an invited person (story V2-05). Needs the service role (Auth admin API), so it cannot run in the browser. Design: `docs/design/V2-05-admin.md`, rules from `docs/design/V2-01-schema.md` ("Adding a person", "Removing a person").

## How it works
- `POST` with the signed-in user's JWT and body `{"action": "add" | "remove", "email": "<address>"}` (JSON, at most 1 KB).
- `verify_jwt = true` (`config.toml`). The function also validates the token with `auth.getUser`, then checks `public.admins` live (403 `not_admin`).
- `add`: inserts the allowlist row, then creates the account (`email_confirm: true`). A create failure other than "already registered" removes the allowlist row again.
- `remove`: refuses admins and the caller (`is_admin`), hard-deletes the account (profile, marks and alerts cascade), then deletes the allowlist row. The person's marks are lost.
- CORS: only the exact origin `https://minifighunt.com` (`ALLOWED_ORIGINS`). ACAO echoes the caller with `Vary: Origin`; other origin 403, other method 405.
- Answers `{"ok": true}` or `{"error": "<code>"}`: `unauthorized` (401), `not_admin` (403), `bad_request` and `bad_email` (400), `is_admin` (409), `internal` (500). Logs never hold emails or tokens.

## Deploy (owner steps)
1. SQL Editor: paste `supabase/migrations/20261107000000_v2_05_admin.sql` and run it. Never `db push`.
2. Deploy (without `--no-verify-jwt`):

       npx --yes supabase functions deploy admin-people --remote=iagnfgedasxkqqjbsoeg --yes

   (`--project-ref` is deprecated; `--yes` is required in agent/`!` mode. Verified 2026-11-07.)

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform; no extra secrets.

## Use
The admin page (`#admin`) calls it. Manual check with an admin's access token (keep it out of shell history and git):

    curl -X POST https://iagnfgedasxkqqjbsoeg.supabase.co/functions/v1/admin-people \
      -H "Origin: https://minifighunt.com" -H "Authorization: Bearer <admin access token>" \
      -H "Content-Type: application/json" -d '{"action":"add","email":"person@example.com"}'

## Test
    cd supabase
    npm test

`logic.ts` is unit-tested with injected dependencies. `index.ts` (Deno wiring) is covered by the live smoke only: a removed user cannot sign in; a re-added user can.

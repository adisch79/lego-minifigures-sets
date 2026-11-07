# V2-05 Admin page (rev 2, after design review 2026-11-06)

Direction C, owner pick 2026-11-06: wanted wall plus allowlist slide-over. Mockup `mockups/V2-05/c.html`.
Builds on `docs/design/V2-01-schema.md` ("Functions": admin RPCs and Edge Function contract).

## Route and gate
- Hash route `#admin`. The page renders only when the signed-in user is an admin; otherwise it shows "Not available" and makes no admin calls.
- The client learns admin status from RPC `public.is_admin()` (returns boolean for `auth.uid()`, false with no session). The UI gate is cosmetic; every RPC and the Edge Function check `admins` again on the server.
- The account popover shows an "Admin" link only for admins.

## Reads: two SQL RPCs (one migration)
Both `security definer`, `set search_path = ''`, `stable`, in `public` (PostgREST exposes only `public`), take no arguments, raise `42501` unless `(select auth.uid())` is in `public.admins`. `revoke execute from public, anon, authenticated`, then `grant execute to authenticated`. `is_admin()` gets the same grants, so anon gets `42501` (the client calls it only with a session).
- `admin_allowlist_list()` returns `(email, added_at, user_id, display_name, signed_in_at, is_admin, last_mark_at)`: allowlist left-joined to `auth.users` on lower(email), `profiles.created_at` as `signed_in_at`, `max(marks.updated_at)` as `last_mark_at`. Users not on the allowlist (removed, banned) are not listed.
- `admin_wanted_list()` returns `(user_id, label, kind, target_id, marked_at, alert, truncated)`: `marks` rows with `state = 'wanted'` of users whose email is on the allowlist, `order by updated_at desc limit 5000`; `truncated` is true on every row when more exist. `label` is non-blank `display_name`, else email. `alert` is `sent` (alert row with `sent_at`), `unsent` (row, `sent_at` null: pending or failed), `none` (no row: dropped over the hourly cap or before V2-04). SOURCE for 5000: docs/design/V2-01-schema.md, 2000 marks per user cap; covers the invited group with headroom.
- `admin_user_lookup(p_email text)` returns `(user_id, is_admin)` for the `auth.users` row with that lower-cased email. Granted to `service_role` only; used by the Edge Function, because supabase-js has no get-user-by-email call and PostgREST does not expose `auth`.
- Figure and series names come from `catalog.json` on the client, not the database.

## Writes: Edge Function `admin-people`
Adding and removing need the service role (Auth admin API), so they run in an Edge Function, as V2-01 decided.
- `POST {action: "add" | "remove", email}` with the user's JWT. `verify_jwt = true` in `supabase/config.toml` (`[functions.admin-people]`); deploy without `--no-verify-jwt`.
- Validates the token with `auth.getUser(jwt)` (401 when missing or invalid), then checks `admins` live with the service client (403 `not_admin`).
- Email: trim, lower-case, max 254 chars, one `@`, no whitespace or control chars. Body must be JSON, at most 1 KB.
- `add`, as V2-01 "Adding a person": insert the allowlist row (`on conflict do nothing`), then `auth.admin.createUser({ email, email_confirm: true })`; if creation fails for any reason other than "already registered", delete the allowlist row and return `internal`.
- `remove`, as V2-01 "Removing a person": look up the user with `admin_user_lookup`; refuse with `is_admin` if the target is an admin (covers self and last admin); `auth.admin.deleteUser(user_id)` (hard delete, cascades profile, marks, alerts, so a still-valid token can no longer write); then delete the allowlist row. Marks are lost; the UI says so in the confirm. With one admin, two admins removing each other cannot race; re-check if a second admin is added.
- CORS: exact origin `https://adisch79.github.io`, `Access-Control-Allow-Headers: authorization, apikey, content-type, x-client-info`, `Vary: Origin`. Other origin 403, other method 405.
- Responses: `{ok: true}` or `{error: "<code>"}` with codes `unauthorized`, `not_admin`, `bad_request`, `bad_email`, `is_admin`, `internal`. Never logs emails or tokens.

## UI (senior-frontend-dev, direction C)
- Wanted wall: grid of wanted targets ranked by number of collectors, card art from `cards/` (series) or `img/` (figures), collector avatars, alert status dot. Filters: Most wanted, Newest, Not sent.
- Allowlist slide-over: add field, list with signed-in state and admin tag, remove with an inline confirm that says the collector's marks are deleted (no `window.confirm`).
- Truncated wanted list shows a notice.
- Loading, empty and error states; works at 390 px.

## Tests
- PGlite: `is_admin` true/false, anon refused; both list RPCs refused for anon and a non-admin (`42501`); correct rows for an admin; label fallback; alert states `sent`/`unsent`/`none`; users not on the allowlist hidden; order and `truncated`; `admin_user_lookup` refused for `authenticated`; catalog audit lists exactly the new functions executable by `authenticated` (`is_admin`, `admin_allowlist_list`, `admin_wanted_list`).
- Edge Function logic in a pure module with unit tests, like `telegram-alert/logic.ts`: origin and method refusal, missing/invalid JWT 401, non-admin 403, bad email, removing an admin or self refused, createUser failure rolls back the allowlist row, "already registered" keeps it, remove then re-add, no email or token in log output.
- Vitest for route, gate, ranking and filters.
- Live smoke before release: a removed user cannot sign in; a re-added user can.

## Shared origin (V2-01 "Known limits") - OWNER DECISION PENDING
V2-01 makes a custom subdomain a precondition for V2-05. Fact, 2026-11-06: of the owner's repos only `lego-minifigures-sets` publishes GitHub Pages (`gh api repos/adisch79/<repo>/pages` for every repo). Impact of a stolen admin session: it can read every invited email and every collector's marks, and invite or delete collectors. Options: accept the shared origin with a CI check that fails when another repo of the owner enables Pages; or move the app to a free own-origin host (Cloudflare Pages `*.pages.dev`); or a paid custom domain. Release waits for the owner's entry in decisions.md; the build does not.

## Deploy (owner steps, after merge)
1. SQL Editor: paste the V2-05 migration (never `db push`).
2. `npx supabase functions deploy admin-people --project-ref iagnfgedasxkqqjbsoeg`.

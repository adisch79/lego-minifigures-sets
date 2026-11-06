# V2-05 Admin page (rev 1, before design review)

Direction C, owner pick 2026-11-06: wanted wall plus allowlist slide-over. Mockup `mockups/V2-05/c.html`.
Builds on `docs/design/V2-01-schema.md` ("Functions": admin RPCs and Edge Function contract).

## Route and gate
- Hash route `#admin`. The page renders only when the signed-in user is an admin; otherwise it shows "Not available" and makes no admin calls.
- The client learns admin status from RPC `public.is_admin()` (returns boolean for `auth.uid()`, false with no session). The UI gate is cosmetic; every RPC and the Edge Function check `admins` again on the server.
- The account popover shows an "Admin" link only for admins.

## Reads: two SQL RPCs (one migration)
Both `security definer`, `set search_path = ''`, `stable`, in `public` (PostgREST exposes only `public`), take no arguments, raise `42501` unless `auth.uid()` is in `public.admins`. `revoke execute from public, anon`; `grant execute to authenticated`.
- `admin_allowlist_list()` returns `(email, added_at, user_id, display_name, signed_in_at, is_admin, last_mark_at)`: allowlist left-joined to `auth.users` on lower(email), `profiles.created_at` as `signed_in_at`, `max(marks.updated_at)` as `last_mark_at`. Users not on the allowlist (removed, banned) are not listed.
- `admin_wanted_list()` returns `(user_id, label, kind, target_id, marked_at, alert)`: every `marks` row with `state = 'wanted'`; `label` is non-blank `display_name`, else email; `alert` is `sent` (alert row with `sent_at`), `queued` (row, no `sent_at`), `none` (no row). Capped at 5000 rows (SOURCE: docs/design/V2-01-schema.md, 2000 marks per user cap; 5000 covers the invited group with headroom).
- Figure and series names come from `catalog.json` on the client, not the database.

## Writes: Edge Function `admin-people`
Adding and removing need the service role (Auth admin API), so they run in an Edge Function, as V2-01 decided.
- `POST {action: "add" | "remove", email}` with the user's JWT. `verify_jwt = true`.
- Validates the token with `auth.getUser(jwt)`, then checks `admins` live with the service client.
- Email: trim, lower-case, max 254 chars, one `@`, no whitespace or control chars.
- `add`: insert into `allowlist` (`on conflict do nothing`). If an auth user with that email exists and is banned, lift the ban (`ban_duration: "none"`).
- `remove`: refuse if the email belongs to an admin (covers "last admin" and self-removal). Delete the allowlist row. If an auth user exists, ban it (`ban_duration: "876000h"`) and sign it out (`auth.admin.signOut` is per JWT, so ban plus refresh failure is the sign-out; access tokens live up to their expiry, default 1 h). Marks are kept, so re-adding restores the collector with their data.
- CORS: exact origin `https://adisch79.github.io`, methods POST and OPTIONS.
- Responses: `{ok: true}` or `{error: "<code>"}` with codes `not_admin`, `bad_email`, `is_admin`, `internal`. Never logs emails or tokens.

## UI (senior-frontend-dev, direction C)
- Wanted wall: grid of wanted targets ranked by number of collectors, card art from `cards/` (series) or `img/` (figures), collector avatars, alert status dot. Filters: Most wanted, Newest, Not sent.
- Allowlist slide-over: add field, list with signed-in state and admin tag, remove with an inline confirm (no `window.confirm`).
- Loading, empty and error states; works at 390 px.

## Tests
- PGlite: `is_admin` true/false/anon; both RPCs refused for anon and a non-admin (`42501`), correct rows for an admin, label fallback, alert states, removed users hidden; catalog audit still passes (update its list of functions executable by `authenticated`).
- Edge Function logic in a pure module with unit tests (email validation, action rules, admin refusal) like `telegram-alert/logic.ts`.
- Vitest for route, gate and filter/ranking logic.

## Shared origin (V2-01 "Known limits")
V2-01 named a custom subdomain as a precondition for V2-05. Checked 2026-11-06: of the owner's repos only `lego-minifigures-sets` publishes GitHub Pages (`gh api repos/adisch79/<repo>/pages` for every repo), so no other page shares the origin today. Default: proceed without a custom domain; a domain costs money and is the owner's call. Re-check before any other repo enables Pages. Impact of a stolen admin token: it can invite or ban collectors, it cannot read Telegram secrets or the service key.

## Deploy (owner steps, after merge)
1. SQL Editor: paste the V2-05 migration (never `db push`).
2. `npx supabase functions deploy admin-people --project-ref iagnfgedasxkqqjbsoeg`.

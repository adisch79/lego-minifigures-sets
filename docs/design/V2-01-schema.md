# V2-01 Supabase schema (rev 2, after design and security review)

Goal: invited users store owned/wanted marks; each user reaches only their own rows. The repo is public: no emails, admin ids or secrets in migrations or seeds.

## Access model: invite only, signups off
- Auth settings: `enable_signup = false` globally, email provider on, anonymous, phone and OAuth off. An unlisted address cannot create an account by any route, so no sign-up hook is needed.
- Client signs in with `signInWithOtp({ shouldCreateUser: false })`, `flowType: 'pkce'`. Site URL and redirect allowlist are the exact Pages URL. Trade-off: the link must open in the browser that asked for it.
- Accounts are created only through the admin invite API: dashboard now, V2-05 Edge Function later.
- Removing a person deletes their `auth.users` row, which cascades, so a still-valid token can no longer write.
- Auth settings live outside migrations, so a live smoke test is part of acceptance: unknown-address OTP, password signup and anonymous sign-in are all refused, and an invited address signs in. Invites with signups off are reported to work but not officially documented, so this test decides. SOURCE: https://github.com/supabase/supabase/issues/40582 (use the global flag, not the email-provider flag, which breaks invites).

## Email
Built-in mail reaches project team members only, 2 messages per hour. SOURCE: https://supabase.com/docs/guides/auth/auth-smtp
- MVP 2 demo works with the owner's own address on built-in mail.
- Anyone else needs custom SMTP (V2-02). That needs an SMTP account and key from the owner.

## Tables (all in `public`, RLS on)
- `allowlist`: `email` primary key, `check (email = lower(email))`, `added_at`. Record of invited addresses. No client grants.
- `admins`: `user_id` primary key, references `auth.users` on delete cascade. No client grants. Separate from `profiles` so a grant mistake there cannot create an admin. Owner's row is added by one-off SQL, never in a migration.
- `profiles`: `user_id` primary key, references `auth.users` on delete cascade; `display_name` with `check (char_length(display_name) <= 50)`; `created_at`. Row created by a `security definer` trigger after insert on `auth.users`; takes nothing from `raw_user_meta_data`.
- `marks`: `user_id` references `auth.users` on delete cascade; `kind`; `target_id`; `state`; `updated_at` default `now()`, set by a before-update trigger. Primary key `(user_id, kind, target_id)`.
  - `check (kind in ('figure','series'))`, `check (state in ('owned','wanted'))`
  - `check ((kind = 'series' and target_id ~ '^\d{4,6}$') or (kind = 'figure' and target_id ~ '^\d{4,6}-\d+$'))`. A test runs this over every id in `catalog.json` (839 today, all match).
  - Per-user row cap by trigger: 2000. SOURCE: about twice the 839 catalog ids, so normal use never reaches it.

`target_id` holds permanent catalog ids (V1-02). No foreign key, since the catalog is a static file. This is the backlog's "figure_id or series_id".

## Grants and policies
Explicit, never relying on defaults (Supabase default exposure changed in 2026. SOURCE: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
```sql
revoke all on public.allowlist, public.admins, public.profiles, public.marks from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.marks to authenticated;
grant update (state) on public.marks to authenticated;
```
- `marks`: policies `to authenticated`, `(select auth.uid()) = user_id`; insert uses `with check`, update uses `using` and `with check`.
- `profiles`: select and update own row only.
- `allowlist`, `admins`: RLS on, no policies.
- None of these tables join the realtime publication.

## Functions
- All definer functions: `set search_path = ''`, schema-qualified names, `revoke execute from public, anon, authenticated`, then grant back only what is needed.
- Internal helpers and triggers live in a non-exposed `private` schema.
- Admin RPCs (signatures now, built in V2-05): `admin_allowlist_list`, `admin_wanted_list`. They take no user id and raise unless `auth.uid()` is in `admins`. `admin_wanted_list` names people by `display_name`, else email.
- Invite and removal need the service role, so they are Edge Functions that check the caller is an admin (V2-05).
- Any view uses `security_invoker = true`.

## Contract for V2-04 (not built in V2-01)
- One alert per user and target, ever: `wanted_alerts(user_id, kind, target_id, sent_at)`, primary key on the first three, no client grants. Insert with `on conflict do nothing`; notify only when a row was inserted. Rows survive unmarking, so wanted -> owned -> wanted and delete then re-add send nothing. Per-user hourly cap.
- Trigger calls the Edge Function with a shared secret from Vault; constant-time compare; body holds only the alert key. Function re-reads data, checks the id against the catalog, sends plain text with no `parse_mode`. Only the function calls Telegram, because the token is part of the URL. Figure links go to the parent series page.

## Series marks
Stored separately from figure marks; expanding them would send one alert per figure. Progress counts figure marks only; a series mark is its own badge. Changing this later means a data migration.

## Known limits
- Free projects pause after low activity over 7 days, which stops sign-in and alerts until restored. SOURCE: https://supabase.com/docs/guides/platform/free-project-pausing
- Session sits in `localStorage` on the shared origin `adisch79.github.io`, so any other Pages project of the owner can read it. Fix if needed: custom subdomain. Add a CSP meta tag in V2-02.
- Service-role key never gets a `VITE_` name.

## Migrations and tests
`supabase/migrations/`. Tests prove:
- `anon` gets nothing on all tables; `authenticated` gets nothing on `allowlist` and `admins`.
- `marks`: user A cannot select, insert, update or delete B's rows, or move a row to B.
- `profiles`: `display_name` updates; no other column is writable; another profile is unreadable; row created on user insert.
- `admins`: a user cannot add themselves.
- Constraints refuse bad `kind`, `state`, id shape, kind/id mismatch; cap holds; every catalog id passes.
- Cascade removes profile and marks; non-admin RPC refused; private functions not callable.

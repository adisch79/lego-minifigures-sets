# V2-01 Supabase schema (rev 3, after design review and two security reviews)

Goal: invited users store owned/wanted marks; each user reaches only their own rows. The repo is public: no emails, admin ids or secrets in migrations or seeds.

## Access model: invite only, signups off, allowlist enforced
- Auth settings: `enable_signup = false` globally, email provider on, anonymous, phone, OAuth, Web3 and SSO off, secure email change and secure password change on. Committed in `supabase/config.toml` as the record of intended settings.
- Backstop: a `before insert` trigger on `auth.users` raises unless `lower(new.email)` is in `allowlist`, so a null email also fails. If the signup flag is ever switched on, nobody unlisted gets in.
- Client signs in with `signInWithOtp({ shouldCreateUser: false })`, `flowType: 'pkce'`, and also offers code entry through `verifyOtp({ type: 'email' })`, because a mail app's browser may not be the one that asked. Site URL and redirect allowlist are the exact Pages URL. UI shows the same message for listed and unlisted addresses.
- Accounts are created already confirmed, not by invite link: `auth.admin.createUser({ email, email_confirm: true })`, or dashboard Add user with auto-confirm. Invite links are avoided because an unconfirmed user cannot use OTP with signups off, and the invite callback does not fit PKCE. SOURCE: supabase/auth `magic_link.go`, `signup.go`, `invite.go`, `admin.go`, read 2026-11-02. The owner tells the person by their own channel.
- Adding a person, in order: insert allowlist row, create user, delete the row if creation fails. First admin, in order: allowlist row, create user, `admins` row, by one-off SQL.
- Removing a person: delete the `auth.users` row by `user_id`, which cascades so a still-valid token can no longer write, then delete the allowlist row. Lists show the current `auth.users.email`.
- Self-service email change is blocked by a `before update` trigger on `auth.users` raising when `email_change` is set.
- Auth settings live outside migrations, so a live smoke test is part of acceptance: unknown-address OTP, password signup, anonymous sign-in and `updateUser({ email })` are all refused, and a newly created address signs in by OTP with no prior link. Rerun before each release. SOURCE: https://github.com/supabase/supabase/issues/40582 (use the global flag, not the email-provider flag).

## Email
Built-in mail reaches project team members only, 2 messages per hour. SOURCE: https://supabase.com/docs/guides/auth/auth-smtp
- MVP 2 demo works with the owner's own address on built-in mail.
- Anyone else needs custom SMTP (V2-02). That needs an SMTP account and key from the owner.

## Tables (all in `public`, RLS on)
- `allowlist`: `email` primary key, `check (email = lower(email))`, `added_at`. The gate for account creation. No client grants.
- `admins`: `user_id` primary key, references `auth.users` on delete cascade. No client grants. Separate from `profiles` so a grant mistake there cannot create an admin. Owner's row is added by one-off SQL, never in a migration.
- `profiles`: `user_id` primary key, references `auth.users` on delete cascade; `display_name` with `check (char_length(display_name) <= 50)`; `created_at`. Row created by a `security definer` trigger after insert on `auth.users`; takes nothing from `raw_user_meta_data`.
- `marks`: `user_id` references `auth.users` on delete cascade; `kind`; `target_id`; `state`; `updated_at` default `now()`, set by a before insert or update trigger, so clients cannot choose it. Primary key `(user_id, kind, target_id)`.
  - `check (kind in ('figure','series'))`, `check (state in ('owned','wanted'))`
  - `check ((kind = 'series' and target_id ~ '^[0-9]{4,6}$') or (kind = 'figure' and target_id ~ '^[0-9]{4,6}-[0-9]{1,4}$'))`. A test runs this over every id in `catalog.json` (839 today, all match).
  - Per-user row cap by trigger: 2000. SOURCE: about twice the 839 catalog ids, so normal use never reaches it. Takes a per-user advisory lock, so concurrent inserts cannot pass it.

`target_id` holds permanent catalog ids (V1-02). No foreign key, since the catalog is a static file. This is the backlog's "figure_id or series_id".

## Grants and policies
Explicit, never relying on defaults (Supabase default exposure changed in 2026. SOURCE: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
```sql
revoke all on public.allowlist, public.admins, public.profiles, public.marks from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.marks to authenticated;
grant update (state) on public.marks to authenticated;
grant select, insert, update, delete on public.allowlist, public.admins, public.profiles, public.marks to service_role;
```
V2-03 cannot use a plain upsert with `update (state)`: it inserts with `ignoreDuplicates`, then updates.
- `marks`: policies `to authenticated`, `(select auth.uid()) = user_id`; insert uses `with check`, update uses `using` and `with check`.
- `profiles`: select and update own row only.
- `allowlist`, `admins`: RLS on, no policies.
- None of these tables join the realtime publication.

## Functions
- All definer functions: `set search_path = ''`, schema-qualified names, `revoke execute from public, anon, authenticated`, then grant back only what is needed.
- Internal helpers and triggers live in a non-exposed `private` schema.
- Admin RPCs (built in V2-05): `admin_allowlist_list`, `admin_wanted_list`. They take no user id and raise unless `auth.uid()` is in `admins`. `admin_wanted_list` names people by non-blank `display_name`, else email.
- Adding and removing people needs the service role, so these are Edge Functions (V2-05): validate the token with `auth.getUser`, check `admins` live, trim and lower-case the email, exact-origin CORS, refuse removing the last admin, never log emails or tokens.
- Any view uses `security_invoker = true`.

## Contract for V2-04 (not built in V2-01)
- One alert per user and target, ever: `wanted_alerts(user_id, kind, target_id, sent_at)`, primary key on the first three, no client grants. Insert with `on conflict do nothing`; notify only when a row was inserted. Rows survive unmarking, so wanted -> owned -> wanted and delete then re-add send nothing. Per-user hourly cap.
- Trigger fires on insert, and on update of `state`, when the new state is `wanted`. `wanted_alerts.user_id` cascades on user delete. Message names the person by `display_name`, else a short id, never the email. Above the hourly cap the alert is dropped.
- Trigger calls the Edge Function with a shared secret from Vault; constant-time compare; body holds only the alert key. Function re-reads data, checks the id against the catalog, sends plain text with no `parse_mode`. Only the function calls Telegram, because the token is part of the URL. Figure links go to the parent series page.

## Series marks
Stored separately from figure marks; expanding them would send one alert per figure. Progress counts figure marks only; a series mark is its own badge. Changing this later means a data migration.

## Known limits
- Free projects pause after low activity over 7 days, which stops sign-in and alerts until restored. SOURCE: https://supabase.com/docs/guides/platform/free-project-pausing
- Session sits in `localStorage` on the shared origin `adisch79.github.io`, so any other Pages project of the owner can read it. Custom subdomain is a precondition for V2-05, since an admin session can add accounts. Add a CSP meta tag in V2-02.
- `signInWithOtp` differs for listed and unlisted addresses, so the anon key can test who is invited, and can spend the mail quota. Accepted for a small private app; set auth rate limits, add CAPTCHA if abused.
- Service-role key never gets a `VITE_` name.

## Migrations and tests
`supabase/migrations/`. Tests prove:
- `anon` gets nothing on all tables; `authenticated` gets nothing on `allowlist` and `admins`.
- `marks`: user A cannot select, insert, update or delete B's rows, or move a row to B.
- `profiles`: `display_name` updates; no other column is writable; another profile is unreadable; row created on user insert.
- `admins`: a user cannot add themselves.
- Constraints refuse bad `kind`, `state`, id shape, kind/id mismatch; cap holds; every catalog id passes.
- Cascade removes profile and marks; private functions not callable; non-admin RPC refused (V2-05).
- `auth.users` insert refused for unlisted, mixed-case listed accepted, null email refused; setting `email_change` refused.
- `service_role` reaches all four tables; client cannot choose `updated_at`.
- Catalog audit: every `security definer` function has `search_path=''`, every `public` table has RLS on, nothing but the named functions is executable by `authenticated`.

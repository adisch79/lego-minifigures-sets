# V2-01 Supabase schema (draft, awaiting design and security review)

Goal: invited users store owned/wanted marks; each user reaches only their own rows.

## Tables
- `allowlist`: `email` (primary key, stored lower-case), `added_at`. No client access. Owner edits it through V2-05 or the dashboard.
- `profiles`: `user_id` (primary key, references `auth.users`, cascade delete), `display_name`, `is_admin` (default false), `created_at`.
- `marks`: `user_id` (references `auth.users`, cascade delete), `kind` (`figure` | `series`), `target_id` (text), `state` (`owned` | `wanted`), `updated_at`. Primary key `(user_id, kind, target_id)`, so one state per target and repeat clicks cannot create rows.

`target_id` holds catalog ids (decided permanent keys, V1-02). The catalog is a static file, so the database has no foreign key to it; the app ignores marks with unknown ids.

## Row-level security
RLS on for all three tables.
- `marks`: select, insert, update, delete only where `user_id = auth.uid()`.
- `profiles`: select and update own row only. `is_admin` must not be writable by the client: revoke column update, grant update on `display_name` only.
- `allowlist`: no policies, so clients get nothing.
- Admin reads for V2-05 go through a `security definer` function that checks `is_admin`, not through a broad policy.

## Allowlist enforcement
Enforced on the server when an account is created, never in the client. Default: Supabase before-user-created auth hook checking `allowlist`. UNKNOWN until checked against current Supabase docs at implementation; fallback is a trigger on `auth.users`.

## Open points for review
- Does a series mark also mark its figures? Default: no, stored separately, UI computes progress. V2-03 can revisit.
- Telegram (V2-04) needs "first time wanted" so repeat clicks do not re-send: trigger fires only when `state` changes to `wanted`.

## Migrations
`supabase/migrations/`, plus an RLS test that proves user A cannot read or write user B's marks.

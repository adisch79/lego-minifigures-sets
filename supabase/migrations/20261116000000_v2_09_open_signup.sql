-- V2-09 open sign-up, part 1 (database). Design: docs/design/V2-09-open-signup.md.
-- Drops the allowlist gate on auth.users so any address can sign up; adds admin_people_list()
-- (all users, no allowlist needed) and rewrites admin_wanted_list without the allowlist join.
-- Kept on purpose: private.enforce_allowlist(), public.allowlist, block_email_change trigger,
-- public.admin_allowlist_list() (the app no longer calls it since part 2 shipped; kept only for rollback).
-- Apply by pasting into the SQL Editor (never db push). Contains no emails, ids or secrets.
--
-- WARNING: Telegram alerts need a global cap before they are re-enabled (see the re-enable block
-- in 20261108000000_v2_08_pause_wanted_alerts.sql). With open sign-up any stranger could trigger
-- up to 20 messages per hour each.
--
-- Rollback (run in this order; the first statement backfills the allowlist so existing users
-- survive the gate coming back):
--
--   insert into public.allowlist select lower(email) from auth.users on conflict do nothing;
--
--   create trigger enforce_allowlist_on_insert
--     before insert on auth.users
--     for each row execute function private.enforce_allowlist();
--
--   create trigger enforce_allowlist_on_email_update
--     before update of email on auth.users
--     for each row when (new.email is distinct from old.email)
--     execute function private.enforce_allowlist();
--
-- Then in the app set `shouldCreateUser: false` (app/src/auth.ts) and turn the Supabase Auth
-- "Allow new users to sign up" flag off. admin_people_list can stay; the allowlist-joined
-- admin_wanted_list is in 20261107000000_v2_05_admin.sql.

drop trigger if exists enforce_allowlist_on_insert on auth.users;
drop trigger if exists enforce_allowlist_on_email_update on auth.users;

-- All people with an account, newest sign-up first (auth.users.created_at; a profile row may be missing).
-- Capped at 5000 rows like admin_wanted_list, no truncated flag.
create function public.admin_people_list()
returns table (
  user_id uuid, email text, display_name text, signed_up_at timestamptz,
  is_admin boolean, last_mark_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.display_name, u.created_at,
           (ad.user_id is not null),
           (select max(m.updated_at) from public.marks m where m.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.admins ad on ad.user_id = u.id
    order by u.created_at desc, u.email
    limit 5000;
end;
$$;

-- Wanted marks of all users, newest first. truncated is true on every row when more than the
-- limit exist.
create or replace function public.admin_wanted_list()
returns table (
  user_id uuid, label text, kind text, target_id text,
  marked_at timestamptz, alert text, truncated boolean
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  -- SOURCE: carried over from 20261107000000_v2_05_admin.sql (docs/design/V2-05-admin.md).
  row_limit constant int := 5000;
begin
  if not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query
    with rows as (
      select m.user_id, coalesce(nullif(btrim(p.display_name), ''), u.email) as label,
             m.kind, m.target_id, m.updated_at as marked_at,
             case when w.user_id is null then 'none'
                  when w.sent_at is not null then 'sent'
                  else 'unsent' end as alert
      from public.marks m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.user_id = m.user_id
      left join public.wanted_alerts w
        on w.user_id = m.user_id and w.kind = m.kind and w.target_id = m.target_id
      where m.state = 'wanted'
      order by m.updated_at desc, m.user_id, m.kind, m.target_id
      limit row_limit + 1
    )
    select r.user_id, r.label, r.kind, r.target_id, r.marked_at, r.alert,
           (select count(*) from rows) > row_limit
    from (select * from rows order by marked_at desc, user_id, kind, target_id limit row_limit) r
    order by r.marked_at desc, r.user_id, r.kind, r.target_id;
end;
$$;

revoke execute on function public.admin_people_list(), public.admin_wanted_list()
  from public, anon, authenticated;
grant execute on function public.admin_people_list(), public.admin_wanted_list() to authenticated;

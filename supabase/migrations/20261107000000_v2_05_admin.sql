-- V2-05 admin page: read functions for admins and a lookup for the admin-people Edge Function.
-- Design: docs/design/V2-05-admin.md (rev 2). Contains no emails, ids or secrets.
-- Apply by pasting into the SQL Editor (never db push).

-- True when the caller is a signed-in admin. False with no session.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;

-- Allowlisted people with sign-in state. Users off the allowlist are not listed.
create function public.admin_allowlist_list()
returns table (
  email text, added_at timestamptz, user_id uuid, display_name text,
  signed_in_at timestamptz, is_admin boolean, last_mark_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query
    select al.email, al.added_at, u.id, p.display_name, p.created_at,
           (ad.user_id is not null),
           (select max(m.updated_at) from public.marks m where m.user_id = u.id)
    from public.allowlist al
    left join auth.users u on lower(u.email) = al.email
    left join public.profiles p on p.user_id = u.id
    left join public.admins ad on ad.user_id = u.id
    order by al.added_at desc, al.email;
end;
$$;

-- Wanted marks of allowlisted users, newest first. truncated is true on every row when
-- more than the limit exist.
create function public.admin_wanted_list()
returns table (
  user_id uuid, label text, kind text, target_id text,
  marked_at timestamptz, alert text, truncated boolean
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  -- SOURCE: docs/design/V2-01-schema.md, 2000 marks per user cap; 5000 covers the invited
  -- group with headroom.
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
      join public.allowlist al on al.email = lower(u.email)
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

-- Used only by the admin-people Edge Function (service role): supabase-js has no
-- get-user-by-email call and PostgREST does not expose auth.
create function public.admin_user_lookup(p_email text)
returns table (user_id uuid, is_admin boolean)
language sql stable security definer set search_path = ''
as $$
  select u.id, exists (select 1 from public.admins a where a.user_id = u.id)
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1
$$;

revoke execute on function public.is_admin(), public.admin_allowlist_list(),
  public.admin_wanted_list(), public.admin_user_lookup(text) from public, anon, authenticated;
grant execute on function public.is_admin(), public.admin_allowlist_list(),
  public.admin_wanted_list() to authenticated;
grant execute on function public.admin_user_lookup(text) to service_role;

-- V2-15 contact form storage: table, rate-limited write RPC, admin RPCs.
-- Design: docs/design/V2-15-about-contact.md ("Backend (PR 2)"). Contains no emails, ids or secrets.
-- Apply by pasting into the SQL Editor (never db push).

create table public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text check (char_length(name) <= 80),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 2000),
  -- Salted hash of the caller IP; set to null once its 1-hour window ends.
  ip_hash text,
  read_at timestamptz
);
create index contact_messages_ip_hash_created_at_idx on public.contact_messages (ip_hash, created_at);
create index contact_messages_created_at_idx on public.contact_messages (created_at);

alter table public.contact_messages enable row level security;
-- No policies: only security definer functions touch the table.
revoke all on table public.contact_messages from anon, authenticated;
revoke all on sequence public.contact_messages_id_seq from anon, authenticated;

-- Only write path. Returns 'ok' or 'rate_limited'. One transaction under an advisory lock,
-- so the limit check and the insert cannot race.
create function public.contact_submit(p_name text, p_email text, p_message text, p_ip_hash text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  -- SOURCE: DEFAULT, decisions.md (3 messages per IP hash per hour)
  per_ip_limit constant int := 3;
  -- SOURCE: DEFAULT, decisions.md (50 messages per day across all callers)
  global_limit constant int := 50;
  -- SOURCE: DEFAULT, decisions.md (ip_hash nulled after 1 hour)
  ip_window constant interval := interval '1 hour';
  -- SOURCE: DEFAULT, decisions.md (retention 365 days)
  retention constant interval := interval '365 days';
begin
  if p_ip_hash is null or p_ip_hash = '' then
    raise exception 'ip hash required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.contact_submit'));
  if (select count(*) from public.contact_messages
      where ip_hash = p_ip_hash and created_at > now() - ip_window) >= per_ip_limit
     or (select count(*) from public.contact_messages
         where created_at > now() - interval '1 day') >= global_limit then
    return 'rate_limited';
  end if;
  insert into public.contact_messages (name, email, message, ip_hash)
    values (p_name, p_email, p_message, p_ip_hash);
  update public.contact_messages set ip_hash = null
    where ip_hash is not null and created_at <= now() - ip_window;
  delete from public.contact_messages where created_at < now() - retention;
  return 'ok';
end;
$$;

-- Newest first, at most 200. ip_hash is not returned.
create function public.admin_contact_list()
returns table (id bigint, created_at timestamptz, name text, email text, message text, read_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query
    select c.id, c.created_at, c.name, c.email, c.message, c.read_at
    from public.contact_messages c
    order by c.created_at desc, c.id desc
    limit 200;
end;
$$;

create function public.admin_contact_mark_read(p_id bigint) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  update public.contact_messages set read_at = coalesce(read_at, now()) where id = p_id;
end;
$$;

create function public.admin_contact_delete(p_id bigint) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  delete from public.contact_messages where id = p_id;
end;
$$;

revoke execute on function public.contact_submit(text, text, text, text), public.admin_contact_list(),
  public.admin_contact_mark_read(bigint), public.admin_contact_delete(bigint)
  from public, anon, authenticated;
grant execute on function public.admin_contact_list(), public.admin_contact_mark_read(bigint),
  public.admin_contact_delete(bigint) to authenticated;
grant execute on function public.contact_submit(text, text, text, text) to service_role;

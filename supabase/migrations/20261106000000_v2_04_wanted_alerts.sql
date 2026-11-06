-- V2-04: one Telegram alert per user and target, ever. Design: docs/design/V2-01-schema.md
-- ("Contract for V2-04"). Contains no secrets: the hook secret and URL live in Vault.

-- pg_net sends the call. Not available in the local PGlite test db: skipped there, and the
-- dispatch function below checks for it at run time.
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net not installed here; enable it in the dashboard before relying on alerts';
end;
$$;

-- Rows survive unmarking, so wanted -> owned -> wanted sends nothing.
create table public.wanted_alerts (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('figure', 'series')),
  target_id text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (user_id, kind, target_id),
  check (
    (kind = 'series' and target_id ~ '^[0-9]{4,6}$')
    or (kind = 'figure' and target_id ~ '^[0-9]{4,6}-[0-9]{1,4}$')
  )
);
alter table public.wanted_alerts enable row level security;

revoke all on public.wanted_alerts from anon, authenticated;
grant select, insert, update, delete on public.wanted_alerts to service_role;

-- Sends the call. Never raises: a failed alert must not block the user's mark.
-- Vault secrets expected: alert_hook_url (function URL), alert_hook_secret.
create function private.dispatch_wanted_alert(p_user uuid, p_kind text, p_target text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regproc('net.http_post') is null then
    raise warning 'wanted alert not sent: vault or pg_net missing';
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into v_url using 'alert_hook_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
    into v_secret using 'alert_hook_secret';
  if v_url is null or v_secret is null then
    raise warning 'wanted alert not sent: vault secret missing';
    return;
  end if;
  -- Body holds only the alert key; the function re-reads everything else.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-alert-secret', v_secret),
    body := jsonb_build_object('user_id', p_user, 'kind', p_kind, 'target_id', p_target),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'wanted alert not sent: dispatch failed (sqlstate %)', sqlstate;
end;
$$;

-- Definer: clients have no grants on wanted_alerts. Fires after the mark is written.
create function private.on_wanted_mark() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  -- SOURCE: OWNER-SUPPLIED pending. Default 20 alerts per user per hour, logged as an
  -- open question in the V2-04 report.
  hourly_cap constant int := 20;
  inserted int;
begin
  if new.state is distinct from 'wanted' then
    return new;
  end if;
  -- Serialise per user so the cap cannot be raced.
  perform pg_advisory_xact_lock(hashtext('wanted_alert:' || new.user_id::text));
  -- Over the cap the alert is dropped: no row, so no send.
  if (select count(*) from public.wanted_alerts
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= hourly_cap then
    return new;
  end if;
  insert into public.wanted_alerts (user_id, kind, target_id)
  values (new.user_id, new.kind, new.target_id)
  on conflict (user_id, kind, target_id) do update
    set created_at = public.wanted_alerts.created_at
    where public.wanted_alerts.sent_at is null;
  -- row_count is 1 for a new row or an unsent row (retry); 0 for an already sent row.
  get diagnostics inserted = row_count;
  if inserted = 1 then
    perform private.dispatch_wanted_alert(new.user_id, new.kind, new.target_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.dispatch_wanted_alert(uuid, text, text),
  private.on_wanted_mark() from public, anon, authenticated;

create trigger marks_wanted_alert_insert
  after insert on public.marks
  for each row when (new.state = 'wanted')
  execute function private.on_wanted_mark();

create trigger marks_wanted_alert_update
  after update of state on public.marks
  for each row when (new.state = 'wanted' and old.state is distinct from new.state)
  execute function private.on_wanted_mark();

-- Clients must not reach pg_net (it could call arbitrary URLs from the database).
-- Guarded: the net schema is absent in the local test db.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'net') then
    revoke usage on schema net from anon, authenticated;
    revoke execute on all functions in schema net from anon, authenticated;
  end if;
end;
$$;

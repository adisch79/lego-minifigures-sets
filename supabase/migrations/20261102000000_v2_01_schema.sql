-- V2-01 schema: allowlist, admins, profiles, marks.
-- Design: docs/design/V2-01-schema.md. No emails, admin ids or secrets here.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- allowlist: record of invited addresses. No client access.
create table public.allowlist (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

-- admins: separate from profiles so a grant mistake there cannot create an admin.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  created_at timestamptz not null default now()
);

create table public.marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('figure', 'series')),
  target_id text not null,
  state text not null check (state in ('owned', 'wanted')),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, target_id),
  check (
    (kind = 'series' and target_id ~ '^\d{4,6}$')
    or (kind = 'figure' and target_id ~ '^\d{4,6}-\d+$')
  )
);

alter table public.allowlist enable row level security;
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.marks enable row level security;

-- Functions: private schema, empty search_path, no execute for client roles.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Takes nothing from raw_user_meta_data.
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.enforce_marks_cap() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  -- SOURCE: docs/design/V2-01-schema.md ("Per-user row cap by trigger: 2000"),
  -- about twice the 839 ids in app/public/catalog.json.
  max_rows constant int := 2000;
begin
  -- Serialise concurrent inserts of the same user so the cap cannot be raced.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if (select count(*) from public.marks where user_id = new.user_id) >= max_rows then
    raise exception 'marks limit of % rows per user reached', max_rows
      using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function private.handle_new_user(), private.set_updated_at(),
  private.enforce_marks_cap() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger marks_set_updated_at
  before update on public.marks
  for each row execute function private.set_updated_at();

create trigger marks_enforce_cap
  before insert on public.marks
  for each row execute function private.enforce_marks_cap();

-- Grants: explicit, never relying on defaults.
-- SOURCE: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
revoke all on public.allowlist, public.admins, public.profiles, public.marks from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.marks to authenticated;
grant update (state) on public.marks to authenticated;

-- Policies. allowlist and admins: RLS on, no policies.
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy marks_select_own on public.marks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy marks_insert_own on public.marks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy marks_update_own on public.marks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy marks_delete_own on public.marks
  for delete to authenticated using ((select auth.uid()) = user_id);

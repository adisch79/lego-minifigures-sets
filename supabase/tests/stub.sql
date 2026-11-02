-- TEST FIXTURE ONLY. Not a migration, never applied to a real project.
-- Minimal stand-in for what Supabase provides before user migrations run.
-- SOURCE: https://supabase.com/docs/guides/database/postgres/roles (role names)
-- SOURCE: https://supabase.com/docs/guides/auth/row-level-security (auth.uid() reads the JWT sub claim)
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_change text default '',
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Test stand-in: the real function reads the JWT claim; here a session setting.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Auth writes users as this role on a real project.
grant select, insert, update, delete on auth.users to supabase_auth_admin;

-- Worst case on purpose, both ways: client roles get everything by default, so the
-- migration must revoke; service_role gets nothing, so the migration must grant.
alter default privileges in schema public grant all on tables to anon, authenticated;

-- Empty realtime publication so the test can assert our tables never join it.
create publication supabase_realtime;

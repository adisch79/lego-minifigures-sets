-- Re-runnable: removes client access to pg_net (net schema). Safe if schema net is absent.
-- Run after any pg_net enable or upgrade (an upgrade can restore default grants).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'net') then
    revoke usage on schema net from public, anon, authenticated;
    revoke execute on all functions in schema net from public, anon, authenticated;
  end if;
end;
$$;

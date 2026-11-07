// Edge Function: add or remove an invited person (V2-05). Caller: the admin page, with the
// signed-in user's JWT (verify_jwt = true in config.toml). Body: {action: "add"|"remove", email}.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// SOURCE: https://supabase.com/docs/guides/functions/secrets
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest } from './logic.ts';
import type { Deps } from './logic.ts';

Deno.serve(async (req: Request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    console.error('admin-people: missing configuration');
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }

  // Auth client only validates the token; the service client does every privileged call.
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const deps: Deps = {
    getUser: async (jwt) => {
      const { data, error } = await authClient.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    isAdmin: async (userId) => {
      const { data, error } = await db.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('admins read failed');
      return data !== null;
    },
    lookup: async (email) => {
      const { data, error } = await db.rpc('admin_user_lookup', { p_email: email });
      if (error) throw new Error('lookup failed');
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    insertAllowlist: async (email) => {
      const { error } = await db.from('allowlist').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
      return !error;
    },
    deleteAllowlist: async (email) => {
      const { error } = await db.from('allowlist').delete().eq('email', email);
      return !error;
    },
    createUser: async (email) => {
      const { error } = await db.auth.admin.createUser({ email, email_confirm: true });
      return error ? { message: error.message, status: error.status, code: error.code } : null;
    },
    deleteUser: async (userId) => {
      const { error } = await db.auth.admin.deleteUser(userId);
      return error ? { message: error.message, status: error.status, code: error.code } : null;
    },
    log: (message) => console.error(message),
  };

  let bodyText = '';
  try {
    bodyText = await req.text();
  } catch {
    bodyText = '';
  }
  const res = await handleRequest({
    method: req.method,
    origin: req.headers.get('origin'),
    authorization: req.headers.get('authorization'),
    bodyText,
  }, deps);
  return new Response(res.body === null ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});

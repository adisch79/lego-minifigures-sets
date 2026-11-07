// Pure request logic for the admin-people Edge Function (V2-05). No Deno or network APIs
// here: every side effect comes in through Deps, so node --test can drive it.
// Erasable TypeScript syntax only. Design: docs/design/V2-05-admin.md.

// SOURCE: docs/design/V2-05-admin.md, "CORS": exact origin of the GitHub Pages site.
export const ALLOWED_ORIGIN = 'https://adisch79.github.io';
// SOURCE: docs/design/V2-05-admin.md, "Writes": allowed request headers.
export const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info';
// SOURCE: docs/design/V2-05-admin.md, "Writes": body must be at most 1 KB.
export const MAX_BODY_BYTES = 1024;
// SOURCE: RFC 5321 section 4.5.3.1.3 (path limit 256 octets, so address 254); design: max 254 chars.
export const MAX_EMAIL_CHARS = 254;

export type ErrorCode = 'unauthorized' | 'not_admin' | 'bad_request' | 'bad_email' | 'is_admin' | 'internal';

export type AuthUser = { id: string };
export type Lookup = { user_id: string; is_admin: boolean };
// Shape of an Auth admin error: supabase-js AuthError has message, status and code.
export type AuthErr = { message?: string; status?: number; code?: string } | null;

export type Deps = {
  getUser: (jwt: string) => Promise<AuthUser | null>; // auth client, validates the token
  isAdmin: (userId: string) => Promise<boolean>; // live read of public.admins (service client)
  lookup: (email: string) => Promise<Lookup | null>; // rpc admin_user_lookup
  // On conflict do nothing. ok=false on error; inserted=true only when this call created the row.
  insertAllowlist: (email: string) => Promise<{ ok: boolean; inserted: boolean }>;
  deleteAllowlist: (email: string) => Promise<boolean>;
  createUser: (email: string) => Promise<AuthErr>; // auth.admin.createUser({ email, email_confirm: true })
  deleteUser: (userId: string) => Promise<AuthErr>; // auth.admin.deleteUser
  log: (message: string) => void; // fixed strings only, never emails or tokens
};

export type Req = {
  method: string;
  origin: string | null;
  authorization: string | null;
  contentLength?: number | null; // declared Content-Length, when present
  bodyText: string;
};

export type Res = { status: number; headers: Record<string, string>; body: unknown };

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-headers': ALLOWED_HEADERS,
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  };
}

const reply = (status: number, body: unknown): Res => ({
  status,
  headers: { ...corsHeaders(), 'content-type': 'application/json' },
  body,
});
const fail = (status: number, code: ErrorCode): Res => reply(status, { error: code });

// Trim, lower-case, then: max length, exactly one @ with text both sides, no whitespace or
// control characters. Returns null when invalid.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length === 0 || e.length > MAX_EMAIL_CHARS) return null;
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(e)) return null;
  if (/[^!-~]/.test(e)) return null; // ASCII only: no homograph or odd-Unicode addresses
  const parts = e.split('@');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null;
  return e;
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m ? m[1] : null;
}

// "Already registered" from Auth admin createUser. Code is current; message is the fallback.
export function isAlreadyRegistered(err: AuthErr): boolean {
  if (!err) return false;
  if (err.code === 'email_exists' || err.code === 'user_already_exists') return true;
  return /already (been )?registered|already exists/i.test(err.message ?? '');
}

export async function handleRequest(req: Req, deps: Deps): Promise<Res> {
  // Origin first: any other origin (or none) learns nothing.
  if (req.origin !== ALLOWED_ORIGIN) return { status: 403, headers: { vary: 'Origin' }, body: { error: 'origin' } };
  if (req.method === 'OPTIONS') return { status: 204, headers: corsHeaders(), body: null };
  if (req.method !== 'POST') return fail(405, 'bad_request');
  // Declared size over the limit: refuse before any auth work or body use.
  if (typeof req.contentLength === 'number' && req.contentLength > MAX_BODY_BYTES) return fail(413, 'bad_request');

  const jwt = bearerToken(req.authorization);
  if (!jwt) return fail(401, 'unauthorized');
  let caller: AuthUser | null = null;
  try {
    caller = await deps.getUser(jwt);
  } catch {
    deps.log('admin-people: token check failed');
  }
  if (!caller) return fail(401, 'unauthorized');

  let admin = false;
  try {
    admin = await deps.isAdmin(caller.id);
  } catch {
    deps.log('admin-people: admin check failed');
    return fail(500, 'internal');
  }
  if (!admin) return fail(403, 'not_admin');

  // Body: JSON object, at most 1 KB, exactly action and email.
  if (new TextEncoder().encode(req.bodyText).length > MAX_BODY_BYTES) return fail(400, 'bad_request');
  let body: unknown;
  try {
    body = JSON.parse(req.bodyText);
  } catch {
    return fail(400, 'bad_request');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'bad_request');
  const b = body as Record<string, unknown>;
  if (b.action !== 'add' && b.action !== 'remove') return fail(400, 'bad_request');
  const email = normalizeEmail(b.email);
  if (!email) return fail(400, 'bad_email');

  try {
    return b.action === 'add' ? await add(email, deps) : await remove(email, caller, deps);
  } catch {
    deps.log('admin-people: unexpected failure');
    return fail(500, 'internal');
  }
}

// V2-01 "Adding a person": allowlist row first (the auth.users trigger needs it), then the account.
async function add(email: string, deps: Deps): Promise<Res> {
  const ins = await deps.insertAllowlist(email);
  if (!ins.ok) {
    deps.log('admin-people: allowlist insert failed');
    return fail(500, 'internal');
  }
  const err = await deps.createUser(email);
  if (err && !isAlreadyRegistered(err)) {
    // Roll back only a row this request created; a pre-existing row belongs to an earlier invite.
    if (ins.inserted) {
      deps.log('admin-people: createUser failed, rolling back allowlist row');
      if (!(await deps.deleteAllowlist(email))) deps.log('admin-people: rollback failed');
    } else {
      deps.log('admin-people: createUser failed, allowlist row kept');
    }
    return fail(500, 'internal');
  }
  return reply(200, { ok: true });
}

// V2-01 "Removing a person": refuse admins, hard-delete the account, then drop the allowlist row.
async function remove(email: string, caller: AuthUser, deps: Deps): Promise<Res> {
  const target = await deps.lookup(email);
  if (target && (target.is_admin || target.user_id === caller.id)) return fail(409, 'is_admin');
  if (target) {
    const err = await deps.deleteUser(target.user_id);
    if (err) {
      deps.log('admin-people: deleteUser failed');
      return fail(500, 'internal');
    }
  }
  if (!(await deps.deleteAllowlist(email))) {
    deps.log('admin-people: allowlist delete failed');
    return fail(500, 'internal');
  }
  return reply(200, { ok: true });
}

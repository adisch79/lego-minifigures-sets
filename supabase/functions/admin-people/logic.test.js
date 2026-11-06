// Unit tests for the pure logic of the admin-people function (V2-05).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, normalizeEmail, bearerToken, isAlreadyRegistered, ALLOWED_ORIGIN } from './logic.ts';

// Throwaway test values only.
const ADMIN_ID = 'admin-id';
const TOKEN = 'tok.en.value';
const ORIGIN = 'https://adisch79.github.io';

// In-memory fake of the world behind Deps.
function world(over = {}) {
  const w = {
    allowlist: new Set(),
    users: new Map(), // email -> { id, admin }
    logs: [],
    calls: [],
    createError: null,
    deleteError: null,
    ...over,
  };
  let n = 0;
  w.deps = {
    getUser: async (jwt) => (jwt === TOKEN ? { id: ADMIN_ID } : null),
    isAdmin: async (id) => [...w.users.values()].some((u) => u.id === id && u.admin),
    lookup: async (email) => {
      const u = w.users.get(email);
      return u ? { user_id: u.id, is_admin: u.admin } : null;
    },
    insertAllowlist: async (email) => { w.calls.push('insert'); w.allowlist.add(email); return true; },
    deleteAllowlist: async (email) => { w.calls.push('delAllow'); w.allowlist.delete(email); return true; },
    createUser: async (email) => {
      w.calls.push('create');
      if (w.createError) return w.createError;
      if (w.users.has(email)) return { code: 'email_exists', message: 'A user with this email address has already been registered', status: 422 };
      w.users.set(email, { id: `u${++n}`, admin: false });
      return null;
    },
    deleteUser: async (id) => {
      w.calls.push('delUser');
      if (w.deleteError) return w.deleteError;
      for (const [e, u] of w.users) if (u.id === id) w.users.delete(e);
      return null;
    },
    log: (m) => w.logs.push(m),
  };
  w.users.set('boss@example.invalid', { id: ADMIN_ID, admin: true });
  return w;
}

const post = (w, body, over = {}) => handleRequest({
  method: 'POST', origin: ORIGIN, authorization: `Bearer ${TOKEN}`,
  bodyText: typeof body === 'string' ? body : JSON.stringify(body), ...over,
}, w.deps);

test('origin: other or missing origin refused 403, no CORS grant', async () => {
  const w = world();
  for (const origin of ['https://evil.example', 'https://adisch79.github.io.evil.example', 'http://adisch79.github.io', null]) {
    const r = await post(w, { action: 'add', email: 'a@example.invalid' }, { origin });
    assert.equal(r.status, 403);
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  }
  assert.deepEqual(w.calls, []);
});

test('preflight OPTIONS from the allowed origin answers 204 with exact CORS headers', async () => {
  const w = world();
  const r = await post(w, '', { method: 'OPTIONS', authorization: null });
  assert.equal(r.status, 204);
  assert.equal(r.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(r.headers['access-control-allow-headers'], 'authorization, apikey, content-type, x-client-info');
  assert.equal(r.headers.vary, 'Origin');
});

test('method: GET and PUT refused 405', async () => {
  const w = world();
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await post(w, {}, { method })).status, 405);
});

test('responses carry exact origin and Vary', async () => {
  const r = await post(world(), { action: 'add', email: 'a@example.invalid' });
  assert.equal(r.headers['access-control-allow-origin'], ORIGIN);
  assert.equal(r.headers.vary, 'Origin');
});

test('missing or invalid JWT gives 401 unauthorized', async () => {
  const w = world();
  for (const authorization of [null, '', 'Bearer', 'Basic abc', 'Bearer wrong']) {
    const r = await post(w, { action: 'add', email: 'a@example.invalid' }, { authorization });
    assert.equal(r.status, 401, String(authorization));
    assert.deepEqual(r.body, { error: 'unauthorized' });
  }
  assert.deepEqual(w.calls, []);
});

test('getUser throwing gives 401, not a crash', async () => {
  const w = world();
  w.deps.getUser = async () => { throw new Error('boom'); };
  assert.equal((await post(w, { action: 'add', email: 'a@example.invalid' })).status, 401);
});

test('non-admin gets 403 not_admin and nothing happens', async () => {
  const w = world();
  w.users.get('boss@example.invalid').admin = false;
  const r = await post(w, { action: 'add', email: 'a@example.invalid' });
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: 'not_admin' });
  assert.deepEqual(w.calls, []);
});

test('bad bodies: not JSON, wrong type, unknown action, over 1 KB', async () => {
  const w = world();
  for (const b of ['not json', '[]', 'null', '"x"', { action: 'nuke', email: 'a@example.invalid' }, { email: 'a@example.invalid' }]) {
    const r = await post(w, b);
    assert.equal(r.status, 400, JSON.stringify(b));
    assert.deepEqual(r.body, { error: 'bad_request' });
  }
  const big = await post(w, JSON.stringify({ action: 'add', email: 'a@example.invalid', pad: 'x'.repeat(1100) }));
  assert.equal(big.status, 400);
  assert.deepEqual(w.calls, []);
});

test('bad email: missing, wrong type, spaces inside, two @, none, control char, too long', async () => {
  const w = world();
  const long = `${'a'.repeat(250)}@b.c`; // 254 chars: allowed
  const tooLong = `${'a'.repeat(251)}@b.c`; // 255
  assert.equal(long.length, 254);
  for (const email of [undefined, 5, '', '   ', 'a b@example.invalid', 'a@@example.invalid', 'a@b@c', 'noat', '@x', 'x@', 'a\u0000@x.y', 'a\n@x.y', tooLong]) {
    const r = await post(w, { action: 'add', email });
    assert.equal(r.status, 400, String(email));
    assert.deepEqual(r.body, { error: 'bad_email' });
  }
  assert.equal((await post(w, { action: 'add', email: long })).status, 200);
});

test('normalizeEmail trims and lower-cases', () => {
  assert.equal(normalizeEmail('  Ann@Example.INVALID '), 'ann@example.invalid');
  assert.equal(normalizeEmail(null), null);
});

test('bearerToken parses the header', () => {
  assert.equal(bearerToken('Bearer abc'), 'abc');
  assert.equal(bearerToken('bearer abc'), 'abc');
  assert.equal(bearerToken('Bearer a b'), null);
  assert.equal(bearerToken(null), null);
});

test('add: allowlist row first, then account, stored lower-case', async () => {
  const w = world();
  const r = await post(w, { action: 'add', email: ' New@Example.invalid ' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.deepEqual(w.calls, ['insert', 'create']);
  assert.ok(w.allowlist.has('new@example.invalid'));
  assert.ok(w.users.has('new@example.invalid'));
});

test('add: createUser failure rolls back the allowlist row and answers internal', async () => {
  const w = world({ createError: { message: 'database error', status: 500 } });
  const r = await post(w, { action: 'add', email: 'new@example.invalid' });
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { error: 'internal' });
  assert.equal(w.allowlist.has('new@example.invalid'), false);
  assert.deepEqual(w.calls, ['insert', 'create', 'delAllow']);
});

test('add: "already registered" keeps the allowlist row and succeeds', async () => {
  const w = world();
  w.users.set('here@example.invalid', { id: 'u9', admin: false });
  const r = await post(w, { action: 'add', email: 'here@example.invalid' });
  assert.equal(r.status, 200);
  assert.ok(w.allowlist.has('here@example.invalid'));
  assert.ok(!w.calls.includes('delAllow'));
});

test('isAlreadyRegistered: code, message, and non-matches', () => {
  assert.equal(isAlreadyRegistered({ code: 'email_exists' }), true);
  assert.equal(isAlreadyRegistered({ message: 'User already registered' }), true);
  assert.equal(isAlreadyRegistered({ message: 'database error saving new user', status: 500 }), false);
  assert.equal(isAlreadyRegistered(null), false);
});

test('remove: deletes the account, then the allowlist row', async () => {
  const w = world();
  await post(w, { action: 'add', email: 'ann@example.invalid' });
  w.calls.length = 0;
  const r = await post(w, { action: 'remove', email: 'ANN@example.invalid' });
  assert.equal(r.status, 200);
  assert.deepEqual(w.calls, ['delUser', 'delAllow']);
  assert.equal(w.users.has('ann@example.invalid'), false);
  assert.equal(w.allowlist.has('ann@example.invalid'), false);
});

test('remove: an admin target is refused (is_admin), including self', async () => {
  const w = world();
  w.users.set('other@example.invalid', { id: 'u7', admin: true });
  for (const email of ['other@example.invalid', 'boss@example.invalid']) {
    const r = await post(w, { action: 'remove', email });
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, { error: 'is_admin' });
  }
  assert.deepEqual(w.calls, []);
});

test('remove: caller id match is refused even if the admin flag were false', async () => {
  const w = world();
  w.deps.lookup = async () => ({ user_id: ADMIN_ID, is_admin: false });
  const r = await post(w, { action: 'remove', email: 'me@example.invalid' });
  assert.deepEqual(r.body, { error: 'is_admin' });
  assert.deepEqual(w.calls, []);
});

test('remove: unknown account still clears a stale allowlist row', async () => {
  const w = world();
  w.allowlist.add('stale@example.invalid');
  const r = await post(w, { action: 'remove', email: 'stale@example.invalid' });
  assert.equal(r.status, 200);
  assert.deepEqual(w.calls, ['delAllow']);
  assert.equal(w.allowlist.has('stale@example.invalid'), false);
});

test('remove: deleteUser failure keeps the allowlist row and answers internal', async () => {
  const w = world();
  await post(w, { action: 'add', email: 'ann@example.invalid' });
  w.deleteError = { message: 'nope', status: 500 };
  const r = await post(w, { action: 'remove', email: 'ann@example.invalid' });
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { error: 'internal' });
  assert.ok(w.allowlist.has('ann@example.invalid'));
});

test('remove then re-add works', async () => {
  const w = world();
  await post(w, { action: 'add', email: 'ann@example.invalid' });
  await post(w, { action: 'remove', email: 'ann@example.invalid' });
  const r = await post(w, { action: 'add', email: 'ann@example.invalid' });
  assert.equal(r.status, 200);
  assert.ok(w.allowlist.has('ann@example.invalid'));
  assert.ok(w.users.has('ann@example.invalid'));
});

test('logs never contain an email or a token, on any path', async () => {
  const w = world({ createError: { message: 'failed for leak@example.invalid', status: 500 } });
  await post(w, { action: 'add', email: 'leak@example.invalid' }); // create failure path
  w.createError = null;
  w.deleteError = { message: 'failed for leak2@example.invalid', status: 500 };
  await post(w, { action: 'add', email: 'leak2@example.invalid' });
  await post(w, { action: 'remove', email: 'leak2@example.invalid' }); // delete failure path
  w.deps.getUser = async () => { throw new Error(`bad ${TOKEN}`); };
  await post(w, { action: 'add', email: 'leak3@example.invalid' });
  assert.ok(w.logs.length >= 3);
  const all = w.logs.join('\n');
  assert.ok(!/@|leak|tok\.en/.test(all), all);
});

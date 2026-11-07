// V2-05 admin functions in PGlite: is_admin, admin_allowlist_list, admin_wanted_list, admin_user_lookup.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(here, '..', 'migrations');

// Fixed throwaway ids for the test only.
const ADM = '00000000-0000-4000-8000-0000000000ad';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const GONE = '00000000-0000-4000-8000-0000000000ee'; // user whose email left the allowlist

let db;
before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.join(here, 'stub.sql'), 'utf8'));
  for (const f of readdirSync(migDir).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(migDir, f), 'utf8'));
  }
});

beforeEach(async () => {
  await db.exec('reset role; delete from auth.users; delete from public.allowlist;');
  await db.exec(`insert into public.allowlist (email) values
    ('adm@example.invalid'),('a@example.invalid'),('b@example.invalid'),('gone@example.invalid')`);
  await db.exec(`insert into auth.users (id, email) values ('${ADM}','adm@example.invalid'),
    ('${A}','a@example.invalid'),('${B}','B@Example.invalid'),('${GONE}','gone@example.invalid')`);
  await db.exec(`insert into public.admins (user_id) values ('${ADM}')`);
  await db.exec("delete from public.allowlist where email='gone@example.invalid'");
});

async function as(role, uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const asAdmin = (fn) => as('authenticated', ADM, fn);
const q = (sql, p) => db.query(sql, p);
const denied = (code) => (e) => { assert.equal(e.code, code, e.message); return true; };
// The set_updated_at trigger forces now(); disable user triggers to plant fixed timestamps.
const setTimes = async (sql) => {
  await db.exec('alter table public.marks disable trigger user');
  try { await db.exec(sql); } finally { await db.exec('alter table public.marks enable trigger user'); }
};
const mark = (uid, kind, id, state = 'wanted') =>
  q('insert into public.marks (user_id, kind, target_id, state) values ($1,$2,$3,$4)', [uid, kind, id, state]);

test('is_admin: true for admin, false for others and for no session; anon refused', async () => {
  assert.equal((await asAdmin(() => q('select public.is_admin() v'))).rows[0].v, true);
  assert.equal((await as('authenticated', A, () => q('select public.is_admin() v'))).rows[0].v, false);
  assert.equal((await as('authenticated', null, () => q('select public.is_admin() v'))).rows[0].v, false);
  await as('anon', null, () => assert.rejects(q('select public.is_admin()'), denied('42501')));
});

test('list RPCs refuse anon and a non-admin with 42501', async () => {
  for (const fn of ['admin_allowlist_list', 'admin_wanted_list']) {
    await as('anon', null, () => assert.rejects(q(`select * from public.${fn}()`), denied('42501')));
    await as('authenticated', A, () => assert.rejects(q(`select * from public.${fn}()`), denied('42501')));
    await as('authenticated', null, () => assert.rejects(q(`select * from public.${fn}()`), denied('42501')));
  }
});

test('admin_allowlist_list: rows, join on lower(email), admin flag, last mark, order', async () => {
  await q("update public.profiles set display_name='Ann' where user_id=$1", [A]);
  await mark(A, 'series', '71053', 'owned');
  await setTimes("update public.marks set updated_at = '2026-01-02T00:00:00Z'");
  await q("update public.allowlist set added_at = '2026-01-01T00:00:00Z' where email='a@example.invalid'");
  await q("update public.allowlist set added_at = '2026-02-01T00:00:00Z' where email='b@example.invalid'");
  const r = (await asAdmin(() => q('select * from public.admin_allowlist_list()'))).rows;
  assert.equal(r.length, 3); // removed user not listed
  assert.ok(!r.some((x) => x.user_id === GONE));
  const by = Object.fromEntries(r.map((x) => [x.email, x]));
  assert.equal(by['adm@example.invalid'].is_admin, true);
  assert.equal(by['a@example.invalid'].is_admin, false);
  assert.equal(by['a@example.invalid'].user_id, A);
  assert.equal(by['a@example.invalid'].display_name, 'Ann');
  assert.ok(by['a@example.invalid'].signed_in_at);
  assert.equal(by['a@example.invalid'].last_mark_at.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(by['b@example.invalid'].user_id, B); // mixed-case auth email still joins
  assert.equal(by['b@example.invalid'].last_mark_at, null);
  // newest added_at first
  const idx = (e) => r.findIndex((x) => x.email === e);
  assert.ok(idx('b@example.invalid') < idx('a@example.invalid'));
});

test('allowlist entry with no account yet: user_id and sign-in null', async () => {
  await q("insert into public.allowlist (email) values ('new@example.invalid')");
  const r = (await asAdmin(() => q("select * from public.admin_allowlist_list() where email='new@example.invalid'"))).rows;
  assert.equal(r.length, 1);
  assert.equal(r[0].user_id, null);
  assert.equal(r[0].signed_in_at, null);
  assert.equal(r[0].is_admin, false);
});

test('admin_wanted_list: only wanted marks, label fallback, alert states', async () => {
  await q("update public.profiles set display_name='Ann' where user_id=$1", [A]);
  await q("update public.profiles set display_name='   ' where user_id=$1", [B]); // blank -> email
  await mark(A, 'series', '71053', 'owned'); // not wanted: hidden
  await mark(A, 'figure', '71053-1'); // sent
  await mark(A, 'figure', '71053-2'); // unsent
  await mark(B, 'series', '71054'); // no alert row (none)
  await q("delete from public.wanted_alerts where user_id=$1 and target_id='71054'", [B]);
  await q("update public.wanted_alerts set sent_at = now() where target_id='71053-1'");
  await q("update public.wanted_alerts set sent_at = null where target_id='71053-2'");
  const r = (await asAdmin(() => q('select * from public.admin_wanted_list()'))).rows;
  assert.equal(r.length, 3);
  const by = Object.fromEntries(r.map((x) => [x.target_id, x]));
  assert.equal(by['71053-1'].alert, 'sent');
  assert.equal(by['71053-2'].alert, 'unsent');
  assert.equal(by['71054'].alert, 'none');
  assert.equal(by['71053-1'].label, 'Ann');
  assert.equal(by['71054'].label, 'B@Example.invalid');
  assert.equal(by['71054'].kind, 'series');
  assert.ok(r.every((x) => x.truncated === false));
  assert.ok(r.every((x) => x.marked_at));
});

test('admin_wanted_list: users off the allowlist are hidden', async () => {
  await mark(GONE, 'series', '71053');
  await mark(A, 'series', '71054');
  const r = (await asAdmin(() => q('select user_id from public.admin_wanted_list()'))).rows;
  assert.deepEqual(r.map((x) => x.user_id), [A]);
});

test('admin_wanted_list: newest first', async () => {
  await mark(A, 'series', '71051');
  await mark(A, 'series', '71052');
  await mark(B, 'series', '71053');
  await setTimes(`update public.marks set updated_at='2026-01-01' where target_id='71051';
    update public.marks set updated_at='2026-03-01' where target_id='71052';
    update public.marks set updated_at='2026-02-01' where target_id='71053';`);
  const r = (await asAdmin(() => q('select target_id from public.admin_wanted_list()'))).rows;
  assert.deepEqual(r.map((x) => x.target_id), ['71052', '71053', '71051']);
});

test('admin_wanted_list: limit 5000 and truncated on every row', async () => {
  // SOURCE: 5000 limit and 2000 marks cap per user from docs/design/V2-05-admin.md and V2-01-schema.md.
  const C = '00000000-0000-4000-8000-00000000000c';
  await q("insert into public.allowlist (email) values ('c@example.invalid')");
  await q("insert into auth.users (id, email) values ($1,'c@example.invalid')", [C]);
  const add = (uid, n) => q(`insert into public.marks (user_id, kind, target_id, state)
    select $1, 'series', (100000 + g)::text, 'wanted' from generate_series(1, $2::int) g`, [uid, n]);
  await add(A, 2000);
  await add(B, 2000);
  await add(ADM, 1000);
  let r = (await asAdmin(() => q('select truncated from public.admin_wanted_list()'))).rows;
  assert.equal(r.length, 5000);
  assert.ok(r.every((x) => x.truncated === false));
  await add(C, 1);
  r = (await asAdmin(() => q('select truncated from public.admin_wanted_list()'))).rows;
  assert.equal(r.length, 5000);
  assert.ok(r.every((x) => x.truncated === true));
});

test('admin_user_lookup: service_role only, case-insensitive, admin flag', async () => {
  for (const role of ['anon', 'authenticated']) {
    await as(role, ADM, () => assert.rejects(q("select * from public.admin_user_lookup('adm@example.invalid')"), denied('42501')));
  }
  await as('service_role', null, async () => {
    const a = (await q("select * from public.admin_user_lookup('ADM@Example.invalid')")).rows;
    assert.deepEqual(a, [{ user_id: ADM, is_admin: true }]);
    const b = (await q("select * from public.admin_user_lookup('b@example.invalid')")).rows;
    assert.deepEqual(b, [{ user_id: B, is_admin: false }]);
    assert.equal((await q("select * from public.admin_user_lookup('nobody@example.invalid')")).rows.length, 0);
  });
});

test('new functions: definer, pinned search_path, service_role can call lookup', async () => {
  const r = await q(`select proname, prosecdef, proconfig from pg_proc
    where pronamespace='public'::regnamespace
    and proname in ('is_admin','admin_allowlist_list','admin_wanted_list','admin_user_lookup')`);
  assert.equal(r.rows.length, 4);
  for (const f of r.rows) {
    assert.equal(f.prosecdef, true, f.proname);
    assert.ok(f.proconfig.includes('search_path=""'), f.proname);
  }
  assert.equal((await q("select has_function_privilege('service_role','public.admin_user_lookup(text)','execute') x")).rows[0].x, true);
});

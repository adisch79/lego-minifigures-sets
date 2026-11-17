// V2-15 contact messages in PGlite: table lockdown, contact_submit limits and retention, admin RPCs.
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

let db;
before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.join(here, 'stub.sql'), 'utf8'));
  for (const f of readdirSync(migDir).filter((n) => n.endsWith('.sql') && !n.includes('v2_08_pause')).sort()) {
    await db.exec(readFileSync(path.join(migDir, f), 'utf8'));
  }
});

beforeEach(async () => {
  await db.exec('reset role; delete from auth.users; delete from public.contact_messages;');
  await db.exec(`insert into auth.users (id, email) values ('${ADM}','adm@example.invalid'),('${A}','a@example.invalid')`);
  await db.exec(`insert into public.admins (user_id) values ('${ADM}')`);
});

async function as(role, uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const q = (sql, p) => db.query(sql, p);
const asAdmin = (fn) => as('authenticated', ADM, fn);
const asService = (fn) => as('service_role', null, fn);
const submit = (hash, email = 'x@example.invalid', msg = 'hello', name = 'N') =>
  asService(async () => (await q('select public.contact_submit($1,$2,$3,$4) r', [name, email, msg, hash])).rows[0].r);
const denied = (code) => (e) => { assert.equal(e.code, code, e.message); return true; };
const insertRaw = (hash, age) => q(
  `insert into public.contact_messages (email, message, ip_hash, created_at)
   values ('r@example.invalid','raw',$1, now() - $2::interval)`, [hash, age]);

test('table and sequence: anon and authenticated cannot read or write', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const sql of [
      'select * from public.contact_messages',
      "insert into public.contact_messages (email, message, ip_hash) values ('a@b.invalid','m','h')",
      'update public.contact_messages set read_at = now()',
      'delete from public.contact_messages',
      "select nextval(pg_get_serial_sequence('public.contact_messages','id'))",
    ]) {
      await assert.rejects(as(role, role === 'anon' ? null : A, () => q(sql)), denied('42501'), `${role}: ${sql}`);
    }
  }
  const rls = await q("select relrowsecurity r from pg_class where oid='public.contact_messages'::regclass");
  assert.equal(rls.rows[0].r, true);
  const pol = await q("select 1 from pg_policies where tablename='contact_messages'");
  assert.equal(pol.rows.length, 0);
});

test('anon gets an error on every contact RPC', async () => {
  for (const sql of [
    "select public.contact_submit('n','a@b.invalid','m','h')",
    'select * from public.admin_contact_list()',
    'select public.admin_contact_mark_read(1)',
    'select public.admin_contact_delete(1)',
  ]) {
    await assert.rejects(as('anon', null, () => q(sql)), denied('42501'), sql);
  }
});

test('contact_submit: service_role only; authenticated refused', async () => {
  await assert.rejects(
    as('authenticated', ADM, () => q("select public.contact_submit('n','a@b.invalid','m','h')")), denied('42501'));
  assert.equal(await submit('h1'), 'ok');
  const g = await q(`select
    has_function_privilege('service_role','public.contact_submit(text,text,text,text)','execute') s,
    has_function_privilege('authenticated','public.contact_submit(text,text,text,text)','execute') a,
    has_function_privilege('anon','public.contact_submit(text,text,text,text)','execute') n`);
  assert.deepEqual(g.rows[0], { s: true, a: false, n: false });
});

test('admin RPCs refuse non-admins and no session', async () => {
  for (const sql of [
    'select * from public.admin_contact_list()',
    'select public.admin_contact_mark_read(1)',
    'select public.admin_contact_delete(1)',
  ]) {
    await assert.rejects(as('authenticated', A, () => q(sql)), denied('42501'), sql);
    await assert.rejects(as('authenticated', null, () => q(sql)), denied('42501'), sql);
  }
});

test('per-IP limit: 3 per hash per hour, 4th is rate_limited, other hash unaffected', async () => {
  assert.equal(await submit('h1'), 'ok');
  assert.equal(await submit('h1'), 'ok');
  assert.equal(await submit('h1'), 'ok');
  assert.equal(await submit('h1'), 'rate_limited');
  assert.equal(await submit('h2'), 'ok');
  const n = await q('select count(*)::int c from public.contact_messages');
  assert.equal(n.rows[0].c, 4);
});

test('global limit: 50 per day, 51st is rate_limited even with a fresh hash', async () => {
  for (let i = 0; i < 50; i++) assert.equal(await submit(`g${i}`), 'ok', `msg ${i}`);
  assert.equal(await submit('fresh'), 'rate_limited');
  // Rows older than a day do not count.
  await q("update public.contact_messages set created_at = now() - interval '25 hours' where ip_hash in ('g0','g1')");
  assert.equal(await submit('fresh'), 'ok');
});

test('ip_hash is nulled after 1 hour and old hashes stop counting', async () => {
  await insertRaw('old', '61 minutes');
  await insertRaw('new', '10 minutes');
  assert.equal(await submit('h1'), 'ok');
  const r = await q("select ip_hash from public.contact_messages where message='raw' order by created_at");
  assert.deepEqual(r.rows.map((x) => x.ip_hash), [null, 'new']);
  // Hashes whose window ended do not block a new message.
  for (let i = 0; i < 3; i++) await insertRaw('z', '2 hours');
  assert.equal(await submit('z'), 'ok');
});

test('retention: only rows older than 365 days are deleted, on insert', async () => {
  await insertRaw(null, '366 days');
  await insertRaw(null, '364 days');
  assert.equal((await q('select count(*)::int c from public.contact_messages')).rows[0].c, 2);
  assert.equal(await submit('h1'), 'ok');
  const r = await q("select count(*)::int c from public.contact_messages where message='raw'");
  assert.equal(r.rows[0].c, 1);
  assert.equal((await q('select count(*)::int c from public.contact_messages')).rows[0].c, 2);
});

test('field checks: lengths and empty message rejected by the table', async () => {
  await assert.rejects(submit('h1', 'x@example.invalid', ''), denied('23514'));
  await assert.rejects(submit('h1', 'x@example.invalid', 'a'.repeat(2001)), denied('23514'));
  await assert.rejects(submit('h1', 'x@example.invalid', 'm', 'n'.repeat(81)), denied('23514'));
  await assert.rejects(submit('h1', `${'e'.repeat(250)}@b.invalid`), denied('23514'));
  assert.equal(await submit('h1', 'x@example.invalid', 'a'.repeat(2000), 'n'.repeat(80)), 'ok');
});

test('admin_contact_list: newest first, limit 200, mark_read and delete', async () => {
  for (let i = 0; i < 205; i++) {
    await q(`insert into public.contact_messages (email, message, created_at)
             values ('e@example.invalid', $1, now() - ($2 || ' minutes')::interval)`, [`m${i}`, String(i)]);
  }
  const list = (await asAdmin(() => q('select * from public.admin_contact_list()'))).rows;
  assert.equal(list.length, 200);
  assert.equal(list[0].message, 'm0');
  assert.ok(!('ip_hash' in list[0]));
  const id = list[0].id;
  assert.equal(list[0].read_at, null);
  await asAdmin(() => q('select public.admin_contact_mark_read($1)', [id]));
  const after = (await asAdmin(() => q('select * from public.admin_contact_list()'))).rows[0];
  assert.notEqual(after.read_at, null);
  await asAdmin(() => q('select public.admin_contact_delete($1)', [id]));
  const gone = await q('select 1 from public.contact_messages where id=$1', [id]);
  assert.equal(gone.rows.length, 0);
});

test('contact functions: definer with pinned search_path', async () => {
  const r = await q(`select proname, prosecdef, proconfig from pg_proc
    where pronamespace='public'::regnamespace and proname like '%contact%'`);
  assert.equal(r.rows.length, 4);
  for (const f of r.rows) {
    assert.equal(f.prosecdef, true, f.proname);
    assert.ok(f.proconfig.includes('search_path=""'), f.proname);
  }
});

test('contact_submit: null or empty ip_hash is refused (per-IP limit cannot be skipped)', async () => {
  for (const hash of [null, '']) {
    await assert.rejects(submit(hash), denied('22023'));
  }
});

test('table: email shorter than 3 characters is refused', async () => {
  await assert.rejects(
    q("insert into public.contact_messages (email, message, ip_hash) values ('a@','m','h')"),
    denied('23514'));
});

// Race safety of contact_submit rests on pg_advisory_xact_lock. PGlite runs one connection,
// so concurrent submits are not exercised here (code review 2026-11-17, accepted).

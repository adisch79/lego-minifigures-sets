// V2-04 trigger and dedupe behaviour in PGlite. pg_net and vault do not exist there, so
// the dispatch step is replaced by a recorder; the real dispatch is checked for "never raises".
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(here, '..', 'migrations');
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
let db;
const q = (s, p) => db.query(s, p);
const mark = (uid, kind, id, state) =>
  q('insert into public.marks (user_id, kind, target_id, state) values ($1,$2,$3,$4)', [uid, kind, id, state]);
const sent = async () => (await q('select user_id, kind, target_id from public.sent_log order by n')).rows;

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.join(here, 'stub.sql'), 'utf8'));
  for (const f of readdirSync(migDir).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(migDir, f), 'utf8'));
  }
});

// Real dispatch function, no vault or pg_net here: must return quietly, not raise.
test('real dispatch never raises when vault and pg_net are missing', async () => {
  await q("select private.dispatch_wanted_alert($1, 'series', '71053')", [A]);
});

test('recorder installed for the remaining tests', async () => {
  await db.exec(`
    create table public.sent_log (n serial, user_id uuid, kind text, target_id text);
    create or replace function private.dispatch_wanted_alert(p_user uuid, p_kind text, p_target text)
    returns void language plpgsql as $$
    begin insert into public.sent_log (user_id, kind, target_id) values (p_user, p_kind, p_target); end; $$;`);
});

beforeEach(async () => {
  await db.exec('reset role; delete from auth.users; delete from public.allowlist;');
  await db.exec("insert into public.allowlist (email) values ('a@example.invalid'),('b@example.invalid')");
  await db.exec(`insert into auth.users (id, email) values ('${A}','a@example.invalid'),('${B}','b@example.invalid')`);
  const t = await q("select to_regclass('public.sent_log') as t");
  if (t.rows[0].t) await db.exec('delete from public.sent_log');
});

test('wanted insert alerts once; owned does not', async () => {
  await mark(A, 'series', '71053', 'owned');
  assert.deepEqual(await sent(), []);
  await mark(A, 'figure', '71053-1', 'wanted');
  assert.deepEqual(await sent(), [{ user_id: A, kind: 'figure', target_id: '71053-1' }]);
});

test('owned -> wanted on update alerts; wanted -> owned -> wanted does not repeat', async () => {
  await mark(A, 'series', '71053', 'owned');
  await q("update public.marks set state='wanted' where user_id=$1", [A]);
  assert.equal((await sent()).length, 1);
  await q("update public.marks set state='owned' where user_id=$1", [A]);
  await q("update public.marks set state='wanted' where user_id=$1", [A]);
  assert.equal((await sent()).length, 1);
});

test('delete then re-add sends nothing; other user still alerts', async () => {
  await mark(A, 'series', '71053', 'wanted');
  await q('delete from public.marks where user_id=$1', [A]);
  await mark(A, 'series', '71053', 'wanted');
  assert.equal((await sent()).length, 1);
  await mark(B, 'series', '71053', 'wanted');
  assert.equal((await sent()).length, 2);
});

test('hourly cap drops the extra alert without blocking the mark', async () => {
  for (let i = 1; i <= 21; i++) await mark(A, 'figure', `71053-${i}`, 'wanted');
  assert.equal((await sent()).length, 20);
  const m = await q('select count(*)::int c from public.marks where user_id=$1', [A]);
  assert.equal(m.rows[0].c, 21);
  // The dropped alert left no row, so it can still fire once the hour has passed.
  await q("update public.wanted_alerts set created_at = now() - interval '2 hours'");
  await q("update public.marks set state='owned' where target_id='71053-21'");
  await q("update public.marks set state='wanted' where target_id='71053-21'");
  assert.equal((await sent()).length, 21);
});

test('clients cannot touch wanted_alerts; service_role can; user delete cascades', async () => {
  await mark(A, 'series', '71053', 'wanted');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(q('select * from public.wanted_alerts'), (e) => e.code === '42501');
    await assert.rejects(q('delete from public.wanted_alerts'), (e) => e.code === '42501');
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const r = await q('select sent_at from public.wanted_alerts');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].sent_at, null);
  await q('update public.wanted_alerts set sent_at = now()');
  await db.exec('reset role');
  await db.exec(`delete from auth.users where id='${A}'`);
  assert.equal((await q('select * from public.wanted_alerts')).rows.length, 0);
});

test('alert row rejects bad id shapes', async () => {
  await assert.rejects(
    q("insert into public.wanted_alerts (user_id, kind, target_id) values ($1,'series','71053-1')", [A]),
    (e) => e.code === '23514');
});

test('trigger functions are not executable by clients', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = await q(`select p.proname from pg_proc p where p.pronamespace='private'::regnamespace
      and p.proname in ('on_wanted_mark','dispatch_wanted_alert')
      and has_function_privilege('${role}', p.oid, 'execute')`);
    assert.deepEqual(r.rows, [], role);
  }
});

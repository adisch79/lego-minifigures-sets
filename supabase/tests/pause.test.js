// V2-08: wanted-alert triggers are dropped; everything else is kept so alerts can be re-enabled.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(here, '..', 'migrations');
const A = '00000000-0000-4000-8000-00000000000a';
let db;
const q = (s, p) => db.query(s, p);
const pauseFile = () => readdirSync(migDir).find((n) => n.includes('v2_08_pause_wanted_alerts'));
const alertTriggers = async () =>
  (await q("select tgname from pg_trigger where tgrelid = 'public.marks'::regclass and tgname like 'marks_wanted_alert_%' order by tgname"))
    .rows.map((r) => r.tgname);

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.join(here, 'stub.sql'), 'utf8'));
  for (const f of readdirSync(migDir).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(migDir, f), 'utf8'));
  }
  await db.exec("insert into public.allowlist (email) values ('a@example.invalid')");
  await db.exec(`insert into auth.users (id, email) values ('${A}','a@example.invalid')`);
});

test('both alert triggers are gone after all migrations', async () => {
  assert.deepEqual(await alertTriggers(), []);
});

test('a wanted mark writes no alert row', async () => {
  await q("insert into public.marks (user_id, kind, target_id, state) values ($1,'series','71053','owned')", [A]);
  await q("update public.marks set state='wanted' where user_id=$1", [A]);
  await q("insert into public.marks (user_id, kind, target_id, state) values ($1,'figure','71053-1','wanted')", [A]);
  assert.equal((await q('select count(*)::int as n from public.wanted_alerts')).rows[0].n, 0);
});

test('functions and table are kept', async () => {
  const r = await q("select to_regproc('private.on_wanted_mark') as a, to_regproc('private.dispatch_wanted_alert') as b, to_regclass('public.wanted_alerts') as c");
  assert.ok(r.rows[0].a && r.rows[0].b && r.rows[0].c);
});

test('pause migration is idempotent', async () => {
  await db.exec(readFileSync(path.join(migDir, pauseFile()), 'utf8'));
  assert.deepEqual(await alertTriggers(), []);
});

test('re-enable statements from the header restore the triggers', async () => {
  const sql = readFileSync(path.join(migDir, pauseFile()), 'utf8')
    .split('\n').filter((l) => l.startsWith('--   ')).map((l) => l.slice(5)).join('\n');
  await db.exec(sql);
  assert.deepEqual(await alertTriggers(), ['marks_wanted_alert_insert', 'marks_wanted_alert_update']);
});

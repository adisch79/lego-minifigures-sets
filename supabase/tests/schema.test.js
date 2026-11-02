// Runs the V2-01 migration in PGlite (in-process Postgres) and checks access rules.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(here, '..', 'migrations');
const catalog = JSON.parse(readFileSync(path.join(here, '..', '..', 'app', 'public', 'catalog.json'), 'utf8'));

// Fixed throwaway ids for the test only.
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

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
  await db.exec(`insert into auth.users (id, email) values ('${A}','a@example.invalid'),('${B}','b@example.invalid')`);
});

// Run fn as a role; uid null means no session user. Always resets the role.
async function as(role, uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const asA = (fn) => as('authenticated', A, fn);
const q = (sql, params) => db.query(sql, params);
const denied = (code) => (e) => { assert.equal(e.code, code, e.message); return true; };
const insMark = (uid, kind, id, state = 'owned') =>
  q('insert into public.marks (user_id, kind, target_id, state) values ($1,$2,$3,$4)', [uid, kind, id, state]);

const TABLES = ['allowlist', 'admins', 'profiles', 'marks'];

test('anon is refused on every table', async () => {
  for (const t of TABLES) {
    await as('anon', null, async () => {
      await assert.rejects(q(`select * from public.${t}`), denied('42501'));
      await assert.rejects(q(`delete from public.${t}`), denied('42501'));
    });
  }
  await as('anon', null, () =>
    assert.rejects(insMark(A, 'series', '71053'), denied('42501')));
});

test('authenticated is refused on allowlist and admins', async () => {
  for (const t of ['allowlist', 'admins']) {
    await asA(async () => {
      await assert.rejects(q(`select * from public.${t}`), denied('42501'));
      await assert.rejects(q(`delete from public.${t}`), denied('42501'));
    });
  }
  await asA(() => assert.rejects(q("insert into public.allowlist (email) values ('x@example.invalid')"), denied('42501')));
});

test('RLS is on for all tables; allowlist and admins have no policies', async () => {
  const r = await q("select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind='r'");
  for (const t of TABLES) assert.equal(r.rows.find((x) => x.relname === t).relrowsecurity, true, t);
  const p = await q("select tablename from pg_policies where schemaname='public' and tablename in ('allowlist','admins')");
  assert.equal(p.rows.length, 0);
});

test('marks: user A cannot read, update or delete B rows', async () => {
  await insMark(B, 'series', '71053');
  await asA(async () => {
    assert.equal((await q('select * from public.marks')).rows.length, 0);
    assert.equal((await q("update public.marks set state='wanted' where user_id=$1", [B])).affectedRows, 0);
    assert.equal((await q('delete from public.marks where user_id=$1', [B])).affectedRows, 0);
  });
  const r = await q('select state from public.marks where user_id=$1', [B]);
  assert.deepEqual(r.rows, [{ state: 'owned' }]);
});

test('marks: user A cannot insert for B or move a row to B', async () => {
  await asA(async () => {
    await assert.rejects(insMark(B, 'series', '71053'), denied('42501')); // RLS with check
    await insMark(A, 'series', '71053');
    await assert.rejects(q('update public.marks set user_id=$1', [B]), denied('42501')); // column grant
  });
});

test('marks: own rows work; state update bumps updated_at; other columns not writable', async () => {
  await asA(async () => {
    await insMark(A, 'figure', '71053-1');
    const before = (await q('select updated_at from public.marks')).rows[0].updated_at;
    await new Promise((r) => setTimeout(r, 20));
    await q("update public.marks set state='wanted'");
    const after = (await q('select state, updated_at from public.marks')).rows[0];
    assert.equal(after.state, 'wanted');
    assert.ok(after.updated_at > before);
    await assert.rejects(q("update public.marks set target_id='71053-2'"), denied('42501'));
    await assert.rejects(q("update public.marks set kind='series'"), denied('42501'));
    await assert.rejects(q('update public.marks set updated_at=now()'), denied('42501'));
    assert.equal((await q('delete from public.marks')).affectedRows, 1);
  });
});

test('profiles: row created on user insert, takes nothing from metadata', async () => {
  await q(`insert into auth.users (id, email, raw_user_meta_data)
           values (gen_random_uuid(), 'c@example.invalid', '{"display_name":"evil","is_admin":true}')`);
  const r = await q("select display_name from public.profiles where user_id = (select id from auth.users where email='c@example.invalid')");
  assert.deepEqual(r.rows, [{ display_name: null }]);
  assert.equal((await q('select count(*)::int n from public.profiles')).rows[0].n, 3);
  assert.equal((await q('select count(*)::int n from public.admins')).rows[0].n, 0);
});

test('profiles: display_name updates; other columns, other rows, insert refused', async () => {
  await asA(async () => {
    assert.equal((await q('select * from public.profiles')).rows.length, 1); // other profile unreadable
    await q("update public.profiles set display_name='Ann'");
    assert.equal((await q('select display_name from public.profiles')).rows[0].display_name, 'Ann');
    await assert.rejects(q('update public.profiles set user_id=$1', [B]), denied('42501'));
    await assert.rejects(q('update public.profiles set created_at=now()'), denied('42501'));
    assert.equal((await q("update public.profiles set display_name='x' where user_id=$1", [B])).affectedRows, 0);
    await assert.rejects(q('insert into public.profiles (user_id) values (gen_random_uuid())'), denied('42501'));
    await assert.rejects(q('delete from public.profiles'), denied('42501'));
    await assert.rejects(q('update public.profiles set display_name=$1', ['x'.repeat(51)]), denied('23514'));
    await q('update public.profiles set display_name=$1', ['x'.repeat(50)]);
  });
  const b = await q('select display_name from public.profiles where user_id=$1', [B]);
  assert.equal(b.rows[0].display_name, null);
});

test('admins: a user cannot add themselves', async () => {
  await asA(() => assert.rejects(q('insert into public.admins (user_id) values ($1)', [A]), denied('42501')));
  assert.equal((await q('select count(*)::int n from public.admins')).rows[0].n, 0);
});

test('constraints refuse bad kind, state, id shape and kind/id mismatch', async () => {
  const bad = [
    ['thing', '71053', 'owned'],
    ['series', '71053', 'lost'],
    ['series', '123', 'owned'],
    ['series', '1234567', 'owned'],
    ['series', '71053-1', 'owned'], // figure id on series kind
    ['figure', '71053', 'owned'], // series id on figure kind
    ['figure', '71053-', 'owned'],
    ['figure', '71053-x', 'owned'],
  ];
  for (const [k, id, s] of bad) {
    await assert.rejects(insMark(A, k, id, s), denied('23514'), `${k} ${id} ${s}`);
  }
  await insMark(A, 'series', '71053');
  await insMark(A, 'figure', '71053-12', 'wanted');
  await assert.rejects(insMark(A, 'series', '71053'), denied('23505')); // primary key
});

test('allowlist: email must be lower case', async () => {
  await assert.rejects(q("insert into public.allowlist (email) values ('Mixed@Example.invalid')"), denied('23514'));
  await q("insert into public.allowlist (email) values ('ok@example.invalid')");
});

test('marks cap: 2000 rows per user, 2001st refused, other user unaffected', async () => {
  // SOURCE: cap of 2000 from docs/design/V2-01-schema.md.
  await q(`insert into public.marks (user_id, kind, target_id, state)
           select $1, 'series', (100000 + g)::text, 'owned' from generate_series(1, 2000) g`, [A]);
  await assert.rejects(insMark(A, 'series', '99999'), denied('54000'));
  await asA(() => assert.rejects(insMark(A, 'series', '99998'), denied('54000')));
  await insMark(B, 'series', '99999');
  await q('delete from public.marks where user_id=$1 and target_id=$2', [A, '100001']);
  await insMark(A, 'series', '99999'); // room again after a delete
});

test('every catalog id passes the constraints', async () => {
  const series = catalog.series.map((s) => s.id);
  const figures = catalog.series.flatMap((s) => s.figures.map((f) => f.id));
  assert.equal(series.length + figures.length, 839);
  await q(`insert into public.marks (user_id, kind, target_id, state)
           select $1, 'series', x, 'owned' from unnest($2::text[]) x`, [A, series]);
  await q(`insert into public.marks (user_id, kind, target_id, state)
           select $1, 'figure', x, 'wanted' from unnest($2::text[]) x`, [B, figures]);
  const n = await q('select count(*)::int n from public.marks');
  assert.equal(n.rows[0].n, 839);
});

test('cascade: deleting a user removes profile, marks and admin row', async () => {
  await insMark(A, 'series', '71053');
  await q('insert into public.admins (user_id) values ($1)', [A]);
  await q('delete from auth.users where id=$1', [A]);
  for (const t of ['profiles', 'marks', 'admins']) {
    assert.equal((await q(`select count(*)::int n from public.${t} where user_id=$1`, [A])).rows[0].n, 0, t);
  }
  assert.equal((await q('select count(*)::int n from public.profiles where user_id=$1', [B])).rows[0].n, 1);
});

test('private functions are not callable by client roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await q(`select has_schema_privilege('${role}','private','usage') u`)).rows[0].u, false);
    for (const fn of ['handle_new_user', 'set_updated_at', 'enforce_marks_cap']) {
      assert.equal((await q(`select has_function_privilege('${role}','private.${fn}()','execute') x`)).rows[0].x, false, `${role} ${fn}`);
    }
  }
  await asA(() => assert.rejects(q('select private.handle_new_user()'), denied('42501')));
  // Even with schema usage granted, the function-level revoke still refuses.
  await db.exec('grant usage on schema private to authenticated');
  try {
    await asA(() => assert.rejects(q('select private.handle_new_user()'), denied('42501')));
  } finally {
    await db.exec('revoke usage on schema private from authenticated');
  }
});

test('definer functions pin an empty search_path', async () => {
  const r = await q("select proname, proconfig from pg_proc where pronamespace='private'::regnamespace");
  assert.equal(r.rows.length, 3);
  for (const f of r.rows) assert.ok(f.proconfig.includes('search_path=""'), f.proname);
});

test('none of the tables is in the realtime publication', async () => {
  const r = await q("select tablename from pg_publication_tables where pubname='supabase_realtime'");
  assert.equal(r.rows.length, 0);
});

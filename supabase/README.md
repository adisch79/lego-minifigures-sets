# supabase/

Database layer for V2-01 (see `docs/design/V2-01-schema.md`): tables `allowlist`, `admins`, `profiles`, `marks`, grants, row level security, constraints and triggers.

## Contents
- `migrations/20261102000000_v2_01_schema.sql` - the migration. Contains no emails, admin ids or secrets.
- `config.toml` - records the intended auth settings (signups off, email only). Live settings are not changed by this file; the live smoke test in the design doc checks them. `supabase config push` is not part of the process: it would apply this file and defaults for anything unset.
- `tests/stub.sql` - TEST FIXTURE ONLY. Fakes the parts Supabase provides (`auth` schema, `auth.users`, `auth.uid()`, roles). Never apply it to a real project.
- `tests/schema.test.js` - runs stub + migration in PGlite (in-process Postgres, no Docker) and checks the access rules.

## Install (tests)
Needs Node 20+.

    cd supabase
    npm ci

## Run the tests

    cd supabase
    npm test

## Apply to a project
Not done by this folder's tooling. Applying to the live project is a separate, owner-approved step.
The owner's admin row is added by one-off SQL, never in a migration.

## Not covered yet
Admin RPCs (V2-05), alerts (V2-04) and the private-function checks that depend on them. Auth settings (signups off) live outside migrations and need a live smoke test. PGlite has one connection, so the cap's advisory lock is not tested under real concurrency.

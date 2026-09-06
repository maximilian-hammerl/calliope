# Database

Postgres 18, migrated with [dbmate](https://github.com/amacneil/dbmate), typed with
`kysely-codegen`. The shared conventions are in the root [AGENTS.md](../AGENTS.md).

```bash
deno task migrations:migrate      # apply what is pending
deno task migrations:new <name>   # a new file
deno task db:reset                # drop, recreate, migrate — wipes every row
deno task types:generate          # regenerate backend/src/database/schema.ts
deno task test                    # against the database in .env; needs the stack up
deno task validate:check
```

## Migrations are edited in place — until a staging or production instance exists

The rule hangs on the environments, not on how finished the product feels. `PUBLIC_ENVIRONMENT` is
`development`, `testing`, `staging` or `production`, and a `testing` instance is one whose database
is reset when a migration calls for it. **While the only deployed instance is `testing`**, a schema
change edits the migration that created the table rather than stacking an `ALTER` on it, so the
files stay one definition per table. **The day `staging` or `production` runs, this stops**: a
change is a new migration and an applied file is never touched again.

Editing in place is permission, not obligation — **a purely additive change is clearer as its own
file**, and needs no rebuild. dbmate records a migration by version and will not re-run an edited
one, so an edit means everyone rebuilds: **`/db-reset`** (`.claude/skills/db-reset/`) does it in the
right order — stop the backend, drop and migrate, regenerate and format the types, seed, restart. It
drops **everything**, hand-made accounts included, and signs every browser out, so say so before
running it against a database somebody else is using. `deployment/deploy.sh` does the same on
`testing` when it detects an edited migration, and refuses elsewhere.

**Every `migrate:down` must reverse its `migrate:up`**, enum types and trigger functions included.
Prove it on a throwaway database — `dbmate --url …/calliope_scratch up`, `down` through the file,
`up` again; `CREATE TYPE` and `CREATE FUNCTION` fail if the down left anything behind.

## After a migration

`deno task types:generate`, format the backend (the generator's output is not `deno fmt`-clean), and
commit the regenerated `schema.ts`. An added column then surfaces as a compile error wherever a route
promises it and the service does not select it — which is the point. The backend's OpenAPI document
and the frontend's client follow; the root file names the order.

## What the schema does and does not have

- **Only `user` and `user_session` carry `updated_at`**, as a debugging convenience, and they are the
  only tables with a `set_updated_at` trigger. Nothing else has one, and a new table does not get one:
  a column nobody reads drifts into being trusted. Where a time matters it is named for what it
  means — `last_activity_at`, `edited_at`, `invited_at`.
- **No pgcrypto.** Passwords and tokens are hashed in the backend; `uuidv7()` and
  `gen_random_uuid()` are core. Do not reach for `crypt()` or `digest()` in a migration.
- **Every referencing column of a foreign key has an index**, partial on `IS NOT NULL`; Postgres
  indexes only the referenced side. `.claude/rules/database/migrations.md` has the query that finds
  what is missing — run it after adding a table.
- **`json` and `jsonb` generate as `unknown`**, deliberately: the recursive `Json` type exhausts
  TypeScript's instantiation budget in a route response with an error naming neither column nor
  route. Select such a column through `$castTo<…>()`.

## Triggers

A trigger body is not checked until it runs, so exercise every path before believing it, and prove
a new trigger test fails with the trigger disabled before trusting the test. `NEW IS NOT NULL` is
true only when *every* field is; dispatch on `TG_OP`. `UPDATE OF col` fires when the column is
written, not when its value changes. Same-event triggers fire in alphabetical order of their names.
Bodies carry `set search_path to ''`. The rest is in `.claude/rules/database/migrations.md`.

## Tests

`test/*_test.ts`, through `pg` rather than Kysely, because what they assert is the database's own
behaviour and a failure should point at the SQL. Rows carry a `db-test-` prefix and are removed
afterwards, so the suite runs against a development database. Give every query its row type and read
the first row through `firstRow()`; compare timestamps as `extract(epoch …)`, never as a Date.
`deno lint` here enforces `prefer-ascii` and `no-await-in-loop`; a sequential loop that has to be one
carries a `deno-lint-ignore` with its reason as the **last** comment line before the statement.

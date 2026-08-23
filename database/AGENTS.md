# Database

Postgres 18, migrated with [dbmate](https://github.com/amacneil/dbmate), typed with
`kysely-codegen`. Tasks are `deno task …` — see the root [AGENTS.md](../AGENTS.md) for the
conventions shared with the other projects.

## Migrations may be edited in place until a staging or production instance exists

The rule hangs on the environments, not on a feeling about how finished the product is.
`ENVIRONMENT` is one of `development`, `testing`, `staging` or `production`, and a `testing`
instance is one whose database is reset when a migration calls for it — that is what the word
means here, and it is written into `.env.deploy.example`.

**While the only deployed instance is `testing`**, a schema change is made **by editing the
migration that created the table** rather than by stacking an `ALTER` on top. The files stay
readable as one definition per table, which is worth more right now than a history nobody will
ever replay. Today that is where Calliope is.

**The day a `staging` or `production` instance runs, this stops.** Neither is reset for a
migration, so from then on a schema change is a new migration, `migrate:down` matters, and an
applied file is never touched again.

dbmate records a migration by version and will not re-run an edited one, so an edited file means
the database has to be rebuilt — that is the cost, and it is the whole cost:

```bash
cd database && dbmate --env-file ../.env drop && dbmate --env-file ../.env up
deno task types:generate && cd ../backend && deno task db:seed
```

It drops **everything**, hand-made test accounts and rows included, so say so before doing it to
somebody else's database. A deployed instance is dropped the same way — `deployment/deploy.sh`
detects an edited migration and does it, but only on `testing`, and refuses elsewhere. Stop the
backend first or open connections block the drop.

**Editing in place is permission, not obligation.** A change that adds something new rather than
altering something existing is clearer as its own migration even while editing is still allowed:
nothing has to be rebuilt, and the file reads as the feature it belongs to. Prefer a new
migration whenever the change is purely additive.

Every `migrate:down` must actually reverse its `migrate:up`, including dropping enum types
and trigger functions. Test the round trip against a throwaway database rather than the one
you are working in.

## No pgcrypto

Passwords and session tokens are hashed in the backend, so nothing in the schema needs the
extension — `uuidv7()` and `gen_random_uuid()` are core in Postgres 18. Do not reach for
`crypt()` or `digest()` in a migration; hashing belongs where the plaintext already is.

## Triggers

New tables need a `set_updated_at` trigger, or `updated_at` never changes:

```sql
CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.thing
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Writing-group and thread activity is tracked separately in `last_activity_at`, which a child
row's insert, update or delete bumps on its parent. Note the side effect: because that is a
real `UPDATE` on the parent, `updated_at` moves with it, so on those two tables `updated_at`
no longer means "this row's own fields were edited".

**A trigger function's body is not checked until it runs.** `dbmate migrate` succeeding
proves only that the DDL parsed. Exercise every path — insert, update, delete and a cascade —
before believing it.

Two mistakes that pass review easily:

- **`NEW IS NOT NULL` does not mean what it looks like.** For a *record*, `IS NOT NULL` is
  true only when every field is non-null, so one nullable column sends it down the wrong
  branch. Dispatch on `TG_OP` instead.
- **Column names are only resolved at execution time**, so `NEW.group_id` against a column
  actually called `writing_group_id` migrates cleanly and fails on the first insert.

## Tests

`test/` holds them, run with `deno task test`. They talk to Postgres directly through `pg`
rather than through the backend's Kysely client, because what they assert is the database's
own behaviour — triggers, cascades, constraints — and a failure should point at the SQL.

Rows are named with a `db-test-` prefix and removed afterwards, so the suite can run against
a development database without taking anything else with it. Point `DATABASE_URL` at a
throwaway database when the schema is mid-change.

Prove a new trigger test fails without its trigger before trusting it — `ALTER TABLE … 
DISABLE TRIGGER` is enough. Compare timestamps as `extract(epoch …)`, never as the driver's
Date: its string form compares lexicographically and orders "Tue" before "Wed".

## pg is typed, so name the row

`@types/pg` is in the import map and `test/support.ts` pulls it in with `// @ts-types`. Without
it every `client.query(...)` returned `any`, so a column that did not exist type-checked
happily and failed at run time -- which is exactly how a column rename broke
this suite while all three projects reported clean.

Two things follow. Give every query its row type -- `client.query<{ id: string }>(...)` -- or
the generic defaults to `any` and the types buy nothing. And read the first row through
`firstRow(rows)`: with `noUncheckedIndexedAccess` on, `rows[0]` is `T | undefined`, and an
empty result in a test is a broken test rather than a missing value, so it should say so
instead of failing later on a property of undefined.

## Regenerating types

After any migration:

```bash
deno task types:generate
```

Commit the regenerated `backend/src/database/schema.ts`. Its output is not `deno fmt`-clean,
so format the backend afterwards. Because the backend builds its request and response schemas
from that file, an added column surfaces as a compile error wherever a route promises it but
the service does not select it — which is the point.

## Serialiser

`kysely_zod_serializer.ts` emits both the Kysely types and the zod schemas. Column comments
become `.describe()`, and enum values and comments are escaped through `JSON.stringify`, so
an apostrophe in a comment cannot break the generated file.

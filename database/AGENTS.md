# Database

Postgres 18, migrated with [dbmate](https://github.com/amacneil/dbmate), typed with
`kysely-codegen`. Tasks are `deno task …` — see the root [AGENTS.md](../AGENTS.md) for the
conventions shared with the other projects.

## Migrations may be edited in place until a staging or production instance exists

The rule hangs on the environments, not on a feeling about how finished the product is.
`ENVIRONMENT` is one of `development`, `testing`, `staging` or `production`, and a `testing`
instance is one whose database is reset when a migration calls for it — that is what the word
means here, and it is written into `.example.deploy.env`.

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

## `json` and `jsonb` generate as `unknown`

`typeMapping` in `.kysely-codegenrc.ts` maps both to `unknown` rather than letting kysely-codegen
emit its own `Json` type. That type is a recursive union, and a recursive type in a route's
response exhausts TypeScript's instantiation budget: `@hono/zod-openapi` fails with **TS2589**,
whose message names neither the column nor the route, and because the budget is global the route
it lands on moves as unrelated code changes.

`unknown` forces the reader to say what the column holds, which is what a Zod schema does anyway —
`writing_post.document` is validated by `backend/src/document/document_schema.ts` and typed by its
`PostDocument`. Selecting such a column takes a `$castTo<…>()`, which is the one line of ceremony
this costs and the right place for the assertion to live.

`columnOverrides` in the same file is the per-column escape hatch, for a column whose database
type maps to no schema at all. Prefer `typeMapping` where the rule is about the *type*: an
override has to be remembered for every future column, and a forgotten one fails confusingly.

## A cascading foreign key needs an index of its own

Postgres indexes the *referenced* side of a foreign key and nothing on the referencing side, so a
delete scans the whole table once per deleted row to find what points at it. `ON DELETE SET NULL`
counts too: the rows still have to be found before they can be nulled.

Index every reference, **partial on `<column> IS NOT NULL`** — an equality lookup still uses it,
since `col = $1` implies the predicate, so there is no judgement to make per column.

**Read the constraints, not the columns.** `notification` looked like it needed five and needed
three: two of its columns are halves of composites pointing at the *membership*, so those cascades
search by `(recipient_id, …)` and an existing index leads them. `pg_get_constraintdef` says which.

**A partial index only counts if its predicate is the column being present.** `report`'s
`report_one_open_per_reporter_and_category_idx` leads with `reporter_id` and still cannot find a
member's reports, because `reporter_id = $1` does not imply its `closed_at IS NULL`.

Four things make the measurement lie, all hit here: a small table answers `Seq Scan` whatever
exists, so fill a throwaway copy to a hundred thousand rows; `LIKE … INCLUDING ALL` copies the
indexes, so the "before" case already has the one under test; `WHERE col = uuidv7()` is volatile
and never uses an index; and plain `LIKE` needs `INCLUDING DEFAULTS` and `INCLUDING GENERATED`.

This finds what is left, and is worth running after adding a table:

```sql
WITH fk AS (
  SELECT c.conrelid::regclass::text AS tbl,
         (SELECT a.attname FROM pg_attribute a
           WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS first_col
  FROM pg_constraint c
  WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
), led AS (
  SELECT i.indrelid::regclass::text AS tbl,
         (SELECT a.attname FROM pg_attribute a
           WHERE a.attrelid = i.indrelid AND a.attnum = i.indkey[0]) AS first_col
  FROM pg_index i
  WHERE i.indpred IS NULL OR pg_get_expr(i.indpred, i.indrelid) LIKE '%IS NOT NULL%'
)
SELECT fk.tbl, fk.first_col FROM fk
WHERE NOT EXISTS (SELECT 1 FROM led WHERE led.tbl = fk.tbl AND led.first_col = fk.first_col)
ORDER BY 1, 2;
```

It reports the FK's *first* column, which is the one an index has to lead with.

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

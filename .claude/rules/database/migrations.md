---
paths:
  - "database/migrations/**"
  - "database/test/**"
---

# Writing a migration

## A cascading foreign key needs an index of its own

Postgres indexes the *referenced* side of a foreign key and nothing on the referencing side, so a
delete scans the whole table once per deleted row to find what points at it — `ON DELETE SET NULL`
included. **Index every reference, partial on `<column> IS NOT NULL`**; an equality lookup still
uses it, so there is no judgement per column.

**Read the constraints, not the columns.** `notification` looked like it needed five and needed
three: two columns are halves of composites pointing at the *membership*, and an existing index
leads those. `pg_get_constraintdef` says which. **A partial index only counts if its predicate is the
column being present** — `report`'s open-report index leads with `reporter_id` and still cannot find
a member's reports, because `reporter_id = $1` does not imply its `closed_at IS NULL`.

Four things make the measurement lie: a small table answers `Seq Scan` whatever exists, so fill a
throwaway copy to a hundred thousand rows; `LIKE … INCLUDING ALL` copies the indexes, so "before"
already has the one under test; `WHERE col = uuidv7()` is volatile and never uses an index; plain
`LIKE` needs `INCLUDING DEFAULTS` and `INCLUDING GENERATED`.

This finds what is left; run it after adding a table:

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

## Triggers

**A trigger function's body is not checked until it runs.** `dbmate migrate` succeeding proves only
that the DDL parsed. Exercise every path — insert, update, delete, cascade — before believing it,
and prove the test fails with `ALTER TABLE … DISABLE TRIGGER` before trusting the test.

- **`NEW IS NOT NULL` does not mean what it looks like.** For a record it is true only when *every*
  field is non-null, so one nullable column sends it down the wrong branch. Dispatch on `TG_OP`.
- **Column names are resolved at execution time**, so `NEW.group_id` against a column called
  `writing_group_id` migrates cleanly and fails on the first insert.
- **`UPDATE OF col` fires when the column is written, not when its value changes.** A cascade that
  touches a child's own column to make its BEFORE trigger recompute relies on that; the `WHEN (OLD.x
  IS DISTINCT FROM NEW.x)` on the AFTER trigger is what terminates the walk.
- Same-event triggers on one table fire in **alphabetical order** of their names.
- Every function body carries `set search_path to ''`, like the existing ones.

`last_activity_at` on groups, threads, pages and chats is bumped by a child row's insert, update or
delete. `LEAST` over an enum declared most-restrictive-first *is* "most restrictive", and it ignores
nulls — which is how the forum's `effective_member_permission` is derived.

## What a composite foreign key cannot say

"Both null, or both the same" — the forum's scope — is expressible by neither `MATCH SIMPLE` (skips a
null key) nor `MATCH FULL` (rejects a mixed one), and a CHECK cannot reach another table. That is
why `20260903140000_folder_scope.sql` is triggers.

## Tests

`test/` talks to Postgres through `pg`, not Kysely, because what it asserts is the database's own
behaviour and a failure should point at the SQL. Rows carry a `db-test-` prefix and are removed
afterwards. Compare timestamps as `extract(epoch …)`, never as the driver's Date — its string form
orders "Tue" before "Wed". Give every query its row type, `client.query<{ id: string }>(…)`, or
the generic defaults to `any`; read the first row through `firstRow(rows)`, since with
`noUncheckedIndexedAccess` an empty result should say so rather than fail on a property of undefined.

---
name: test
description: Run the backend, frontend and database test suites against the local stack and report the three counts. Checks the stack is up and migrated first.
user-invocable: true
---

Run all three suites and report the counts. Optional `$ARGUMENTS` name a subset: `backend`,
`frontend`, `database`, or a path to one test file.

1. **Precondition.** The backend and database suites need Postgres, Redis and Mailpit running and
   the migrations applied. Check with `docker compose ps` at the repo root and
   `deno task migrations:status` in `database/`; if the stack is down, `docker compose up -d --wait`
   and `deno task migrations:migrate`. A failing suite with the stack down looks like a hundred
   unrelated errors — check this before reading any of them.
2. Run, each from its own directory:
   - `backend/`: `deno task test` — runs `--parallel`; a file that shares a username, address or
     mailbox with another fails here, which is the point
   - `frontend/`: `npx vitest run`
   - `database/`: `deno task test`
3. Report the three totals (passed / failed) and, for each failure, the test name and the assertion
   message verbatim.

The suites run against this checkout's development database and clean up their own rows; they do
not need a reset first. If they leave rows behind, that is a bug in a test's cleanup, not a reason to
reset.

---
name: workflow-validate
description: Run what CI runs (.github/workflows/validate.yml) for the projects a change touches — format, lint, types, the OpenAPI and schema checks, the migration round trip and the tests — and report what passed, what failed and what did not run. Use before calling a change done, or when asked to check, validate or test. Pass --fix to repair what can be repaired first; backend, database or frontend to run only those.
user-invocable: true
allowed-tools: Bash(git status *), Bash(git merge-base *), Bash(git diff *), Bash(git ls-files *), Bash(git worktree list*), Bash(git hash-object *), Bash(docker compose ps*), Bash(docker compose -p * ps*), Bash(docker compose up -d --wait*), Bash(npm ci), Bash(deno task db:up), Bash(deno task validate:*), Bash(deno task open-api:check), Bash(deno task open-api:generate), Bash(deno task migrations:status), Bash(deno task migrations:migrate), Bash(deno task test), Bash(deno fmt src/database/schema.ts), Bash(dbmate --env-file ../.env --url *calliope_scratch*), Bash(DATABASE_URL=*calliope_scratch* DBMATE_NO_DUMP_SCHEMA=true deno task migrations:*), Bash(DATABASE_URL=*calliope_scratch* deno task types:generate), Bash(npm run validate:*), Bash(npm run open-api:generate-client), Bash(npm run test:unit *)
---

`$ARGUMENTS` may hold `--fix` and any of `backend`, `database`, `frontend`. Keep going after a
failure, so the report is complete.

1. **What changed**, unless projects were named: `git merge-base origin/main HEAD`, then
   `git diff --name-only <that commit>` and `git ls-files --others --exclude-standard`, so a
   branch's commits count as well as the working tree.
2. **What runs**, each from its project's directory:

   | Changed | Run |
   | --- | --- |
   | `backend/**` | `deno task validate:check`, `deno task open-api:check`, `deno task test` |
   | `database/**` | `deno task validate:check`, `deno task test`, and step 5 |
   | `database/migrations/**` | also the backend's three |
   | `frontend/**` or `backend/open-api.json` | `npm run open-api:generate-client`, `npm run validate:check`, `npm run test:unit -- --run` |
   | only `*.md`, `docs/**` or `.claude/**` | nothing; say so |
   | anything else (`docker-compose.yaml`, `.example.env`, `.github/**`, …) | all three projects |

   `open-api:check` fails whenever `open-api.json` has uncommitted changes, even correct ones.
   Then note its `git hash-object`, run `deno task open-api:generate` and check the hash didn't
   move.
3. **The setup**, before anything that needs it:
   - **A worktree** (one the desktop app made, or a review's) has no `.env`: copy the main
     checkout's (`git worktree list` names it first). If the change edits migrations, the copy's
     `DATABASE_URL` names a database of the worktree's own, which `deno task db:up` in `database/`
     creates and migrates. Without `frontend/node_modules`, `npm ci` in `frontend/`.
   - **The containers** are the main checkout's: Compose names its project after the directory, so
     from a worktree check them with `docker compose -p <main checkout's directory name> ps`. If
     they're down, `docker compose up -d --wait` in the main checkout.
   - **The migrations applied:** `deno task migrations:status` in `database/`, else
     `deno task migrations:migrate`. A migration edited in place leaves the database stale and the
     tests fail on the old schema: ask before `/db-reset`, which wipes it. Rows a test leaves behind
     are a bug in its cleanup, not a reason to reset.
4. **With `--fix`**, first `deno task validate:fix` in each Deno project that runs and
   `npm run validate:fix` in `frontend/`. List the files it changed; stage nothing.
5. **After a change in `database/`**, on a scratch database, as CI builds its own:
   `<scratch>` is `.env`'s `DATABASE_URL` with the database named `calliope_scratch`. From
   `database/`, dropped first in case an interrupted run left it behind:

   ```bash
   dbmate --env-file ../.env --url "<scratch>" drop
   dbmate --env-file ../.env --url "<scratch>" create
   DATABASE_URL="<scratch>" DBMATE_NO_DUMP_SCHEMA=true deno task migrations:migrate
   ```

   - **If a migration changed**, roll every one back and migrate again; a failure is a
     `migrate:down` that doesn't reverse its `migrate:up`:

     ```bash
     for m in migrations/*.sql; do DATABASE_URL="<scratch>" DBMATE_NO_DUMP_SCHEMA=true deno task migrations:rollback || exit 1; done
     DATABASE_URL="<scratch>" DBMATE_NO_DUMP_SCHEMA=true deno task migrations:migrate
     ```

   - **`schema.ts`**: note `git hash-object ../backend/src/database/schema.ts`, run
     `DATABASE_URL="<scratch>" deno task types:generate` and check that its output names
     `../backend/src/database/schema.ts`; another path means it didn't find its config, which is a
     failure. Then `deno fmt src/database/schema.ts` in `backend/` and compare the hash. If it
     moved, the file was stale: say so; the regenerated one is what to commit, and `/regenerate`
     carries it downstream.
   - Finally `dbmate --env-file ../.env --url "<scratch>" drop`.
6. **Report** one row per command: project, command, passed or failed, and for a failure the first
   error verbatim, never "some lint errors"; for a failing test, its name and assertion message.
   End with what didn't run and why.

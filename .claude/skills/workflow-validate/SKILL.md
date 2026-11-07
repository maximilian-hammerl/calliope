---
name: workflow-validate
description: Run what CI runs (.github/workflows/validate.yml) for the projects a change touches — format, lint, types, the OpenAPI and schema checks, the migration round trip and the tests — and report what passed, what failed and what did not run. Use before calling a change done, or when asked to check, validate or test. Pass --fix to repair what can be repaired first; backend, database or frontend to run only those.
user-invocable: true
allowed-tools: Bash(git status *), Bash(git merge-base *), Bash(git diff *), Bash(git ls-files *), Bash(git hash-object *), Bash(docker compose ps*), Bash(docker compose up -d --wait*), Bash(deno task validate:*), Bash(deno task open-api:check), Bash(deno task open-api:generate), Bash(deno task migrations:status), Bash(deno task migrations:migrate), Bash(deno task test), Bash(deno fmt src/database/schema.ts), Bash(dbmate --env-file ../.env --url *calliope_scratch*), Bash(npm run validate:*), Bash(npm run open-api:generate-client), Bash(npm run test:unit *)
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
   | `database/**` | `deno task validate:check`, `deno task test` |
   | `database/migrations/**` | also step 5 |
   | `frontend/**` or `backend/open-api.json` | `npm run open-api:generate-client`, `npm run validate:check`, `npm run test:unit -- --run` |
   | only `*.md`, `docs/**` or `.claude/**` | nothing; say so |
   | anything else (`docker-compose.yaml`, `.example.env`, `.github/**`, …) | all three projects |

3. **The stack**, before the backend's or the database's tests: Postgres, Redis and Mailpit up
   (`docker compose ps` at the root, else `docker compose up -d --wait`) and the migrations applied
   (`deno task migrations:status` in `database/`, else `deno task migrations:migrate`). A migration
   edited in place leaves the development database stale and the tests fail on the old schema: ask
   before `/db-reset`, which wipes it. Rows a test leaves behind are a bug in its cleanup, not a
   reason to reset.
4. **With `--fix`**, first `deno task validate:fix` in each Deno project that runs and
   `npm run validate:fix` in `frontend/`. List the files it changed; stage nothing.
5. **After a migration change**, on a scratch database: rolling back the development one would
   wipe it. `<scratch>` is `.env`'s `DATABASE_URL` with the database named `calliope_scratch`.
   From `database/`:

   ```bash
   dbmate --env-file ../.env --url "<scratch>" --no-dump-schema up
   for m in migrations/*.sql; do dbmate --env-file ../.env --url "<scratch>" --no-dump-schema rollback || break; done
   dbmate --env-file ../.env --url "<scratch>" --no-dump-schema migrate
   ```

   A failure is a `migrate:down` that doesn't reverse its `migrate:up`. Then check `schema.ts` as
   CI does: note `git hash-object ../backend/src/database/schema.ts`, generate from the scratch
   database with
   `DATABASE_URL="<scratch>" deno run --allow-sys --allow-env --allow-read --allow-write --allow-net npm:kysely-codegen`,
   run `deno fmt src/database/schema.ts` in `backend/`, and compare. If it moved, the file was
   stale: say so; the regenerated one is what to commit, and `/regenerate` carries it downstream.
   Finally `dbmate --env-file ../.env --url "<scratch>" drop`.
6. **Report** one row per command: project, command, passed or failed, and for a failure the first
   error verbatim, never "some lint errors"; for a failing test, its name and assertion message.
   End with what didn't run and why.

`open-api:check` fails whenever `open-api.json` has uncommitted changes, even correct ones. Then
note its `git hash-object`, run `deno task open-api:generate` and check the hash didn't move.

---
name: workflow-validate
description: Run what CI runs (.github/workflows/validate.yml) for the projects a change touches — format, lint, types, the OpenAPI and schema checks, the migration round trip and the tests — and report what passed, what failed and what did not run. Use before calling a change done, or when asked to check, validate or test. Pass --fix to repair what can be repaired first; backend, database or frontend to run only those.
user-invocable: true
allowed-tools: Bash(git status *), Bash(git merge-base *), Bash(git diff *), Bash(git ls-files *), Bash(git worktree list*), Bash(git hash-object *), Bash(docker compose ps*), Bash(docker compose up -d --wait*), Bash(pnpm install), Bash(pnpm run stack:prune), Bash(pnpm run stack:up), Bash(pnpm run open-api:check), Bash(pnpm run open-api:generate), Bash(pnpm run migrations:status), Bash(pnpm run migrations:migrate), Bash(pnpm run test), Bash(pnpm exec oxfmt src/database/schema.ts), Bash(pnpm exec dbmate --env-file ../.env --url *calliope_scratch*), Bash(DATABASE_URL=*calliope_scratch* DBMATE_NO_DUMP_SCHEMA=true pnpm run migrations:*), Bash(DATABASE_URL=*calliope_scratch* pnpm run types:generate), Bash(pnpm run validate:*), Bash(pnpm run open-api:generate-client), Bash(pnpm run test:unit *)
---

`$ARGUMENTS` may hold `--fix` and any of `backend`, `database`, `frontend`. Keep going after a
failure, so the report is complete.

1. **What changed**, unless projects were named: `git merge-base origin/main HEAD`, then
   `git diff --name-only <that commit>` and `git ls-files --others --exclude-standard`, so a
   branch's commits count as well as the working tree.
2. **What runs**, each from its project's directory:

   | Changed | Run |
   | --- | --- |
   | `backend/**` | `pnpm run validate:check`, `pnpm run open-api:check`, `pnpm run test` |
   | `database/**` | `pnpm run validate:check`, `pnpm run test`, and step 5 |
   | `database/migrations/**` | also the backend's three |
   | `frontend/**` or `backend/open-api.json` | `pnpm run open-api:generate-client`, `pnpm run validate:check`, `pnpm run test:unit --run` |
   | only `*.md`, `docs/**` or `.claude/**` | nothing; say so |
   | anything else (`docker-compose.yaml`, `.example.env`, `.github/**`, …) | all three projects |

   `open-api:check` fails whenever `open-api.json` has uncommitted changes, even correct ones.
   Then note its `git hash-object`, run `pnpm run open-api:generate` and check the hash didn't
   move.
3. **The setup**, before anything that needs it:
   - **Without `node_modules`** at the root, `pnpm install` there.
   - **A worktree** (one the desktop app made, or a review's) runs on a stack of its own, set up at
     its root every time: `pnpm run stack:prune`, which removes the stacks of worktrees that are
     gone, then `pnpm run stack:up`, which writes the worktree's ports to `.env` (copied from
     `.example.env` when there is none), starts its containers and migrates its database. A tree
     older than `scripts/stack.sh` runs the main checkout's copy from its root instead
     (`<main checkout>/scripts/stack.sh prune`, then `up`; `git worktree list` names it first).
   - **The main checkout:** if `docker compose ps` lists its containers as down,
     `docker compose up -d --wait`.
   - **The migrations applied:** `pnpm run migrations:status` in `database/`, else
     `pnpm run migrations:migrate`. A migration edited in place leaves the database stale and the
     tests fail on the old schema: ask before `/db-reset`, which wipes it. Rows a test leaves behind
     are a bug in its cleanup, not a reason to reset.
4. **With `--fix`**, first `pnpm run validate:fix` in each project that runs. List the files it changed; stage nothing.
5. **After a change in `database/`**, on a scratch database, as CI builds its own:
   `<scratch>` is `.env`'s `DATABASE_URL` with the database named `calliope_scratch`. From
   `database/`, dropped first in case an interrupted run left it behind:

   ```bash
   pnpm exec dbmate --env-file ../.env --url "<scratch>" drop
   pnpm exec dbmate --env-file ../.env --url "<scratch>" create
   DATABASE_URL="<scratch>" DBMATE_NO_DUMP_SCHEMA=true pnpm run migrations:migrate
   ```

   - **If a migration changed**, roll every one back and migrate again; a failure is a
     `migrate:down` that doesn't reverse its `migrate:up`:

     ```bash
     for m in migrations/*.sql; do DATABASE_URL="<scratch>" DBMATE_NO_DUMP_SCHEMA=true pnpm run migrations:rollback || exit 1; done
     DATABASE_URL="<scratch>" DBMATE_NO_DUMP_SCHEMA=true pnpm run migrations:migrate
     ```

   - **`schema.ts`**: note `git hash-object ../backend/src/database/schema.ts`, run
     `DATABASE_URL="<scratch>" pnpm run types:generate` and check that its output names
     `../backend/src/database/schema.ts`; another path means it didn't find its config, which is a
     failure. Then `pnpm exec oxfmt src/database/schema.ts` in `backend/` and compare the hash. If it
     moved, the file was stale: say so; the regenerated one is what to commit, and `/regenerate`
     carries it downstream.
   - Finally `pnpm exec dbmate --env-file ../.env --url "<scratch>" drop`.
6. **Report** one row per command: project, command, passed or failed, and for a failure the first
   error verbatim, never "some lint errors"; for a failing test, its name and assertion message.
   End with what didn't run and why.

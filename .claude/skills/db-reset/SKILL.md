---
name: db-reset
description: Rebuild the local database from the migrations and re-seed it — after editing a migration in place, or to get back to the fixture. Wipes every row and signs every browser out.
user-invocable: true
---

Rebuild this checkout's database. Claude has its own checkout, containers and database and may run
this whenever the work needs it. **Everything is wiped** — hand-made accounts, rows under test, every
session — so say so before running it against a database somebody else is using.

1. **Stop the backend first**, or open connections block the drop. `deno task dev` needs
   `kill -KILL` on its process group (SIGTERM leaves the task runner alive to restart it):
   ```bash
   lsof -nP -iTCP:${BACKEND_PORT:-8000} -sTCP:LISTEN     # the pid
   ps -o pgid= -p <pid>                                  # its group
   kill -KILL -<pgid>
   ```
2. **Rebuild and regenerate**, from `database/`:
   ```bash
   deno task db:reset && deno task types:generate
   ```
3. **Format the generated types and seed**, from `backend/`:
   ```bash
   deno fmt src/database/schema.ts && deno task db:seed
   ```
   `schema.ts` should now be byte-identical to the committed file unless the schema changed; if it
   differs, that is the change to review.
4. **Restart the backend** with the preview tooling (`preview_start` with the `backend` launch
   configuration), not with Bash.
5. **Tell the user their session is gone.** The nine seeded accounts share the password `calliope`;
   they sign in themselves — never type credentials.

If a migration was edited in place, prove its `migrate:down` still reverses it on a throwaway
database first — `database/AGENTS.md` describes the round trip.

---
name: db-reset
description: Rebuild the local database from the migrations and re-seed it — after editing a migration in place, or to get back to the fixture. Wipes every row and signs every browser out.
user-invocable: true
---

Rebuild this checkout's database. Claude has its own checkout, containers and database and may run
this whenever the work needs it. **Everything is wiped** — hand-made accounts, rows under test, every
session — so say so before running it against a database somebody else is using.

1. **Stop the backend first**, or open connections block the drop. `pnpm run dev` stops on
   SIGTERM to its process group. Its port is `.env`'s, which the shell doesn't load, so read it at
   the root:
   ```bash
   port=$(sed -nE 's/^BACKEND_PORT="?([0-9]+)"?$/\1/p' .env)
   lsof -nP -iTCP:${port:-8000} -sTCP:LISTEN             # the pid
   ps -o pgid= -p <pid>                                  # its group
   kill -TERM -<pgid>
   ```
2. **Rebuild and regenerate**, from `database/`:
   ```bash
   pnpm run db:reset && pnpm run types:generate
   ```
3. **Format the generated types and seed**, from `backend/`:
   ```bash
   pnpm exec oxfmt src/database/schema.ts && pnpm run db:seed
   ```
   `schema.ts` should now be byte-identical to the committed file unless the schema changed; if it
   differs, that is the change to review.
4. **Restart the backend** with the preview tooling (`preview_start` with the `backend` launch
   configuration), not with Bash.
5. **Tell the user their session is gone.** The nine seeded accounts share the password `calliope`;
   they sign in themselves — never type credentials.

If a migration was edited in place, prove its `migrate:down` still reverses it first:
`/workflow-validate` does the round trip on a scratch database.

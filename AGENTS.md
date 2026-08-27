# Calliope

A community of private writing groups. See [README.md](README.md) for what it is and how to
run it, and [docs/](docs/) for what it is supposed to become.

**The repository is public.** Never commit `.env`, credentials, dumps or scratch notes.

Each project carries its own conventions; read the one you are working in:

- [backend/AGENTS.md](backend/AGENTS.md) — Hono routes, OpenAPI, authorisation, tests
- [database/AGENTS.md](database/AGENTS.md) — migrations, triggers, generated types
- [frontend/AGENTS.md](frontend/AGENTS.md) — design system, shadcn-vue, generated client

## Shared conventions

- **Deno for the backend and `database/`, Node for the frontend.** Backend tasks are
  `deno task …`; frontend tasks are `npm run …`. Do not mix them — `deno task` will happily
  run a `package.json` script and then fail in confusing ways.
- **Stopping `deno task dev` takes `kill -KILL` on its process group.** SIGTERM makes the
  `--watch` child release the port while both it and the task runner stay alive, so a free port
  is not proof the backend stopped: the next saved file restarts it, back onto the port and back
  into the connections that make `dbmate drop` fail. Find it with
  `lsof -nP -iTCP:$BACKEND_PORT -sTCP:LISTEN`, its group with `ps -o pgid= -p <pid>`, and send
  the signal to `-<pgid>`.
- **Pin exact dependency versions.** No `^` or `~` ranges, in either `deno.jsonc` or
  `package.json`. `deno add` writes a caret; rewrite it.
- **Comment the non-obvious, and only that.** Explain why a thing is the way it is when it
  would otherwise read as arbitrary.
- **Keep comments short: one or two lines.** A long comment is overwhelming, and most people
  skip it entirely, so a rule buried in six lines is a rule nobody reads. State the reason and
  stop. What was tried, what broke, and what it measured belong in the commit message, which
  can be as long as it needs to be. Self-explanatory names get no comment at all, and a
  convention written down here is not repeated at each use site.
- **`type`, never `interface`.**
- **Imports use each project's `@/` alias** rather than climbing out of deep directories.
  The two differ: in the backend it points at the project root, in the frontend at `src/`.
- Run `validate:check` in whichever project you changed before considering anything done.

## The issue tracker

Work is tracked as GitHub issues, and **a milestone means accepted**: `status: proposed` and a
milestone are mutually exclusive, because the label is what says a thing has not been decided yet.
Putting an issue into `v1` or `v2` is that decision, so the label comes off in the same edit.

## How the pieces fit

The backend serves everything under `/api`, and Caddy serves the built frontend from the same
origin. That one prefix is why the Caddy matcher and the Vite dev proxy are each a single
rule, and why session cookies work with `SameSite=Lax` while CORS goes effectively unused in
production.

The database is the origin of the types: `database/` generates
`backend/src/database/schema.ts`, the backend builds its schemas from that and emits
`backend/open-api.json`, and the frontend generates its API client from that. A column rename
therefore surfaces as a compile error rather than as a lie in the specification. When you
change a link in that chain, regenerate the ones downstream.

## Deployment

`docker-compose.deploy.yaml` and the `Caddyfile` at the root; see
[deployment/README.md](deployment/README.md) for the procedure and the backups.

- **`docker compose exec -T` forwards stdin.** In a script, any such command that is not
  being fed a file needs `</dev/null`, or it swallows the rest of the script.
- **`ufw` does not filter Docker-published ports.** Docker writes its own iptables rules.
  Nothing but Caddy publishes a port, and that is what keeps the databases private.
- **`postgres:18` keeps its data in `/var/lib/postgresql/18/docker`.** Mounting the old
  `/var/lib/postgresql/data` path persists nothing.
- **Container healthchecks must use `127.0.0.1`, not `localhost`.** `localhost` resolves to
  `::1` first and the server listens on `0.0.0.0`.
- **A Caddyfile-only change needs `--force-recreate caddy`.** `up -d` compares the service
  definition, which a changed bind-mounted file does not alter, so Caddy keeps serving the
  previous configuration while the deploy reports success.
- **Only the deploy file pins the project name.** `docker compose -f docker-compose.deploy.yaml
  down -v` from a *copy* of the repository therefore removes your dev stack's volumes; pass `-p`
  something else. `docker-compose.yaml` takes the directory's name, so a second checkout is
  isolated for free.
- **A second checkout needs its ports moved in two files.** `.env` holds them all, each
  defaulting to the single-checkout value — see `.example.env`. The Vite proxy target is the one
  that matters: without it a second frontend quietly proxies into the first checkout's database.
  `.claude/launch.json` needs the same two ports again, because the preview tooling reads neither
  `.env` nor a variable — a `${BACKEND_PORT}` there is used as a literal string. It is gitignored
  for that reason, with `.claude/launch.example.json` carrying the defaults; a stale copy points
  the preview at the *other* checkout's server, which looks like the app being broken.

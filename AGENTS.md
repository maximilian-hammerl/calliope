# Calliope

A community of German-speaking writers: a public forum around private writing groups. What it is
and how to run it is in [README.md](README.md); what it should become is in [docs/](docs/).

**The repository is public.** Never commit `.env`, credentials, dumps or scratch notes.

## How these instructions are organised

- This file: rules that hold everywhere. Loaded every session.
- `backend/AGENTS.md`, `database/AGENTS.md`, `frontend/AGENTS.md`: each project's conventions,
  under 200 lines. Loaded when you work in that directory.
- `.claude/rules/`: the reasoning behind each area — why the report lifecycle, the carousel or the
  forum's permissions are shaped as they are. Each file is scoped by `paths:` and loads only when
  you open a matching file. When you change how an area works, change its rule in the same commit.
- `.claude/skills/`: the workflows worth doing the same way every time.
- `frontend/.claude/skills/design-system/`: the visual and verbal rules, from member research.

## How to work here

- **IMPORTANT — ask, don't assume.** When there are several options or alternatives, explain them
  and ask which one. Do not pick one yourself.
- **IMPORTANT — keep it simple.** The smallest change, comment, issue or answer that does the job.
  Say the reason and stop; a rule buried in six lines is a rule nobody reads.
- **Implement only when told to.** A question is a question: answer it. It is not an instruction
  to build the answer, least of all when the answer could go several ways.
- **Push back.** If a rule or a decision makes no sense, a better alternative exists, or something
  has not been considered, say so before doing the work.
- **Commit only after the human confirms they reviewed the change** ("reviewed, commit it"; asking
  for a review is not that); until then, leave it in the working tree. The confirmation covers the
  push, the pull request and its merge once Validate passes, and a reviewed fix rebased up its
  stack (`/workflow-ship`); any other rebase or push only when asked. Syncing (`git fetch`,
  `git pull`, `git merge`) is always fine.

## Shared conventions

- **Deno for `backend/`, Node for `frontend/` and `database/`.** `deno task …` versus `pnpm run …`;
  `deno task` will happily run a `package.json` script and then fail confusingly. The Node projects
  are members of the pnpm workspace at the root, so `pnpm install` runs there, against the one
  lockfile.
- **Run `/workflow-validate`** before considering anything done: what CI runs, for the projects
  you changed.
- **Pin exact dependency versions.** No `^` or `~`, in `deno.jsonc` or `package.json`. `pnpm add`
  writes an exact version (`savePrefix` in `pnpm-workspace.yaml`); `deno add` writes a caret, so
  rewrite it, and check what `shadcn-vue add` wrote. A version more than one project uses goes in
  the workspace's `catalog`, and each project names it `catalog:`.
- **`type`, never `interface`.**
- **Imports use each project's `@/` alias**: the backend's points at the project root, the
  frontend's at `src/`.
- **Comment the non-obvious, and only that.** Say why a thing is the way it is where it would
  otherwise read as arbitrary, in one or two lines. What was tried and measured belongs in the
  commit message; a convention written down here is not repeated at each use site.
- **A migration that has been committed is edited in place** while only `testing` is deployed —
  see `database/AGENTS.md` for the rule and the rebuild it costs.

## One type chain, regenerated downstream

`database/` generates `backend/src/database/schema.ts`; the backend builds its request and response
schemas from that and emits `backend/open-api.json`; the frontend generates `src/api/` from that. A
renamed column is therefore a compile error, not a lie in the specification. **When you change a
link, regenerate everything after it** — `/regenerate` runs the chain in order and reports what
moved at each step.

## One prefix

The backend serves everything under `/api`, and Caddy serves the built frontend from the same
origin. That is why the Caddy matcher and the Vite dev proxy are each a single rule, session cookies
work with `SameSite=Lax`, and CORS goes effectively unused in production.

## Running two checkouts

`.env` holds every port, each defaulting to the single-checkout value; the Vite proxy target is the
one that matters, or a second frontend quietly talks to the first checkout's database. `.claude/
launch.json` needs the same two ports again — the preview tooling reads neither `.env` nor a variable
— and is gitignored for that reason, with `launch.example.json` carrying the defaults.

**Stopping `deno task dev` takes `kill -KILL` on its process group.** SIGTERM makes the `--watch`
child release the port while the task runner survives, so a free port is not proof it stopped: the
next saved file restarts it. `lsof -nP -iTCP:$BACKEND_PORT -sTCP:LISTEN`, then `ps -o pgid= -p
<pid>`, then signal `-<pgid>`.

## The issue tracker

Work is GitHub issues, run as `/workflow-issues` says. `§N` is a section of
`docs/product-requirements-feature-specification.md`, `#N` an issue. Quote the section before
citing it. The specification is an inspiration: a section says where an idea came from, an issue
says what is decided.

## Deployment

`docker-compose.deploy.yaml` and the `Caddyfile` at the root; the procedure, the backups and the
gotchas are in [deployment/README.md](deployment/README.md) and `.claude/rules/deployment.md`.

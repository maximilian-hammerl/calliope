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
- `frontend/.claude/skills/design-system/`: the visual and verbal rules, from member research.

## How to work here

- **Ask, don't assume.** When there are several options or alternatives, explain them and ask
  which one — do not pick one yourself.
- **Implement only when told to.** A question is a question: answer it. It is not an instruction
  to build the answer, least of all when the answer could go several ways.
- **Push back.** If a rule or a decision makes no sense, a better alternative exists, or something
  has not been considered, say so before doing the work.
- **Commits are the human's.** Reading state (`git status`, `git diff`, `git log`) and syncing
  (`git fetch`, `git pull`, `git merge`) are fine. Branching, committing and pushing are not: leave
  the changes in the working tree and say what they are.

## Shared conventions

- **Deno for `backend/` and `database/`, Node for `frontend/`.** `deno task …` versus `npm run …`;
  `deno task` will happily run a `package.json` script and then fail confusingly.
- **Run `validate:check` in whichever project you changed** before considering anything done. Each
  project has `validate:fix` for what can be repaired automatically.
- **Pin exact dependency versions.** No `^` or `~`, in `deno.jsonc` or `package.json`. `deno add`
  and `shadcn-vue add` both write a caret; rewrite it.
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
link, regenerate everything after it**: `deno task types:generate` → `deno task open-api:generate` →
`npm run open-api:generate-client`.

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

Work is GitHub issues, and **a milestone means accepted**: `status: proposed` and a milestone are
mutually exclusive, so putting an issue into `v1` or `v2` takes the label off in the same edit.
Requirements are cited as `§N` (sections of `docs/product-requirements-feature-specification.md`),
issues as `#N`. Quote the section before citing it.

## Deployment

`docker-compose.deploy.yaml` and the `Caddyfile` at the root; the procedure, the backups and the
gotchas are in [deployment/README.md](deployment/README.md) and `.claude/rules/deployment.md`.

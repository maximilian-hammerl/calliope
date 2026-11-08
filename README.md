# Calliope

[![Validate](https://img.shields.io/github/actions/workflow/status/maximilian-hammerl/calliope/validate.yml?branch=main&label=validate)](https://github.com/maximilian-hammerl/calliope/actions/workflows/validate.yml)
[![v1](https://img.shields.io/github/milestones/progress/maximilian-hammerl/calliope/1)](https://github.com/maximilian-hammerl/calliope/milestone/1)
[![Last commit](https://img.shields.io/github/last-commit/maximilian-hammerl/calliope)](https://github.com/maximilian-hammerl/calliope/commits/main)
[![License](https://img.shields.io/github/license/maximilian-hammerl/calliope)](LICENSE)

A community for German-speaking writers: a public forum wrapped around many private, member-created writing groups.
Members meet in the open, form a group, and write together in threads inside it.

Calliope replaces [Yooco](docs/yooco-research-report.md) for an existing community. What it has to preserve, and what it
should do better, is written up in
[the product requirements](docs/product-requirements-feature-specification.md), which grew out
of [interviews with members](docs/interviews.md).

Self-hosted: one Docker Compose stack behind Caddy, described in the
[deployment runbook](deployment/README.md).

Meant to be run under your own name: `PUBLIC_APP_NAME` and the contact details in `.env` carry
through to the browser tab, the wordmark and the OpenAPI document. The mark and the icons are
the letter C and stay as they are — renaming is not yet a full rebrand.

## Layout

| Directory     | What it is                                                                      |
|---------------|---------------------------------------------------------------------------------|
| `backend/`    | Node + Hono API, documented with OpenAPI                                        |
| `frontend/`   | Vue single page application, built with Vite                                    |
| `database/`   | dbmate migrations, and the code generator for the backend's types               |
| `deployment/` | Backup script, systemd units and the [deployment runbook](deployment/README.md) |
| `docs/`       | Product requirements and the research behind them                               |

## Running it locally

Requires [Node](https://nodejs.org) 26, [pnpm](https://pnpm.io) and
[Docker](https://docs.docker.com/engine/install/).

```bash
cp .example.env .env
cp .claude/launch.example.json .claude/launch.json
docker compose up -d --wait
pnpm install
cd database && pnpm run migrations:migrate
```

Then the backend on <http://localhost:8000>:

```bash
cd backend && pnpm run dev
```

and the frontend on <http://localhost:5173>:

```bash
cd frontend && pnpm run dev
```

The compose file publishes Postgres on `54322` and Redis on `63792`, so it does not collide with anything already
running on the default ports. It also runs [Mailpit](https://mailpit.axllent.org), which accepts every message the
backend sends and delivers none of them — read them at <http://localhost:8025>. Nothing in development or in the tests
reaches a real mail server.

## Checks

All three projects have the same two entry points, `validate:check` to verify and `validate:fix`
to repair what can be repaired:

```bash
cd backend  && pnpm run validate:check   # format, lint, type-check, knip over the backend
cd database && pnpm run validate:check
cd frontend && pnpm run validate:check   # format, lint, type-check, knip over the whole workspace
```

The backend has two more, which CI runs as well:

```bash
pnpm run open-api:check   # regenerates open-api.json and fails if it changed
pnpm run open-api:lint    # validates the document with Spectral
```

The test suite needs Postgres, Redis and Mailpit running and the migrations applied — the
password reset tests read the message they sent, because the token exists nowhere else:

```bash
cd backend && pnpm run test
```

## Deployment

`./deployment/deploy.sh --environment testing` on the server. Besides pulling and rebuilding, it rebuilds the database
after an edited migration and recreates containers when the compose file or the `Caddyfile` changed.
The [deployment runbook](deployment/README.md) covers provisioning a fresh machine, the backup timer, and how to restore
a dump.

## Conventions

[AGENTS.md](AGENTS.md) describes how this codebase is written — naming, the shape of a route, what has to be regenerated
after a change. It is worth reading before the first contribution, whether you are a person or not.

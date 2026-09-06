---
paths:
  - "deployment/**"
  - "docker-compose*.yaml"
  - "Caddyfile"
  - ".github/workflows/**"
---

# Deploying

The procedure, the backups and the restore are in `deployment/README.md`; read it before touching
any of this. Gotchas it does not carry:

- **`docker compose exec -T` forwards stdin.** In a script, any such command not being fed a file
  needs `</dev/null`, or it swallows the rest of the script.
- **`postgres:18` keeps its data in `/var/lib/postgresql/18/docker`.** Mounting the old
  `/var/lib/postgresql/data` persists nothing.
- **Healthchecks use `127.0.0.1`, not `localhost`**, which resolves to `::1` first.
- **A Caddyfile-only change needs `--force-recreate caddy`** — `up -d` compares the service
  definition, which a changed bind-mount does not alter.
- **Only the deploy file pins the project name**, so `docker compose -f docker-compose.deploy.yaml
  down -v` from a *copy* of the repository removes your dev stack's volumes; pass `-p` something else.
- **`ufw` does not filter Docker-published ports.** Nothing but Caddy publishes one, and that is what
  keeps the databases private.
- **`deploy.sh` detects an edited migration and rebuilds the database — on `testing` only**, and
  refuses elsewhere. See `database/AGENTS.md` for when editing in place stops being allowed.
- The backend must stay a single instance: chat fan-out is in process.

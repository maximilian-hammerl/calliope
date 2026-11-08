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
- **A push to `main` deploys `testing`** (Validate's `Deploy to testing` job). A change to
  `deploy.sh` or `ssh-deploy.sh` takes effect from the deploy after the one that pulls it: the
  running copy was parsed before the pull. The units are copies in `/etc/systemd/system` and the
  forced command lives in `authorized_keys`, so a change to either is redone on the server.
- **What `deploy.sh` prints is public**: the job copies it into a public repository's Actions log.
  Never print a value from `.env`, or `compose config`, which resolves them.
- The backend must stay a single instance: chat fan-out is in process.
- **The backend's root file system is read-only**, with no capabilities: anything new it has to
  write needs a volume, as the uploads have.

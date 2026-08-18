# Deployment

Calliope runs on a single netcup VPS (Debian 13, arm64) at <https://calliope.hammerl.dev>,
as a Docker Compose stack: Caddy terminates TLS and serves the frontend, the backend runs
behind it, and Postgres and Redis are reachable only inside the compose network.

The checkout lives at `/opt/calliope`.

## Provisioning a fresh server

Only needed after a reset. Everything else is idempotent and can be re-run.

```bash
apt-get update && apt-get upgrade -y
apt-get install -y ca-certificates curl git gnupg locales-all
```

Docker Engine from its own repository, because Debian's package lags:

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

Firewall. Add the rules **before** enabling, or the SSH session running these commands is
dropped along with everything else:

```bash
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
```

`ufw` does not filter ports published by Docker — it writes its own iptables rules and
bypasses the firewall. Only Caddy publishes ports, which is why nothing else is exposed.

Key-only SSH, as a drop-in so a package upgrade cannot revert it:

```bash
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'CONF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
CONF
sshd -t && systemctl reload ssh
```

Validate with `sshd -t` before reloading, and confirm a **new** session still connects
before closing the current one.

## First deploy

```bash
git clone https://github.com/maximilian-hammerl/calliope.git /opt/calliope
cd /opt/calliope
cp .env.production.example .env
```

Edit `.env`: set `HOST_URL` and generate a password that exists nowhere else.

```bash
chmod 600 .env
docker compose -f docker-compose.production.yaml up -d --build
```

The stack orders itself: the database becomes healthy, `migrate` applies the migrations and
exits, the backend starts and passes its health check, then Caddy starts once the frontend
has been built. Caddy requests a certificate from Let's Encrypt on first start, which needs
port 80 reachable and DNS already pointing here.

## Redeploying

```bash
cd /opt/calliope
git pull
docker compose -f docker-compose.production.yaml up -d --build
```

Migrations run automatically as part of `up`.

### After changing only the Caddyfile

`Caddyfile` is bind-mounted and Caddy reads it once, at startup. `up -d` compares the
*service definition*, which a changed file does not alter, so it leaves the container
running and Caddy keeps serving the previous configuration — the deploy reports success
while nothing about the routing has changed. Force it:

```bash
docker compose -f docker-compose.production.yaml up -d --force-recreate caddy
```

This only bites when the Caddyfile is the sole change. Anything that also alters the
compose file recreates Caddy along with it. Verify afterwards against a path the change
should affect, not just that the container is up.

## The backend must stay a single instance

Chat messages are fanned out to open streams inside the backend process. Running two
containers would not error — members connected to one would simply stop receiving messages
sent through the other. Before scaling out, move the fan-out in `backend/src/chat/chat_events.ts`
to Redis pub/sub; the seam is two functions in that one file.

## Backups

The systemd units are tracked in this directory but have to be installed into the system
once per server:

```bash
install -m 0644 /opt/calliope/deployment/calliope-backup.service /etc/systemd/system/
install -m 0644 /opt/calliope/deployment/calliope-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now calliope-backup.timer
```

Check it is armed, and run one by hand:

```bash
systemctl list-timers calliope-backup.timer
systemctl start calliope-backup.service
journalctl -u calliope-backup.service -n 20
```

Dumps land in `/var/backups/calliope` as `pg_dump` custom-format archives, kept for 14 days.

### Restoring

Into a scratch database first, to check the dump before touching live data:

```bash
cd /opt/calliope
docker compose -f docker-compose.production.yaml exec -T db \
	psql -U calliope -d postgres -c 'CREATE DATABASE restore_check;' </dev/null
docker compose -f docker-compose.production.yaml exec -T db \
	pg_restore --username calliope --no-password --dbname restore_check \
	< /var/backups/calliope/calliope-<timestamp>.dump
```

Over the live database, which drops and recreates every object the dump contains:

```bash
docker compose -f docker-compose.production.yaml exec -T db \
	pg_restore --username calliope --no-password --clean --if-exists --dbname calliope \
	< /var/backups/calliope/calliope-<timestamp>.dump
```

`docker compose exec -T` forwards stdin to the container, so any command in a script that
does *not* read a dump needs `</dev/null` — otherwise it swallows the rest of the script.

## Known gaps

- **The dumps never leave the server.** They cover mistakes in the data, not the loss of
  the machine. Offsite copies, encrypted, are still to be set up.
- **No deploy automation.** Redeploying is the manual `git pull` above.
- The dumps hold email addresses and password hashes; they are `0600` in a `0700`
  directory, and must be encrypted before they are ever copied elsewhere.

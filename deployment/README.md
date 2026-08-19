# Deployment

Calliope runs on a single small VPS as a Docker Compose stack: Caddy terminates TLS and
serves the frontend, the backend runs behind it, and Postgres and Redis are reachable only
inside the compose network. One instance is the supported shape — see the note on the chat
fan-out below.

The commands below assume Debian 13 on arm64, which is what the `apt` and Docker repository
lines are written for; on anything else those two sections need adjusting and the rest
carries over. The domain is never written down here — it comes from `HOST_URL` in `.env`.

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

## Outgoing mail

The backend sends through an external SMTP account — the `SMTP_*` and `MAIL_FROM_ADDRESS`
variables in `.env`. Do not send from this host directly: a VPS has generic reverse DNS and
no sending reputation, which fails an `iprev` check on its own and lands the mail in spam.

The sending domain needs all three of SPF, DKIM and DMARC, and `MAIL_FROM_ADDRESS` has to be
a mailbox the SMTP account may send as, or DKIM will not align with the `From:` header a
member actually sees. A subdomain does not inherit its parent's SPF or DKIM; sending as the
parent domain avoids publishing and warming a second set of records.

Verify the whole chain from the server after any change to the account or the DNS, rather
than trusting the control panel:

```bash
python3 -c "import smtplib,ssl;s=smtplib.SMTP_SSL('<smtp-host>',465,timeout=20,context=ssl.create_default_context());s.login('<username>',input('pw: '));print('AUTH OK');s.quit()"
```

Mail delivered *within* the provider's own server is not signed by its outbound relay, so a
message sent to an address on the same domain proves nothing about DKIM. Send one to
`check-auth@verifier.port25.com`, which replies to the sender with an SPF, DKIM and `iprev`
report.

### Bounces are not handled

Nothing reads delivery failures. A member who mistypes their address at registration gets a
bounce into the `MAIL_FROM_ADDRESS` mailbox, and the application never learns the message did
not arrive — it will keep believing the link was sent.

**Read that mailbox by hand every few days** and act on what is in it. This is the accepted
gap for now; the alternative is having the backend poll the mailbox over IMAP and mark
addresses undeliverable, which is worth building only once the volume justifies it.

DMARC aggregate reports go wherever the `rua=` address in the DMARC record points. Send them
somewhere other than `MAIL_FROM_ADDRESS`, or daily XML from every provider the mail touches
buries the bounces this section is about.

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
- **Bounces are read by a person**, not by the application — see above.
- **Mail still in flight is lost on restart.** Sends are deliberately not awaited by the
  request that triggered them, and nothing drains them on shutdown; a member caught by a
  deploy has to ask for the link again.
- The dumps hold email addresses and password hashes; they are `0600` in a `0700`
  directory, and must be encrypted before they are ever copied elsewhere.

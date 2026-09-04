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
cp .example.env .env
```

Edit `.env`: its defaults are the ones a development checkout wants, so every line marked
„deployment" needs changing here — `PUBLIC_ENVIRONMENT` to what this machine actually is
(calliope.hammerl.dev is `testing`, not `production`), `HOST_URL`, the operator and hoster names
the legal pages are built with, `POSTGRES_PASSWORD` and the `SMTP_*` credentials, `MAIL_FROM_ADDRESS`
and `FILE_STORAGE_PATH`.

None of it fails quietly: `--environment` has to match what the file declares, the compose file
refuses to start without the passwords, and the frontend build refuses a bundle that cannot say
which instance it is for or whose legal notice it carries.

```bash
chmod 600 .env
docker compose -f docker-compose.deploy.yaml up -d --build
```

The stack orders itself: the database becomes healthy, `migrate` applies the migrations and
exits, the backend starts and passes its health check, then Caddy starts once the frontend
has been built. Caddy requests a certificate from Let's Encrypt on first start, which needs
port 80 reachable and DNS already pointing here.

## Redeploying

```bash
cd /opt/calliope
./deployment/deploy.sh --environment testing
```

`--environment` is required, must be one of `testing`, `staging` or `production`, and must
match `PUBLIC_ENVIRONMENT` in `.env` — the script refuses on a mismatch. It is a statement of intent
rather than a lookup: the mistake worth catching is running a deploy against a server you did
not think you were on.

The script fetches, works out which of the paths below applies, and does that one. Add
`--dry-run` to print the plan and stop, which is worth doing whenever a migration changed.
Afterwards it waits for the backend's health check and then asks the deployment what it is
running: `GET /api/health` reports the deployed commit as `releaseId`, and the served page
carries it as `<meta name="commit">`. Both must equal what was just deployed. They are checked
separately because the backend and the frontend are built by different compose services, and a
current backend behind a stale bundle is exactly what a single 200 hides.

The stamp is `git describe --always --dirty`, exported so compose interpolates it — shell
variables win over `.env` — into `PUBLIC_GIT_COMMIT`, which the backend and the build both read.
Neither is required: run by hand, the backend omits `releaseId` and the page says `unknown`.
`-dirty` means somebody edited a file on the server.

The sections below are what it automates, and what to do when it refuses.

Migrations run automatically as part of `up`.

### After a migration was edited rather than added

`deploy.sh` detects this and, on `testing`, does it. On `staging` and `production` it refuses
and points here, because only `testing` is reset when a migration calls for it. It compares the
migrations touched between the deployed commit and the new one against the versions recorded in
`migration.schema_migration`: only an *already applied* version that changed forces a rebuild, so
a migration added and then edited between two deploys is an ordinary deploy. Renames count —
three in this repository's history kept their version prefix while rewriting the body.

Pre-release, a schema change edits the migration that created the table (see
[database/AGENTS.md](../database/AGENTS.md)), and dbmate will not re-run a version it has already
recorded — so the database has to be rebuilt. **This deletes every row, every account included.**

```bash
cd /opt/calliope && git pull
docker compose -f docker-compose.deploy.yaml stop backend
docker compose -f docker-compose.deploy.yaml run --rm migrate drop
docker compose -f docker-compose.deploy.yaml run --rm migrate up
docker compose -f docker-compose.deploy.yaml up -d --build
docker compose -f docker-compose.deploy.yaml run --rm --no-deps backend --seed --force
```

Two of those steps are not obvious. **Stop the backend first**, or its open connections make
`drop` fail with "database is being accessed by other users". And **`up`, not `migrate`**: the
compose service's own command is `migrate`, which does not create a database, and Postgres only
creates one when its volume is initialised — so after a drop, `up -d` fails with `database
"calliope" does not exist` and the backend never starts. `dbmate up` creates it and then migrates.

### After changing a network option

`deploy.sh` passes `--force-recreate` whenever the compose file changed at all. That is broader
than this case, and deliberately so: telling a network change from any other compose change by
reading YAML is more fragile than recreating containers that a compose change was going to
restart anyway.

Compose has to delete and recreate the network, which stops every container attached to it —
but it *starts* them again rather than recreating them, and a container that outlived its
network keeps stale DNS: `migrate` failed with `lookup db on 127.0.0.11:53: no such host`, so
the backend never started and the site was down until the containers were replaced.

```bash
docker compose -f docker-compose.deploy.yaml up -d --force-recreate
```

### The client's address only survives over IPv4 by default

`docker-proxy` bridges an IPv6 connection to an IPv4-only container, which necessarily rewrites
the source — so the backend saw the bridge gateway (`172.18.0.1`) for every IPv6 request, and
the rate limiter bucketed the whole platform together. Measured both ways: over IPv4 the
backend saw the true client, over IPv6 it did not. `enable_ipv6: true` on the default network
gives IPv6 a DNAT path of its own and both families now arrive intact.

### After changing only the Caddyfile

`deploy.sh` does this when the Caddyfile changed and the compose file did not.

`Caddyfile` is bind-mounted and Caddy reads it once, at startup. `up -d` compares the
*service definition*, which a changed file does not alter, so it leaves the container
running and Caddy keeps serving the previous configuration — the deploy reports success
while nothing about the routing has changed. Force it:

```bash
docker compose -f docker-compose.deploy.yaml up -d --force-recreate caddy
```

This only bites when the Caddyfile is the sole change. Anything that also alters the
compose file recreates Caddy along with it. Verify afterwards against a path the change
should affect, not just that the container is up.

### Why Caddy is not recreated on every deploy

Caddy also bind-mounts `./frontend/dist`, and a bind mount is resolved once, at container
start. A build that *replaced* that directory rather than refilling it would leave Caddy
holding the old inode: an empty `/srv`, served by a container that is perfectly healthy.
Recreating Caddy every time would close that off for about a second of CPU.

We do not, for two measured reasons. `npm run build` empties `dist` and keeps it — the
inode is unchanged across a build — and nothing else in the deploy path replaces it:
`dist` is gitignored, so a pull cannot, and no script removes it. On a first deploy Caddy
waits for `frontend-build` to finish, so it never mounts a directory that is not there yet.

And if it happened anyway it would not be silent. The end-to-end check fetches `/` through
Caddy and requires the served HTML to carry the commit just built, so a stale or empty
bundle fails the deploy and the message says to recreate Caddy. That check is the reason
this is a loud failure rather than a quiet one, and why the unconditional recreate — which
costs a moment of downtime on every deploy, not just a second — is not worth it here.

Reconsider if the frontend build ever starts deleting `dist` outright.

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
Beside each one is `calliope-<timestamp>-files.tar.gz`, the uploaded files, which no dump covers.
The dump is taken first, so the archive is a superset of what the rows reference.

### Restoring

Into a scratch database first, to check the dump before touching live data:

```bash
cd /opt/calliope
docker compose -f docker-compose.deploy.yaml exec -T db \
	psql -U calliope -d postgres -c 'CREATE DATABASE restore_check;' </dev/null
docker compose -f docker-compose.deploy.yaml exec -T db \
	pg_restore --username calliope --no-password --dbname restore_check \
	< /var/backups/calliope/calliope-<timestamp>.dump
```

Over the live database, which drops and recreates every object the dump contains:

```bash
docker compose -f docker-compose.deploy.yaml exec -T db \
	pg_restore --username calliope --no-password --clean --if-exists --dbname calliope \
	< /var/backups/calliope/calliope-<timestamp>.dump
```

Restoring the files, into the volume the backend mounts:

```bash
docker compose -f docker-compose.deploy.yaml stop backend
tar -xz \
	-C "$(docker volume inspect --format '{{.Mountpoint}}' calliope_file-data)" \
	< /var/backups/calliope/calliope-<timestamp>-files.tar.gz
docker compose -f docker-compose.deploy.yaml start backend
```

The backend is stopped first, because extracting under a running one can restore a file the
sweep has just decided is unreferenced. Both halves work on the volume's own path — the backend
image is distroless, so there is no shell or tar inside it to borrow.

`docker compose exec -T` forwards stdin to the container, so any command in a script that
does *not* read a dump needs `</dev/null` — otherwise it swallows the rest of the script.

## The uploads volume belongs to the runtime user

The backend runs as `nonroot` (uid 65532) and uploads go to a named volume. Docker copies an image
directory's ownership into a volume **only when it first creates one**, which is why the image
creates `FILE_STORAGE_PATH` and chowns it — without that, Docker makes the volume root's and the
first upload fails with `Permission denied (os error 13)`.

A volume that already exists predates that, so it is still root's. Repair it once, with the backend
stopped:

```bash
docker compose -f docker-compose.deploy.yaml stop backend
docker run --rm --volume calliope_file-data:/data busybox:1.37 chown -R 65532:65532 /data
docker compose -f docker-compose.deploy.yaml start backend
```

Nothing is lost — it changes ownership, not contents.

## Known gaps

- **The dumps never leave the server.** They cover mistakes in the data, not the loss of
  the machine. Offsite copies, encrypted, are still to be set up — now for both halves.
- **Bounces are read by a person**, not by the application — see above.
- **Mail still in flight is lost on restart.** Sends are deliberately not awaited by the
  request that triggered them, and nothing drains them on shutdown; a member caught by a
  deploy has to ask for the link again.
- The dumps hold email addresses and password hashes; they are `0600` in a `0700`
  directory, and must be encrypted before they are ever copied elsewhere.

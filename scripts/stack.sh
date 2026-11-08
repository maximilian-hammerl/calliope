#!/usr/bin/env bash
# Gives a worktree a Compose stack of its own; root AGENTS.md "Running two checkouts" says why. Run
# at the checkout's root:
#
#     pnpm run stack:up      # ports and a project name of its own in .env and .claude/launch.json,
#                            # then start the stack and migrate its database
#     pnpm run stack:down    # remove the stack and delete its volumes, before the worktree goes
#     pnpm run stack:prune   # the same for every worktree under the main checkout that is gone
#
# The main checkout keeps the default ports. A worktree takes, for each, the next port up that no
# other checkout's .env names and nothing listens on. Written for macOS's bash 3.2.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# The defaults that docker-compose.yaml, the Vite config and the backend fall back to.
KEYS=(BACKEND_PORT FRONTEND_PORT POSTGRES_PORT REDIS_PORT SMTP_PORT MAILPIT_PORT)
DEFAULTS=(8000 5173 54322 63792 1025 8025)

# Held while `up` reads the other checkouts' ports and writes its own, or two runs pick the same.
LOCK="$(git rev-parse --path-format=absolute --git-common-dir)/stack.lock"

# `.git` is a file in a worktree and a directory in the main checkout.
in_worktree() {
  [[ -f .git ]]
}

# What a .env gives a key, unquoted; empty when it is unset or commented out.
env_value() { # <file> <key>
  sed -nE "s/^$2=\"?([^\"]*)\"?$/\1/p" "$1" | tail -n 1
}

# A checkout's port for a key, falling back to the default.
port() { # <checkout> <key>
  local i value=""
  if [[ -f $1/.env ]]; then
    value=$(env_value "$1/.env" "$2")
  fi
  for i in "${!KEYS[@]}"; do
    if [[ ${KEYS[$i]} == "$2" ]]; then
      echo "${value:-${DEFAULTS[$i]}}"
    fi
  done
}

# Replaces the key's line, or its commented-out default, and appends it when there is neither.
# The copy goes outside the repository: an interrupted run must not leave a stray .env to commit.
set_env() { # <key> <value>
  local copy
  copy=$(mktemp)
  awk -v key="$1" -v line="$1=\"$2\"" '
    index($0, key "=") == 1 || index($0, "# " key "=") == 1 { if (!done) print line; done = 1; next }
    { print }
    END { if (!done) print line }
  ' .env >"$copy"
  cat "$copy" >.env
  rm "$copy"
}

# Replaces the port in the key's URL, or stops rather than leave it pointing at another checkout's
# stack. The message names the key only: the URL carries a password.
set_url_port() { # <key> <port>
  local url pattern='^([a-z]+://([^/@]*@)?[^/:@]+):[0-9]+(.*)$'
  url=$(env_value .env "$1")
  if [[ ! $url =~ $pattern ]]; then
    echo "stack: found no port to replace in .env's $1" >&2
    exit 1
  fi
  set_env "$1" "${BASH_REMATCH[1]}:$2${BASH_REMATCH[3]}"
}

# Every port another checkout's .env names, defaults included: a stopped stack's ports are taken too.
claimed_ports() {
  local checkout key
  git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r checkout; do
    if [[ $checkout != "$PWD" ]]; then
      for key in "${KEYS[@]}"; do
        port "$checkout" "$key"
      done
    fi
  done
}

listening() { # <port>
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

lock() {
  local waited=""
  until mkdir "$LOCK" 2>/dev/null; do
    if [[ -z $waited ]]; then
      echo "stack: waiting for another stack:up; if none is running, remove $LOCK" >&2
      waited=1
    fi
    sleep 1
  done
  trap 'rmdir "$LOCK"' EXIT
}

unlock() {
  rmdir "$LOCK"
  trap - EXIT
}

up() {
  if [[ ! -f .env ]]; then
    cp .example.env .env
  fi

  if in_worktree; then
    local claimed i key value
    lock
    claimed=" $(claimed_ports | tr '\n' ' ') "
    for i in "${!KEYS[@]}"; do
      key=${KEYS[$i]}
      value=$(port . "$key")
      # A port is kept unless it is the default or another checkout's too, as in a copied .env.
      if [[ $value == "${DEFAULTS[$i]}" || $claimed == *" $value "* ]]; then
        value=$((DEFAULTS[i] + 1))
        while [[ $claimed == *" $value "* ]] || listening "$value"; do
          value=$((value + 1))
        done
        set_env "$key" "$value"
      fi
      claimed+="$value "
    done
    set_url_port DATABASE_URL "$(port . POSTGRES_PORT)"
    set_url_port REDIS_URL "$(port . REDIS_PORT)"
    set_url_port HOST_URL "$(port . FRONTEND_PORT)"
    # Compose names a project after its directory, so a worktree named like another checkout would
    # share that checkout's containers and volumes. Git keeps worktree names unique.
    set_env COMPOSE_PROJECT_NAME "calliope-$(basename "$(git rev-parse --git-dir)" |
      tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_\n-' '-')"
    unlock

    # The preview tooling reads neither .env nor a variable, so it gets the dev servers' ports again.
    node -e '
      const fs = require("node:fs");
      const [file, example, backend, frontend] = process.argv.slice(1);
      const launch = JSON.parse(fs.readFileSync(fs.existsSync(file) ? file : example, "utf8"));
      const ports = { backend: Number(backend), frontend: Number(frontend) };
      const named = launch.configurations.filter((configuration) => configuration.name in ports);
      if (named.length !== 2) throw new Error(file + " names no backend and frontend configuration");
      for (const configuration of named) configuration.port = ports[configuration.name];
      fs.writeFileSync(file, JSON.stringify(launch, null, 2) + "\n");
    ' .claude/launch.json .claude/launch.example.json "$(port . BACKEND_PORT)" "$(port . FRONTEND_PORT)"
  fi

  docker compose up -d --wait
  (cd database && DBMATE_NO_DUMP_SCHEMA=true pnpm run db:up)

  echo "stack: Postgres $(port . POSTGRES_PORT), Redis $(port . REDIS_PORT), SMTP $(port . SMTP_PORT)," \
    "Mailpit http://localhost:$(port . MAILPIT_PORT), backend $(port . BACKEND_PORT)," \
    "frontend $(port . FRONTEND_PORT)"
}

down() {
  if ! in_worktree; then
    echo "stack: this is the main checkout, whose database is the one you develop against;" \
      "stop it with docker compose down" >&2
    exit 1
  fi
  # Without a name of its own, the project would be the directory's, perhaps another checkout's.
  if [[ -z $(env_value .env COMPOSE_PROJECT_NAME) ]]; then
    echo "stack: .env names no COMPOSE_PROJECT_NAME, so this worktree has no stack of its own" >&2
    exit 1
  fi
  docker compose down -v
}

prune() {
  local root project
  # The desktop app makes its worktrees under the main checkout, so only stacks started from there
  # are candidates: other Compose projects on this machine are none of this script's business.
  root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
  docker compose ls -a --format json | node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    let input = "";
    process.stdin.on("data", (chunk) => (input += chunk));
    process.stdin.on("end", () => {
      for (const { Name, ConfigFiles } of JSON.parse(input)) {
        const directory = path.dirname(ConfigFiles.split(",")[0]);
        if (directory.startsWith(process.argv[1] + "/") && !fs.existsSync(directory)) console.log(Name);
      }
    });
  ' "$root" | while IFS= read -r project; do
    echo "stack: removing $project, whose checkout is gone"
    # Compose would otherwise read the rest of the list from stdin.
    docker compose -p "$project" down -v </dev/null
  done
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  prune) prune ;;
  *)
    echo "usage: scripts/stack.sh up|down|prune" >&2
    exit 2
    ;;
esac

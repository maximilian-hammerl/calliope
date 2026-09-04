#!/usr/bin/env bash
# Pulls and redeploys, choosing between the paths in README.md rather than leaving the choice
# to whoever is typing. Run on the server:
#
#     cd /opt/calliope && ./deployment/deploy.sh --environment testing
#
# The interesting decision is whether the database has to be rebuilt. Pre-release a schema
# change edits the migration that created the table, and dbmate will not re-run a version it
# has recorded — so an edit to an *already applied* migration means the schema on disk and the
# schema in the database have silently diverged. That is what this detects.
set -euo pipefail

# The whole body is one compound command so bash parses it before running any of it: this
# script git-pulls itself, and a half-read script resumes at a byte offset into the new file.
{
	REPOSITORY=/opt/calliope
	COMPOSE_FILE="$REPOSITORY/docker-compose.deploy.yaml"
	ENV_FILE="$REPOSITORY/.env"

	# Only `testing` is reset when a migration calls for it, and only `testing` gets seed
	# accounts — see the PUBLIC_ENVIRONMENT comment in .example.env. `development` is not a
	# deploy target.
	DEPLOYABLE=(testing staging production)
	RESETTABLE=testing

	environment=""
	dry_run=false

	while [ $# -gt 0 ]; do
		case "$1" in
		--environment)
			environment="${2-}"
			shift 2
			;;
		--environment=*)
			environment="${1#*=}"
			shift
			;;
		--dry-run)
			dry_run=true
			shift
			;;
		*)
			echo "Unknown argument: $1" >&2
			echo "Usage: deploy.sh --environment <${DEPLOYABLE[*]}> [--dry-run]" >&2
			exit 2
			;;
		esac
	done

	fail() {
		echo "$@" >&2
		exit 1
	}

	compose() {
		docker compose -f "$COMPOSE_FILE" "$@"
	}

	# ---------------------------------------------------------------- what am I deploying to

	[ -n "$environment" ] ||
		fail "--environment is required: one of ${DEPLOYABLE[*]}."

	printf '%s\n' "${DEPLOYABLE[@]}" | grep -qx "$environment" ||
		fail "--environment must be one of ${DEPLOYABLE[*]}, not \"$environment\"."

	[ -f "$ENV_FILE" ] || fail "No $ENV_FILE. See README.md."

	# Only this variable is read, and only from a line that assigns it: sourcing .env would run
	# whatever is in it and export the SMTP password into this shell.
	declared="$(sed -n 's/^[[:space:]]*PUBLIC_ENVIRONMENT[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" |
		tail -n 1 | tr -d '"'"'" | tr -d '[:space:]')"

	[ -n "$declared" ] ||
		fail "$ENV_FILE declares no PUBLIC_ENVIRONMENT. See .example.env."

	# The flag is a statement of intent, not a lookup — the mistake worth catching is running
	# this against a server you did not think you were on.
	[ "$declared" = "$environment" ] ||
		fail "Refusing to deploy: you said --environment $environment, but $ENV_FILE says $declared."

	cd "$REPOSITORY"

	# ------------------------------------------------------------------- what would change

	old="$(git rev-parse HEAD)"
	git fetch --quiet origin
	new="$(git rev-parse '@{u}')"

	if [ "$old" = "$new" ]; then
		echo "Already at $(git rev-parse --short HEAD); nothing to pull."
		changed=""
	else
		echo "$(git rev-parse --short "$old") → $(git rev-parse --short "$new")"
		changed="$(git diff --name-only "$old" "$new")"
	fi

	# --no-renames on purpose. Git reports a renamed migration as R, and three of them in this
	# repository's history kept their version prefix while rewriting the body — an applied
	# version whose content changed, which is exactly the case this exists to catch, and which
	# a check for M alone misses. Without rename detection each becomes a D and an A, and all
	# three letters are candidates: M changed it, D removed the migration that produced the
	# applied schema, and A reuses a version that has already run and so will not run again.
	touched_migrations="$(git diff --name-status --no-renames "$old" "$new" -- database/migrations/ |
		awk '{ print $2 }')"

	# Read unconditionally, rather than only when this pull touches a migration: the check
	# below is about whether the database and the checkout agree *now*, and they can have
	# diverged in an earlier deploy whose diff this one knows nothing about.
	applied=""
	applied_known=false
	database_state="$(compose ps --format '{{.State}}' db 2>/dev/null | tail -n 1 || true)"

	if [ "$database_state" != "running" ]; then
		# A first deploy, or a stack that is down: nothing can have been applied, so nothing
		# can have diverged.
		echo "The db container is ${database_state:-absent}; nothing has been applied yet."
	else
		# Asked separately, because the table is absent until dbmate's first run and a query
		# against a missing table fails at parse time. Anything else failing here is a real
		# problem and must not be read as "nothing is applied" — that skips the rebuild.
		table_exists="$(compose exec -T db psql -U calliope -d calliope -tAc \
			"select to_regclass('migration.schema_migration') is not null" </dev/null 2>/dev/null)" ||
			fail "Cannot read the applied migrations from the database. Fix that before deploying:
a failure here would look exactly like a database with nothing applied, and skip a rebuild
that is needed."

		if [ "$table_exists" = "t" ]; then
			applied="$(compose exec -T db psql -U calliope -d calliope -tAc \
				'select version from migration.schema_migration' </dev/null)"
			applied_known=true
		else
			echo "dbmate has not run here yet; there is nothing applied to compare."
		fi
	fi

	stale_versions=""
	for migration in $touched_migrations; do
		version="$(basename "$migration" | cut -d _ -f 1)"
		if printf '%s\n' "$applied" | grep -qx "$version"; then
			stale_versions="$(printf '%s\n%s' "$stale_versions" "$version")"
		fi
	done
	# One line each, and a rename arrives as both a D and an A of one version, so -u names it
	# once. `|| true`: grep finds nothing when the list is empty, which is the ordinary case.
	stale_versions="$(printf '%s\n' "$stale_versions" | grep -v '^[[:space:]]*$' | sort -u || true)"

	# The differential check above answers "did this pull edit something already applied?".
	# This one answers "do the database and the checkout agree at all?" — the accumulated state,
	# which no single diff can see. dbmate records only a version and no checksum, so the sets
	# are all there is to compare: matching versions never prove matching content.
	versions() { printf '%s\n' "$1" | grep -v '^[[:space:]]*$' | sort -u || true; }

	# From the commit being deployed, not from the working tree: at this point nothing has been
	# pulled yet, so the files on disk are the *old* checkout and an incoming migration would be
	# invisible — the plan would report a database that matches a checkout it is about to
	# replace. After the fast-forward the two agree, which is what lets the post-condition below
	# reuse this.
	file_versions=""
	for migration in $(git ls-tree -r --name-only "$new" -- database/migrations/); do
		file_versions="$(printf '%s\n%s' "$file_versions" "$(basename "$migration" | cut -d _ -f 1)")"
	done

	orphaned_versions=""
	unapplied_versions=""
	if [ "$applied_known" = true ]; then
		# Applied but absent from the checkout: a rollback to an older commit, a deleted
		# migration, or one renamed to a different version leaving the old one behind. The
		# schema then holds objects this checkout never defines.
		orphaned_versions="$(comm -23 <(versions "$applied") <(versions "$file_versions"))"

		# Present but never applied. Ordinarily the migrations this deploy is about to run, so
		# it is reported rather than refused; the post-condition after the deploy is what turns
		# a leftover into a failure.
		unapplied_versions="$(comm -13 <(versions "$applied") <(versions "$file_versions"))"
	fi

	rebuild=false
	[ -n "$stale_versions" ] && rebuild=true
	# The same divergence as an edited migration, and the same remedy.
	[ -n "$orphaned_versions" ] && rebuild=true

	# Any compose change gets --force-recreate. A changed network option needs it — compose
	# recreates the network but only *restarts* the containers, which then hold stale DNS — and
	# telling that change apart from the rest by reading YAML is more fragile than restarting
	# containers that a compose change was going to restart anyway.
	recreate=false
	printf '%s\n' "$changed" | grep -qx 'docker-compose.deploy.yaml' && recreate=true

	# Caddy reads its bind-mounted config once, at startup, and `up -d` compares the service
	# definition — which a changed file does not alter. Without this the deploy reports success
	# while the routing is unchanged.
	recreate_caddy=false
	printf '%s\n' "$changed" | grep -qx 'Caddyfile' && recreate_caddy=true

	# ------------------------------------------------------------------------------ the plan

	echo
	echo "Plan for $environment:"
	if [ "$rebuild" = true ]; then
		echo "  ! rebuild the database"
		if [ -n "$stale_versions" ]; then
			echo "    these applied migration versions changed:"
			for version in $stale_versions; do echo "      $version"; done
		fi
		if [ -n "$orphaned_versions" ]; then
			echo "    these versions are applied but no migration defines them:"
			for version in $orphaned_versions; do echo "      $version"; done
		fi
		if [ "$environment" = "$RESETTABLE" ]; then
			echo "    every row is deleted, every account included, then seed data is written"
		fi
	elif [ "$applied_known" != true ]; then
		echo "  migrations: nothing applied was edited"
	elif [ -n "$unapplied_versions" ]; then
		# `wc -l` counts newlines, and `versions` ends every line with one — printing the value
		# with `printf '%s'` instead reported a single migration as zero.
		echo "  migrations: $(versions "$unapplied_versions" | wc -l | tr -d ' ') to apply, nothing applied was edited"
		for version in $unapplied_versions; do echo "      $version"; done
	else
		echo "  migrations: the database matches the checkout"
	fi
	[ "$recreate" = true ] && echo "  --force-recreate (the compose file changed)"
	[ "$recreate_caddy" = true ] && echo "  --force-recreate caddy (the Caddyfile changed)"
	echo

	if [ "$rebuild" = true ] && [ "$environment" != "$RESETTABLE" ]; then
		fail "Refusing to rebuild the database on $environment: only $RESETTABLE is reset when a
migration calls for it. Either add a migration instead of editing or removing an applied one,
or follow \"After a migration was edited rather than added\" in README.md by hand, knowing what
it costs."
	fi

	if [ "$dry_run" = true ]; then
		echo "Dry run: nothing was pulled and nothing was changed."
		exit 0
	fi

	# ------------------------------------------------------------------------------- deploy

	# --ff-only, so a deploy never invents a merge commit on the server.
	[ "$old" = "$new" ] || git merge --ff-only "$new"

	up_flags=()
	[ "$recreate" = true ] && up_flags+=(--force-recreate)

	# --dirty so a file edited on the server says so, rather than claiming to be the commit.
	# Exported because compose interpolates from the shell in preference to .env, which is what
	# lets a deploy stamp a build without writing to a file nobody meant to change.
	PUBLIC_GIT_COMMIT="$(git describe --always --dirty)"
	export PUBLIC_GIT_COMMIT

	if [ "$rebuild" = true ]; then
		# Stop the backend first, or its open connections make `drop` fail with "database is
		# being accessed by other users". And `up`, not the service's own `migrate` command:
		# after a drop there is no database, and only `dbmate up` creates one.
		compose stop backend
		compose run --rm migrate drop
		compose run --rm migrate up
	fi

	compose up -d --build ${up_flags[@]+"${up_flags[@]}"}

	# Only when the compose file did not change; otherwise Caddy was just recreated with it.
	if [ "$recreate_caddy" = true ] && [ "$recreate" = false ]; then
		compose up -d --force-recreate caddy
	fi

	if [ "$rebuild" = true ]; then
		# --force clears the "does not look local" guard, which sees the compose hostname `db`.
		# It cannot reach staging or production: the seed refuses any PUBLIC_ENVIRONMENT outside
		# development and testing, with or without the flag.
		compose run --rm --no-deps backend --seed --force
	fi

	# -------------------------------------------------------------------------------- verify

	host_url="$(sed -n 's/^[[:space:]]*HOST_URL[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" |
		tail -n 1 | tr -d '"'"'" | tr -d '[:space:]')"

	# Every migration the checkout defines must be applied by now. The backend already waits on
	# `migrate` completing, so this is the second lock rather than the first — but a version
	# that silently did not run leaves the schema short of what the code expects, and that is
	# worth one query to rule out.
	still_applied="$(compose exec -T db psql -U calliope -d calliope -tAc \
		'select version from migration.schema_migration' </dev/null)"
	still_unapplied="$(comm -13 <(versions "$still_applied") <(versions "$file_versions"))"

	[ -z "$still_unapplied" ] || fail "Deployed, but these migrations are still not applied:
$still_unapplied
The schema is behind what this commit expects. \`compose logs migrate\`."

	echo
	echo -n "Waiting for the backend to report healthy "
	for _ in $(seq 60); do
		state="$(compose ps --format '{{.Health}}' backend 2>/dev/null | tail -n 1)"
		[ "$state" = "healthy" ] && break
		echo -n .
		sleep 2
	done
	echo
	[ "${state:-}" = "healthy" ] ||
		fail "The backend is \"${state:-unknown}\" after two minutes. \`compose logs backend\`."

	# Through Caddy over the real address, because a healthy container proves nothing about
	# TLS, the routing, or the frontend build that Caddy serves. Both halves are checked
	# separately: they are built by different services, and a current backend behind a stale
	# bundle is exactly what a single 200 hides.
	if [ -n "$host_url" ]; then
		health="$(curl -sS --max-time 20 "$host_url/api/health")"
		printf '%s' "$health" | grep -q "\"releaseId\":\"$PUBLIC_GIT_COMMIT\"" ||
			fail "The backend reports $(printf '%s' "$health" | sed -n 's/.*"releaseId":"\([^"]*\)".*/\1/p' |
				head -n 1), not $PUBLIC_GIT_COMMIT. Something older is still answering."

		frontend="$(curl -sS --max-time 20 "$host_url/")"
		printf '%s' "$frontend" | grep -q "name=\"commit\" content=\"$PUBLIC_GIT_COMMIT\"" ||
			fail "The frontend Caddy serves is not from $PUBLIC_GIT_COMMIT. The frontend build
did not reach it. If \`frontend/dist\` was replaced rather than refilled, Caddy is holding the
directory it mounted at startup and needs recreating:
  compose up -d --force-recreate caddy"

		echo "$host_url serves $PUBLIC_GIT_COMMIT, backend and frontend both."
	else
		echo "No HOST_URL in $ENV_FILE; skipped the end-to-end check." >&2
	fi

	echo "Deployed $PUBLIC_GIT_COMMIT to $environment."
	exit 0
}

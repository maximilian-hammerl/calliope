#!/usr/bin/env bash
# The forced command of the key the CI deploy job connects with: `ssh-deploy.sh <environment>` in
# the server's authorized_keys. `systemctl start` blocks on the oneshot unit and fails with it.
set -euo pipefail

# One compound command, as in deploy.sh: the deploy pulls this file while it waits here.
{
	unit="calliope-deploy@$1.service"

	# A start while one runs joins it and returns its result, which would pass off the earlier
	# commit's deploy as this one's.
	if [ "$(systemctl show --property ActiveState --value "$unit")" = activating ]; then
		echo "A deploy is still running; this run deployed nothing. Re-run it once that one ends." >&2
		exit 1
	fi

	since="$(date +%s)"
	status=0
	systemctl start "$unit" || status=$?

	# The last lines can still be on their way into the journal when the unit ends.
	journalctl --sync
	journalctl --unit "$unit" --since "@$since" --output cat --no-pager
	exit "$status"
}

---
name: validate
description: Run validate:check in all three projects plus the backend's open-api:check, and report the result as one table. Pass --fix to run the fix variants first.
user-invocable: true
---

Run the checks every project defines, in this order, and keep going after a failure so the table is
complete. `$ARGUMENTS` may contain `--fix`.

1. If `--fix` was given, run the repairs first: `deno task validate:fix` in `backend/` and
   `database/`, `npm run validate:fix` in `frontend/`.
2. `frontend/src/api/` is git-ignored; if it is missing, run `npm run open-api:generate-client` in
   `frontend/` first, or the type check fails on absent imports.
3. Run, each from its own directory:
   - `backend/`: `deno task validate:check`, then `deno task open-api:check`
   - `database/`: `deno task validate:check`
   - `frontend/`: `npm run validate:check` (format, lint, types, knip)
4. Report one row per command — project, command, pass/fail, and for a failure the first error
   verbatim. Do not summarise a failure as "some lint errors"; quote it.

Do not stage or commit anything `--fix` changed; list the files it touched instead.

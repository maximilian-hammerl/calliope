---
name: regenerate
description: Regenerate the type chain end to end — database types, the OpenAPI document, the frontend client — and report which links changed. Run after a migration or a route change.
user-invocable: true
---

The database is the origin of the types, so a change to one link has to be regenerated into every
link after it. Run the whole chain, in order, and report the diff at each step rather than stopping
at the first — a changed `schema.ts` means the two downstream links are stale too.

1. `database/`: `deno task types:generate`
2. `backend/`: `deno fmt src/database/schema.ts` — the generator's output is not fmt-clean, and
   without this step the file always shows as changed. Then `git diff --stat src/database/schema.ts`.
3. `backend/`: `deno task open-api:generate`, then `git diff --stat open-api.json`. Generate with
   `.example.env`'s `HOST_URL`, as CI does, or the `servers` entry differs.
4. `frontend/`: `npm run open-api:generate-client` — writes the git-ignored `src/api/` and
   `src/api/textLimit.ts`, so there is nothing to diff; run `npm run type-check` instead to see
   whether the client's shape moved under the code.

Report one line per link: unchanged, or what changed (a column, a path, a schema). A change in
`open-api.json` you did not intend is a route or schema that drifted — say so rather than committing it.

---
paths:
  - "backend/Dockerfile"
  - "backend/package.json"
  - "backend/main.ts"
  - "backend/src/app.ts"
  - "backend/src/logging.ts"
  - "backend/src/branding.ts"
  - "backend/src/middleware/rate_limit.ts"
  - "backend/src/cron.ts"
---

# Runtime, logging, rate limits, branding

## The runtime

The image is `gcr.io/distroless/nodejs26-debian13:nonroot` — Node and nothing else, no shell and no
package manager, so a dependency can never be a binary started as a child process. Node runs the
TypeScript as it is, stripping the types, so the image carries the source and the production
`node_modules` that `pnpm deploy` puts beside it. It is built from the repository root, where the
workspace keeps its lockfile; `Dockerfile.dockerignore` narrows that context to the backend.

**The server runs under Node's permission model**, in the image's entrypoint and in `pnpm run dev`
and `start`: it may read the app and the uploads, write only the uploads, load `sharp`'s native
addon (#94, `--allow-addons`) and use the network. Two of those are real widenings — an addon can
step around the model, which Node warns about at every start, and `--allow-net` is all or nothing
and still experimental — and environment variables and system information are not restricted at
all. Weigh the next request for a permission the same way rather than by precedent. `pnpm run dev`
adds `--allow-child-process`, because `--watch` starts the server as its child. A refused access
throws `ERR_ACCESS_DENIED` naming the resource; nothing prompts. The entrypoint names `/data/files`
because an exec-form entrypoint cannot read `FILE_STORAGE_PATH`, so the variable stays that in the
image. **Anything with a native addon has to be tried against the actual image**, not only
`pnpm run dev`: build it, run it against the dev stack and upload an avatar.

## The log

`src/logging.ts` configures LogTape once; only `main.ts` calls `configureLogging()`, which is why
tests are silent. **One line per request** (method, path, status, duration) — two lines with nothing
tying them together left a production 400 naming no route. **A refusal is logged where it is
produced, in the `defaultHook`**, which *returns* rather than throws, so `onError` never sees it; the
line carries the mapped `{path, message}` issues and no value a member typed. JSON lines in every
environment, for everything the server says: `console` is for the command-line scripts only, which
the lint enforces. An `Error` goes in as a property, and `logging.ts` writes its name, message,
stack, code and cause and nothing else: drivers keep row values and query parameters in fields of
their own (a unique violation's `detail` names the address), and postgres.js's `toJSON` drops the
stack. The
level comes from `PUBLIC_ENVIRONMENT`: `trace` in development, `debug` on testing, `info` beyond — a
healthy `/api/health` logs at `trace` because the container polls it every ten seconds. LogTape's
meta logger is pinned to `warning`.

## Two rate-limit budgets, split by method

`GET`, `HEAD` and `QUERY` share one budget, everything else another, keyed by address over fifteen
minutes — one budget meant an afternoon of reading left a member unable to save a draft. A method
added later counts as a write, so it is limited more tightly rather than not at all. Both numbers
are measured: a thread page costs eleven reads (500 ≈ forty-five page loads), and the composer's
autosave is a `PATCH` every two seconds, so writes get 250 rather than the sixty "writes are rare"
would suggest. Each limiter skips what the other counts, which keeps the draft-7 `RateLimit` headers
coherent, and the **scope travels in the 429 body** because the client says different things for each.

## The deployment's own name

Anything that names the product reads `branding.ts`, never a literal — defaults rather than required
variables, because `open-api.json` is generated with nothing set and committed. The contact block
is omitted when no operator supplies one. Component names (`CalliopeBadge`), the systemd units, the
compose project and the database name are identifiers and stay.

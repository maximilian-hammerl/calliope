---
paths:
  - "backend/Dockerfile"
  - "backend/deno.jsonc"
  - "backend/main.ts"
  - "backend/src/app.ts"
  - "backend/src/logging.ts"
  - "backend/src/branding.ts"
  - "backend/src/middleware/rate_limit.ts"
  - "backend/src/cron.ts"
---

# Runtime, logging, rate limits, branding

## The runtime

The image is `gcr.io/distroless/cc-debian12:nonroot` — no shell, no package manager, so a dependency
can never be a binary invoked through `Deno.Command`. It runs `deno run`, not `deno compile`: a
compiled binary cannot load a native addon, and `sharp` (#94) needs one; measured against the wasm
alternative, compiling cost 34 ms per image and 81 MB. Consequences: the image carries Deno, the
source and `node_modules` (`"nodeModulesDir": "auto"`), and the permission set includes
`--allow-ffi` and `--allow-sys` — a real widening, bought for a 3.6× faster image path; weigh the
next such request the same way rather than by precedent.

`sharp` calls `detect-libc` at import, which reads `/proc/self/exe` and `/usr/bin/ldd`; both are in
the read list for that alone. **Without a terminal Deno denies silently; with one it stops and
asks** — so the entrypoint and the healthcheck pass `--no-prompt`, and a permission problem is
reproduced with `docker run -t` or not at all. The dev tasks deliberately prompt. **Anything with a
native addon has to be tried against the actual runtime**, not only `deno task dev`.

## The log

`src/logging.ts` configures LogTape once; only `main.ts` calls `configureLogging()`, which is why
tests are silent. **One line per request** (method, path, status, duration) — two lines with nothing
tying them together left a production 400 naming no route. **A refusal is logged where it is
produced, in the `defaultHook`**, which *returns* rather than throws, so `onError` never sees it; the
line carries the mapped `{path, message}` issues and no value a member typed. JSON lines in every
environment; `describeError` spells an error out because `JSON.stringify(new Error())` is `{}`. The
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

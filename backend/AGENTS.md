# Backend

Deno, Hono and `@hono/zod-openapi` over Kysely and Postgres 18. The shared conventions are in the
root [AGENTS.md](../AGENTS.md); the reasoning behind each area is in `.claude/rules/backend/`,
which loads when you open that area's files.

```bash
deno task dev                 # --watch, on $BACKEND_PORT; stop it with kill -KILL on the process group
deno task test                # --parallel, against the compose stack with migrations applied
deno task validate:check      # format, lint, type-check  (validate:fix repairs what it can)
deno task db:seed             # the fixture: nine accounts, password `calliope`
```

- **File names are `snake_case`**, tests beside their module as `<module>_test.ts`.
- **Zod schemas are constants**: `REGISTER_BODY`, not `RegisterBody`. Infer types from them,
  `z.infer<typeof X_RESPONSE>`, rather than writing both.
- `@/` points at the project root: `@/src/service/user_service.ts`.

## Where things live

`route/` mirrors the URL and is not reorganised. `service/` is **flat**, with the domain in the
prefix (`writing_group_service.ts`); grouping it would repeat the word and rename every module.
`http/` holds response helpers and schemas, `list/` the list convention, `query/` builder helpers
with no authorisation and no side effects, `event/` the in-process SSE fan-out, `mail/` the transport
and the messages, `test/` fixtures that nothing shipping imports. `app.ts` composes everything;
`text_limit.ts` is the origin of every length bound and is imported, never restated.

## Routes

One route per file, `new OpenAPIHono().openapi(createRoute({…}), handler)`; a file that groups
routes sits beside the directory it groups (`route/groups.ts` mounts `route/groups/`). `app.ts`
mounts the one `api` app at `/api`, so route files never repeat the prefix. Mount literal segments
before parameters, or `/me` is swallowed by `/:userId`.

- **Use `app.openapi()`**, not `defineOpenAPIRoute` — only the former types `c.get("user")` from the
  route's middleware.
- **Two or more middleware need `as const`**: `[authenticated, authorizedAsModerator] as const`.
  Without it the array widens and `c.get("user")` becomes `never`, with no hint of the cause.
- **Authentication first, then authorization.** `authenticated` says who is asking (and refuses an
  unverified address with 403); `authorizedAs…` says what they may do. Choosing nothing gets the
  strict middleware, so a forgotten route fails closed.
- **Every declared response needs `content`.** One content-less response widens the handler's
  return type to `Response` and **silently disables the body and status checks for the whole
  route**. Prefer `200 { ok: true }` over a bodyless 204 for the same reason. Spread
  `...COMMON_RESPONSES` and `...BAD_REQUEST_RESPONSE` into every route, and `...FORBIDDEN_RESPONSE`
  where the route has no 403 of its own.
- **A wrong password is `INVALID_CREDENTIALS_BODY`**, a constant, never a helper — a helper
  returning `c.json(…)` widens the return type the same way. Its `code: "invalid_credentials"` is
  how the frontend tells a wrong password from a lost session; a bare 401 signs the member out.
- **After changing a route, run `/regenerate`**, which does the document and the frontend's client
  in order. Generate with `.example.env`'s `HOST_URL`, as CI does. `open-api:lint` is disabled in
  CI — Spectral does not read the 3.2 document that the QUERY method requires.

## Schemas

Build request schemas from the generated `src/database/schema.ts` with `.pick()`, `.extend()` and
`.keyof().extract()`, never by restating columns; a renamed column is then a compile error. What the
database cannot express — an email format, a minimum — goes in `.extend()`. **A `refine` reaches
neither the document nor the client**; where JSON Schema has a word for the rule, declare it with
`.meta()` beside the refine, or use a discriminated union, as `moveReport` does. Responses come from
`http/response_schema.ts` and add joined names (`createdByUsername`), never a bare id; where a
response covers several kinds, it is a discriminated union, not a flat shape with nullable columns.
`EMAIL_ADDRESS_SCHEMA` is the one email schema — Zod's default is stricter than the browser's.

## Lists

List endpoints use the **HTTP QUERY method** with a `required: true` body, `listQuerySchema()`,
`listResponseSchema()` and `listResultsWithCount()`, which page and count from one builder.
`sortAttribute` is an enum derived from the table's columns because it reaches `dynamic.ref`; `id`
is always the last sort term; `search` goes through `searchPattern()`. `.claude/rules/backend/lists.md`
has the rest, including the two collections that are deliberately GETs.

## Data access

- **`db` has no `insertInto`, `updateTable` or `deleteFrom`.** A write cannot happen outside a
  transaction, and the compiler says so. A write service function takes `transaction: Transaction`
  as its **first** parameter; the entry point opens it — a route, `cron.ts`, a background task, the
  seed, a test through `write()`. A read takes an optional **last** `executor: typeof db |
  Transaction = db`. The position says which kind it is.
- **A write's read-back uses the transaction**, or it sees the row before its own update. Threading
  the executor down is what most of the `executor` parameters are for; getting it wrong is silent.
- **Work that must follow the commit stays outside it** — the few services that send mail after
  writing open their own transaction. Expensive work stays outside too: `changePassword` hashes
  before opening one.
- **Never raw SQL without asking.** The builder is checked; a template string is not. The two raw
  fragments that exist are the liveness ping and `database/test/`. `sql.lit` is not a template and
  is allowed where a string must be a literal — a partial index's predicate, see `reports.md`.
- **Every `switch` over a union ends in `default: return assertUnreachable(value)`**, so a new
  enum member is a compile error naming the missing case.
- Timestamps a write sets come from the application clock, `Temporal.Now.instant().toString()`,
  not `sql\`now()\`` — which is why raw SQL stays at two fragments. The cost: one can differ by
  milliseconds from a `DEFAULT now()` column in the same row. Only `user` and `user_session` have
  `updated_at`.

## Authorisation

Check what the user may *see* before what they may *do*, and answer anything they may not see with
**404**, never 403, so its existence stays hidden. A read of a group asks `selectVisibleWritingGroup`
(a public group is readable by anyone signed in); a write asks `selectRoleForUser`, which returns a
role only for a *joined* membership. Acts are named against one table — `mayAct(role, "page:change")`
for groups, `mayActInForum(…)` for the forum — never chosen between helpers. A block means contact,
not visibility, and refuses with a neutral 403.

## Notifications and mail

A producer writes its notification **in the same transaction** as the thing that happened, never to
the actor, only for a change that changed something, only to joined members. Handlers **never await
a send**: `Mailer.sendInBackground`, or the response time becomes an account oracle. Mails are text.

## Tests

One positive and one negative case per route, against real Postgres, Redis and Mailpit. **The suite
runs `--parallel`**, so every file owns its identities: a shared fixture is a **factory taking a
scope** (`authFixture("login")`), never module-level constants. Never empty shared state
(`deleteMailFor([address])`, not `deleteAllMail()`), never assert a global count (`includes`, or a
baseline delta), scope every fixture query to its own account. `clearRateLimits()` spares
`RATE_LIMIT_TEST_CLIENTS`. Auth tests go through the app by hand, since registering is the thing under
test. Prefer assertions that fail for the right reason — a *different* user still sees the group, not
merely a 200. Prove a guard by perturbing it: remove the check, watch the test fail, restore it.

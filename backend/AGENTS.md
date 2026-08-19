# Backend

Deno, Hono and `@hono/zod-openapi` over Kysely and Postgres. Tasks are `deno task …` — see
the root [AGENTS.md](../AGENTS.md) for the conventions shared with the other projects.

- **Zod schemas are constants**, so `REGISTER_BODY`, not `RegisterBody`.
- **Imports use the `@/` alias**, which points at the project root:
  `@/src/service/user_service.ts`, not `../../../../service/user_service.ts`.
- **File names are `snake_case`**, and so are test files: `user_service.ts`,
  `user_service_test.ts`.

## Seed data

`deno task db:seed` fills a local database with a fixed fixture: four accounts sharing the
password `calliope`, a private and a public group, every membership state, threads with posts
and one unpublished draft, a chat with messages, and the notifications the invitations imply.
It prints the accounts and the URLs when it finishes.

Three things about it are deliberate:

- **Hard-coded ids.** A URL you bookmarked still works after a re-seed. `uuidv7()` is only a
  column default, so explicit ids are fine; they are obviously synthetic
  (`01a00000-0000-7000-8000-…`) so a seeded row is recognisable in a query.
- **Real password hashing.** It calls `hashPassword`, because scrypt lives in the application
  and pgcrypto was removed on purpose. A hard-coded hash would rot the day its parameters
  changed and the accounts would silently stop being able to sign in.
- **It owns its four usernames.** Cleanup matches id *or* username, so an account somebody made
  by hand as `mira` cannot block a re-run — and neither can renumbering the ids later.

It refuses any `DATABASE_URL` host that is not obviously local unless passed `--force`, because
it deletes rows. It refreshes only its own fixture, so half-built state you are testing
survives.

Inserted through Kysely rather than the services, since those generate their own ids. Database
triggers still apply — `invited_at`, `joined_at`, `last_activity_at`. What it restates rather
than invokes is service-level behaviour, notably the notification an invitation produces; if
that rule changes, this file changes with it.

## Where things live

`route/` mirrors the URL and is not reorganised — see below. Everything else is grouped by what
it is: `http/` (response helpers and their schemas), `list/` (the shared list convention),
`operations/` (liveness, matching the `OPERATIONS_TAG` the spec already uses), `event/`
(in-process fan-out for SSE, infrastructure like `database/` and `redis/` rather than a
service), `mail/` (the SMTP transport and the messages themselves, infrastructure for the
same reason), `service/`, `util/`, `middleware/`, `database/`, `redis/`.

A few files stay at `src/`'s root deliberately: `app.ts` composes everything, `text_limit.ts`
is domain constants read across layers, `test_support.ts` is test-only, and
`open_api_specification.ts`, `cron.ts` and `cors_options.ts` are app-wide configuration.

`service/` is flat on purpose. Grouping it by domain would give `service/writing/writing_group_service.ts`
— the word twice — so it would also mean dropping the prefixes, turning a move into renaming
every module. The prefixes already sort them by domain.

**Careful with `database/`.** `database/.kysely-codegenrc.ts` has
`outFile: "../backend/src/database/schema.ts"`; move that directory and the generator silently
rebuilds the old path. Nothing else outside TypeScript names a backend source path.

## Tests sit next to what they test

`<module>_test.ts` beside the module, one file per route. `auth/` shows the shape: `login_test.ts`,
`logout_test.ts`, `me_test.ts` and `register_test.ts` next to their routes, with `auth_test.ts`
keeping only what is not about a single one — the body-limit test, which is about the app and
merely uses a route to get there. Setup those files share lives in `auth/auth_test_support.ts`,
which is not named `*_test.ts` so the runner does not collect it.

Auth tests cannot use `test_support.ts`'s `registerUser` and `request`: registering and sending
a session is the thing under test, so they go through the app by hand.

## Route files mirror the URL

One route per file, and the directory structure follows the path. A file that groups
routes sits next to the directory it groups:

```
route/groups.ts                    → mounts everything under /groups
route/groups/create_group.ts       → POST /groups
route/groups/list_groups.ts        → QUERY /groups
route/groups/group.ts              → mounts everything under /groups/{groupId}
route/groups/group/get_group.ts    → GET /groups/{groupId}
route/users/list_users.ts          → QUERY /users
```

`app.ts` builds one `api` app and mounts it at `/api`, so the served paths are
`/api/groups`, and so on. Route files never repeat the prefix. Everything the backend serves
lives under that one prefix, which is what lets the Caddy matcher and the Vite dev proxy each
be a single rule instead of a list that has to be kept in step with the routes.

`app.doc31()` stays on the *root* app rather than on `api`: the document is built from an
app's own registry, so registering it on `api` would emit every path without the prefix it is
actually served under.

Each leaf exports `new OpenAPIHono().openapi(createRoute({…}), handler)`. Use
`app.openapi()` rather than `defineOpenAPIRoute`: only the former derives the handler's
environment from the route's middleware, so `c.get("user")` stays typed.

Write `middleware: requireSession`, not `middleware: [requireSession]`. An array widens to
`MiddlewareHandler[]`, which loses the middleware's environment and leaves `c.get("user")`
as `never`.

Mount literal segments before parameters, or `/me` is swallowed by `/:userId`.

## Every declared response needs a content schema

This is not a style preference. `@hono/zod-openapi` only type-checks a handler's return
value when *every* declared response has `content`. One content-less response — a bare
`404: { description: "…" }` — widens the return type to plain `Response` and **silently
disables the body and status checks for the whole route**.

For the same reason, prefer `200` with `{ ok: true }` over a bodyless `204`.

Spread `...COMMON_RESPONSES` (429 and 500) and `...BAD_REQUEST_RESPONSE` into every route.
Anything the rate limiter or the global error handler can return has to be documented, or
the specification lies.

## Schemas come from the database

`src/database/schema.ts` is generated by `cd database && deno task types:generate` and holds
both the Kysely types and zod schemas. Build request schemas from those with `.pick()`,
`.extend()` and `.keyof().extract()`, rather than restating columns:

```ts
const CREATE_GROUP_BODY = WRITING_GROUP_SCHEMA
	.pick({ title: true, description: true, visibility: true })
	.extend({ title: WRITING_GROUP_SCHEMA.shape.title.min(1) });
```

A renamed column then breaks compilation instead of quietly producing an API that documents
a field the database no longer has. Constraints the database cannot express — an email
format, a minimum length, a default — belong in `.extend()`.

**Responses come from `src/response_schema.ts`**, not from the table schemas directly. Those
add the author's name to what the table stores, because a client should never have to resolve
a user id itself to show who wrote something. The name is joined, never stored, so it follows
a rename; it is null wherever the author's account has been deleted.

## List endpoints

Use `listQuerySchema()` and `listResponseSchema()` from `list_endpoint.ts`, and
`listResultsWithCount()` from `list_endpoint_query.ts`. They page and count from a single
query builder, so the page and its total can never disagree.

List endpoints use the **HTTP QUERY method** (RFC 10008), so parameters arrive as a typed
JSON body. Mark the body `required: true`: with `required: false` an absent body skips
validation entirely and the schema's defaults never apply.

`sortAttribute` must be an enum derived from the table's own columns, because its value
reaches `dynamic.ref`. An unchecked value there is an injection.

`text_limit.ts` is the origin of every bound, and they do not stop at the API: they travel
through the Zod request schemas into `open-api.json`, and the frontend generates
`src/api/textLimit.ts` from that document so its inputs enforce the same numbers. Changing a
limit here changes the interface too, after `open-api:generate`. Never restate a bound at a
route — import it.

`search` comes with `listQuerySchema()`, so every list endpoint takes it and they stay in
step; which columns it looks at is the endpoint's own business. Build the pattern with
`searchPattern()` from `list_endpoint_query.ts` rather than interpolating — `%` and `_` are
meaningful to `like`, so an unescaped term matches rows the member never asked for. Matching
is `ilike` on a substring, because someone looking for a name often remembers its middle
rather than its start.

Apply it with Kysely's `$if()` rather than reassigning the builder through an `if` — the
[conditional-selects recipe](https://kysely.dev/docs/recipes/conditional-selects) is explicit
about this, and reassignment loses the builder's type as it accumulates. The non-null
assertion inside the callback is the accepted cost of that pattern.

The term has a minimum length (`TEXT_MINIMUM.search`), which is what keeps a list from being
walked page by page under a one-character filter. It is optional everywhere, `QUERY /users`
included: the five endpoints behave alike. That endpoint's response is `USER_RESPONSE` — id
and username only. A username is public within the platform; an email address never is, and
the schema *picks* rather than omits so a column added later cannot leak by being forgotten.

## Timestamps

Only `user` and `user_session` carry `updated_at`, where it is a debugging convenience. No
other table has one, and none of them has a `set_updated_at` trigger: nothing in the product
asked what a group or a thread last changed, and a column that exists without a reader drifts
into being trusted for things it never meant. Where a time genuinely matters it is named for
what it means — `last_activity_at`, `edited_at`.

## The deployment's own name

Anything that names the product reads from `branding.ts`, never a literal: Calliope is meant to
be run by other communities under their own name. Defaults rather than required variables,
because `open-api.json` is generated with nothing set and committed — a required variable would
make the document differ per developer and fail `open-api:check`.

The contact block is **omitted** when no operator supplies one. A maintainer's address left as
a default would sit in a public repository forever.

Component names (`CalliopeBadge`, `CalliopeLogo`) are identifiers, not branding, and stay. So do
the systemd units, the compose project and the database name.

## Never raw SQL without asking

Kysely's builder is checked; a template string is not. `sql\`nov()\`` compiles, ships, and
fails at run time — nothing between writing it and production notices. Use the builder, and
where a value is needed use TypeScript: `Temporal.Now.instant().toString()` rather than
`sql\`now()\``.

If something genuinely cannot be expressed through the builder, **ask before writing it**.
There are two raw fragments in the codebase and both are deliberate: the liveness probe in
`database/client.ts`, which is a ping rather than a query, and the tests under `database/test/`,
whose whole purpose is to exercise the SQL itself.

## Exhaustive switches

A `switch` over a union ends with `default: return assertUnreachable(value)`
(`util/assert_unreachable.ts`, duplicated in the frontend as `lib/assertUnreachable.ts`).
TypeScript only narrows to `never` once every case is handled, so adding a notification type —
or a role, or a status — becomes a compile error naming the missing one, instead of a silent
fallthrough. Verified by deleting a case: the error reports which type is unhandled.

## Response shapes

Define the Zod schema and infer the TypeScript type from it — `z.infer<typeof X_RESPONSE>` —
rather than writing both. Most services get this for free by deriving from the generated
`database/schema.ts`; a response built out of joins does not, and that is exactly where a
hand-written second copy drifts.

Where a response covers several kinds of the same thing, make it a discriminated union rather
than one flat shape with nullable columns. `NOTIFICATION_RESPONSE` mirrors the table's CHECK
constraint that way, and it reaches the frontend through the generated client: reading a thread
title off an invitation is a type error there, where it used to be a silent empty string.

## Chats, and the single-instance constraint

Chat messages reach open streams through `chat/chat_events.ts`, which fans out **in process**.
That is correct while the backend runs as exactly one container, which it does — and it fails
*silently* if a second one ever appears: a member connected to one instance simply never sees
a message sent through the other. Swapping the two functions there for a Redis pub/sub pair is
the fix, and the client's refetch-on-reconnect means nobody loses anything across the change.

The stream itself (`route/chats/chat_events_stream.ts`) is a plain Hono route, not an OpenAPI
one: an endless `text/event-stream` cannot be described by `createRoute`, and pretending it
returns JSON would put a lie in the specification. Three things keep it alive — a heartbeat,
`flush_interval -1` in the Caddyfile so Caddy does not buffer it into oblivion, and closing
open streams on the shutdown signal so a deploy does not hang.

Chat history pages by **cursor**, not offset: messages arrive while somebody reads, and an
offset would repeat or skip whatever crossed the boundary. Ids are uuidv7, so comparing them
orders the conversation and one index serves both.

## Who is told what

Producers write their notification inside the same transaction as the thing that happened, so
an event cannot exist unannounced. Three rules they all share:

- **Never the actor.** `actor_id IS DISTINCT FROM recipient_id` is a constraint, so a producer
  that forgets does not merely say something odd — it fails the whole request. An administrator
  may change their own role, which is exactly where this bites.
- **Only a change that changes something.** A visibility notification is written when the
  value actually moves; a request that sends the value it already has, or renames the group,
  tells nobody. The producer reads the old row inside the same transaction to know.
- **Joined members only.** Group activity skips people who were invited and have not accepted:
  telling somebody what is being written in a group they are not part of yet is noise.
- **Drafts tell nobody.** A draft is visible only to its author, so `new_writing_post` is
  written when a post is published — on insert if it goes straight out, on the update that
  clears `is_draft` otherwise. Editing an already-published post announces nothing.

Timestamps in these paths come from the database clock (`sql\`now()\``), not the application's,
so rows written in one transaction agree with each other and with column defaults.

## Memberships

`invited_at` and `joined_at` are maintained by `set_membership_timestamps`, never by a caller.
Joining is a *transition*, not only an insert — a member invited on Monday and accepting on
Wednesday is UPDATEd from invited to joined — so the trigger covers both, and a service that
only stamped inserts would record nothing but the founder of each group. Both are nullable
because a row can exist without having reached the state a column records.

The interface shows whichever date matches the row's status — the invitation for a pending
one, the joining for a member — so both columns are stored, but only one is ever read per row.

## Drafts

A draft is a `writing_post` with `is_draft` set, not a separate table, and a partial unique
index allows one per member per thread — the composer holds exactly one. Three things follow,
and all three are covered by tests:

- **A draft moves no activity.** `set_last_activity_at_for_writing_thread` skips rows that are
  drafts. Otherwise every autosave would advance the thread and its group, which is untrue and
  discloses that a particular member is typing right now.
- **A post is dated from its publication.** Clearing `is_draft` also sets `created_at` to the
  transaction's `now()`. The draft's own creation is when writing *began*, which for a piece
  drafted over days would sort the post into the middle of the thread and mark it edited the
  moment it appeared.
- **An edit is `edited_at`, not two timestamps disagreeing.** It stays null through every
  autosave and through publication, and is set only when an already-published post is changed
  — the one case a reader is told about ("· bearbeitet"). `updatePost` is given the row's
  previous draft state to tell the three apart.
- **`listPosts` returns published posts by default.** Pass `isDraft: true` to get the caller's
  own. The filter selects among rows that are already readable; it cannot widen visibility,
  because `readableBy` still restricts drafts to their author.

## Authorisation

Check what the user may *see* before what they may *do*, and report anything they may not
see as **404** rather than 403, so its existence stays hidden. Use 403 only when the user
can already see the thing.

`WritingGroupService.selectRoleForUser` only returns a role for a *joined* membership;
someone invited as an administrator cannot administer until they accept.

## After changing a route

Regenerate the specification, or CI fails:

```bash
deno task open-api:generate
```

`open-api.json` is committed, and the frontend's client is generated from it, so regenerate
that too when the shape changes. `HOST_URL` ends up in the `servers` entry, so generate with
the same value CI uses — which is why CI copies `.env.example`.

`open-api:lint` is currently disabled in CI: the document declares `3.2.0` so the `query`
operations are legal, and Spectral only understands up to 3.1, so it silently falls back to
validating against the 3.0 schema.

## Passwords and session tokens

Hashed in the application, never in the database: `util/password.ts` (scrypt) and
`util/token.ts` (SHA-256). pgcrypto is gone, and with it the plaintext password's
trip into Postgres, where statement logging could have captured it.

A stored password reads `scrypt$cost$blockSize$parallelisation$salt$hash`. The parameters
travel with the hash, so raising the cost does not lock anyone out of an account whose hash
predates the change — a test covers exactly that. `verifyPassword` never throws on an
unreadable record; it simply does not match.

`selectUser` hashes against a throwaway hash when no account matches, so an unknown username
costs the same as a known one with the wrong password. Removing that would turn the response
time into a way to enumerate accounts.

`util/token.ts` is not session-specific despite where it started: session tokens and the
tokens inside mailed links are the same kind of secret and share one implementation. Keep
them apart by *purpose* in the database, not by hashing them differently.

## Mail

`mail/` holds the transport and the messages; `service/` decides that something should be
said. Three things about it are load-bearing:

- **Handlers never await a send.** `Mailer.sendInBackground` returns immediately. A send
  takes as long as the remote server feels like taking — one measurement against the
  production relay spent thirty seconds just opening the connection — and awaiting it would
  also make "no account has this address" answer measurably faster than the case where a
  message goes out, which is an account oracle. The cost is that a failure can only be
  logged, which is why the sending mailbox is read by hand; see `deployment/README.md`.
- **Tests read the message.** Mailpit is in `docker-compose.yaml` alongside Postgres and
  Redis, and `mail/mailpit_test_support.ts` fetches from it. A reset token is stored hashed,
  so the message is the only place its plaintext exists — testing the flow at all means
  going through the mail, which covers the link's shape for free. Await
  `Mailer.flushPendingSends()` first, or the assertion races the send.
- **Text, not HTML.** These messages are a few lines and a link. A second HTML copy of the
  same words is one more thing to keep in step, and the clients that prefer it are the ones
  most likely to rewrite the link.

## Tokens in links

`user_token` is one table for every link mailed to a member, keyed by a `purpose` enum —
`password_reset` today, verifying and changing an address later. The purpose is stored rather
than implied so a token issued for one thing cannot be spent on another.

Tokens are hashed with `util/token.ts` and carried the way a session cookie carries one:
`id.secret`, where the id finds the row by primary key and the secret is compared against
`hashed_token`. Do not make `hashed_token` unique and look up by it — `user_session` started
that way and moved off it.

A partial unique index allows one outstanding token per member per purpose: issuing a link
deletes the previous one, and the index makes that an invariant rather than a habit. Insert
with `onConflict` anyway — two requests arriving together each delete nothing the other has
inserted yet, and without it the loser violates the index and fails the request.

Spending a token is one transaction that marks it consumed, sets the password and deletes
every session of that member. The `UPDATE … WHERE consumed_at IS NULL` is what makes a link
single-use under concurrency: the second request waits on the row lock and then no longer
matches. Consumed rows stay until the hourly sweep, so a second click can be told the link is
used rather than unknown.

Answer a spent, expired or unknown token identically. Which of the three it was is only ever
useful to somebody guessing.

## Tests

Co-located as `<module>_test.ts` beside the code, one positive and one negative case per
route. They run against real Postgres and Redis, so start the compose stack and apply the
migrations first. Fixtures live in `src/test_support.ts`.

Prefer assertions that would fail for the right reason: check that a *different* user still
sees the group, not just that the status code is 200.

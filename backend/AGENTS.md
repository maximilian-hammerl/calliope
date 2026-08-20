# Backend

Deno, Hono and `@hono/zod-openapi` over Kysely and Postgres. Tasks are `deno task …` — see
the root [AGENTS.md](../AGENTS.md) for the conventions shared with the other projects.

- **Zod schemas are constants**, so `REGISTER_BODY`, not `RegisterBody`.
- **Imports use the `@/` alias**, which points at the project root:
  `@/src/service/user_service.ts`, not `../../../../service/user_service.ts`.
- **File names are `snake_case`**, and so are test files: `user_service.ts`,
  `user_service_test.ts`.

## Seed data

`deno task db:seed` fills a local database with a fixed fixture: five accounts sharing the
password `calliope`, a private and a public group, every membership state, threads with posts
and one unpublished draft, a chat with messages, and the notifications the invitations imply. A fifth account, `unverified`, has no confirmed
address and so reaches nothing but the verification wall — that screen is otherwise only
reachable by registering by hand and digging the link out of Mailpit.
It prints the accounts and the URLs when it finishes.

Three things about it are deliberate:

- **Hard-coded ids.** A URL you bookmarked still works after a re-seed. `uuidv7()` is only a
  column default, so explicit ids are fine; they are obviously synthetic
  (`01a00000-0000-7000-8000-…`) so a seeded row is recognisable in a query.
- **Real password hashing.** It calls `hashPassword`, because scrypt lives in the application
  and pgcrypto was removed on purpose. A hard-coded hash would rot the day its parameters
  changed and the accounts would silently stop being able to sign in.
- **It owns its five usernames.** Cleanup matches id *or* username, so an account somebody made
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
same reason), `service/`, `util/`, `middleware/`, `database/`, `redis/`, `test/` (fixtures
and helpers, never imported by anything that ships).

A few files stay at `src/`'s root deliberately: `app.ts` composes everything, `text_limit.ts`
is domain constants read across layers, and `open_api_specification.ts`, `cron.ts` and
`cors_options.ts` are app-wide configuration.

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
merely uses a route to get there. Setup those files share lives in `test/auth.ts`.

Auth tests cannot use `test/support.ts`'s `registerUser` and `request`: registering and sending
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

## An email address has one schema

`EMAIL_ADDRESS_SCHEMA` in `http/request_schema.ts`, used by every route that takes one. The
`pattern` is the reason it is a constant: Zod's default is *stricter* than the browser's, so
forgetting it produces a route that refuses addresses the form accepted, with no explanation
the member can act on. Nothing would catch that but a member complaining.

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
  Redis, and `test/mailpit.ts` fetches from it. A reset token is stored hashed,
  so the message is the only place its plaintext exists — testing the flow at all means
  going through the mail, which covers the link's shape for free. Await
  `Mailer.flushPendingSends()` first, or the assertion races the send.
- **Text, not HTML.** These messages are a few lines and a link. A second HTML copy of the
  same words is one more thing to keep in step, and the clients that prefer it are the ones
  most likely to rewrite the link.

## Verifying an address

Registering leaves `user.email_verified_at` null and starts a session anyway. That session is
the point: without one there is no way back in to correct a mistyped address, and a single
slip at registration would orphan the account for good.

**Gating is the default, not an opt-in.** `require_session.ts` refuses an unverified member
with **403** — the session is fine, so 401 would send them back to the sign-in page they came
from. Five routes use `require_session_allowing_unverified_email_address.ts` instead: the four
somebody needs *in order to* verify — reading who they are, signing out, resending, correcting
the address — and asking for deletion, which is how somebody leaves without ever verifying.
Choosing nothing gets the strict one, so a forgotten route fails closed, and
`require_session_test.ts` pins the set so widening it cannot happen quietly. Both share `session_user.ts`, so how a session is read cannot drift
between them.

Every gated route therefore declares 403. Where the route has no reason of its own it spreads
`FORBIDDEN_RESPONSE`; the twenty-four that refuse for their own reasons keep their own, more
specific description.

**Changing a verified address is a different endpoint, deliberately.**
`changeUnverifiedEmailAddress` exists to fix a typo before anything has been proven, and it
must never touch an address that has. Three things enforce that and the last is the real
guarantee: the route checks, the service checks, and the `UPDATE` itself carries
`email_verified_at IS NULL`. A test proves the database guard alone still refuses with the
service check removed. Moving a *proven* address is `email_address_change_service.ts` — see below.

Correcting the address also deletes the outstanding token, or whoever received the mistyped
mail could still confirm somebody else's account.

## Moving a verified address

Three routes under `/auth/email-address`, and one URL that behaved two ways would be exactly
the confusion this feature cannot afford, so correcting an unproven address stays separate.

- **The current password is required.** A stolen session is the likely way in, and without the
  password it gets no further. That is the whole reason this is not the unverified endpoint.
- **Nothing moves on request.** The requested address waits on the token, so an expired or
  cancelled request leaves no trace. Only opening the link sent to the new address applies it,
  and confirming re-checks that nobody registered that address in the meantime.
- **The old address is told, and can stop it.** Both mails carry the *same* token: cancelling
  only ever restores what is already true, so sharing it costs nothing and saves a second kind
  of token. This is the mail that matters if the password has leaked.
- **Confirming ends every session**, including the one that asked.

There is no undo once confirmed — the window is the hour before. A real one needs a
longer-lived token and a policy for what reverting means, and is not built.

`requestEmailAddressChange` answers **401** for a wrong password, which is an *answer*, not a lost
session. The frontend's `EXPECTED_401_MUTATIONS` has to list it or the global handler signs the
member out mid-form; it did, once.

## Changing a password while signed in

`PATCH /auth/password`, the counterpart to resetting one while locked out, and it asks for the
current password for the same reason the address change does.

Two things differ from a reset. **This session survives** — signing somebody out of the tab
they are working in punishes good hygiene — while every other session goes. And **any
outstanding reset link is deleted**: a link requested earlier would otherwise still set a
password of somebody else's choosing, which is exactly what changing it was meant to stop.

The route reads the session id from the cookie rather than taking it from `c.get("user")`,
because the cookie is the only thing that says *which* session is asking.

## Deleting an account

Two routes under `/auth/account`, the same shape as moving an address: the password
re-authenticates, and a mailed link is what actually does it. Neither a stolen session nor a
leaked password is enough alone.

- **No verified address is required**, unlike changing one, so the request route is the fifth
  member of the permissive set. Somebody who mistyped their address at registration must still
  be able to leave; behind the strict middleware this answered 403, which left them able
  neither to verify nor to go. A link that reaches the wrong inbox can only delete the account
  registered to it.
- **One statement does nearly all of the work.** The foreign keys cascade sessions, tokens,
  memberships and notifications; `created_by` goes null wherever text survives; and the
  triggers on the membership tables drop a group left with nobody in it. The service says
  nothing about groups, which is why `deleteMembership`'s rule lives in a trigger.
- **The name and address are read before the delete**, because the final mail has nowhere to go
  afterwards.
- **The confirmation page asks rather than acting on mount.** The address-change page confirms
  as soon as it loads; this one cannot, or a mail client that prefetches links would delete the
  account before anybody read the page.
- **A member who is a group's only administrator leaves it ungoverned.** That is the same hole
  leaving already opens, deliberately not fixed here — see the roadmap.

`requestAccountDeletion` answers **401** for a wrong password, so the frontend's
`EXPECTED_401_MUTATIONS` lists it, as it must for every re-authenticating mutation.

## Paths in mailed links must exist in the frontend

The address-change mails pointed at `/confirm-email-change` for a day while the router only had
`/confirm-email-address-change`, so every link opened a blank page — nothing errored, the
feature simply did not work. Both sides now pin the paths: `request_change_test.ts` and
`request_deletion_test.ts` assert on the mailed text, and the frontend's
`router/__tests__/mailedPaths.spec.ts` asserts each one resolves to a route that opens without
a session.

## A group is a story, for now

`writing_group` carries the story's metadata — `subtitle`, `blurb`, `story_status`, `genres`,
`subgenres`, `tropes`, `content_warnings`, `tense`, `perspective`. §5.1 has a group *containing*
optional stories and §43 puts that split in phase 2; until then the group is the story, and
moving the columns later is a migration rather than a redesign.

Three things about it:

- **`story_status`, not `status`.** The reader's own membership status is already called that
  wherever a group is read. It is the only non-null field of the set, defaulting to `planning`:
  every story is somewhere in its life. §7.4's fourth value, `archived`, is left out until §22's
  group archive exists to distinguish it from `finished`.
- **The tag arrays are optional in the request, never defaulted.** `STORY_TAGS_SCHEMA` is
  `.optional()`, not `.default([])`. A default materialises the field when the client omitted
  it, so on a PATCH every partial update silently cleared the tags — a test caught exactly that.
  Absent means unchanged; the column's own `DEFAULT '{}'` covers a create.
- **Normalisation lives in the service**, in `toRow`, so a caller cannot skip it: entries are
  trimmed, blanks dropped, and repeats removed case-insensitively with the first spelling
  kept. Doing it in the schema would put a transform in `open-api.json` that the client cannot
  see.

## Tokens in links

`user_token` is one table for every link mailed to a member, keyed by a `purpose` enum —
`password_reset`, `email_address_verification`, `email_address_change` and `account_deletion`.
Every value is declared in the migration that creates the type, not added later: a value added
to an enum cannot be *used* until its transaction commits, so the CHECK that pairs a purpose
with its columns would need a migration of its own each time. That CHECK ends in `ELSE false`,
so a purpose without a branch is rejected rather than defaulted.
`user_token_service.ts` owns the mechanics both flows share, including the one lifetime and
the one resend cooldown; the flows themselves only decide what a spent token authorises.
Consuming takes the caller's transaction, so the token and what it unlocks commit together. The purpose is stored rather
than implied so a token issued for one thing cannot be spent on another.

Tokens are hashed with `util/token.ts`, which also owns the transport format: `formatToken`
and `parseToken` produce and read `id.secret`, where the id finds the row by primary key and
the secret is compared against `hashed_token`. Session cookies use the same pair. Do not make
`hashed_token` unique and look up by it — `user_session` started that way and moved off it.

**Always parse, never destructure a `split`.** The id half reaches a `uuid` column, where a
malformed value is a database error rather than a miss: the session cookie went straight from
`split(".")` into a query and answered **500** on every request carrying a corrupted cookie,
instead of treating it as not signed in. `parseToken` returns `undefined` unless both halves
are present and the id is a v7 uuid. A dot is safe as the separator because neither half can
contain one, and because it is the only candidate a URL leaves unescaped — `$` arrives as
`%24`, which a reset link mailed as plain text should not have to survive.

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
migrations first.

**Everything test-only lives in `src/test/`** — `support.ts` for the shared fixtures,
`auth.ts`, `mailpit.ts`, `email_address_change.ts`, `account_deletion.ts` for what a group of
tests shares. A file ending in
`_test.ts` announces itself; these do not, so the directory says it instead of the name and
they cannot be mistaken for production code. `database/test/support.ts` does the same.

Prefer assertions that would fail for the right reason: check that a *different* user still
sees the group, not just that the status code is 200.

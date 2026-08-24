# Backend

Deno, Hono and `@hono/zod-openapi` over Kysely and Postgres. Tasks are `deno task …` — see
the root [AGENTS.md](../AGENTS.md) for the conventions shared with the other projects.

- **Zod schemas are constants**, so `REGISTER_BODY`, not `RegisterBody`.
- **Imports use the `@/` alias**, which points at the project root:
  `@/src/service/user_service.ts`, not `../../../../service/user_service.ts`.
- **File names are `snake_case`**, and so are test files: `user_service.ts`,
  `user_service_test.ts`.

## Seed data

`deno task db:seed` fills a local database with a fixed fixture: nine accounts sharing the
password `calliope`, seventeen writing groups, twenty-three story ideas and three chats. Between them
the groups cover both visibilities, every membership size from one to five, every role,
two-administrator groups in each visibility, and one group with nothing in it at all. There
are threads with posts, two unpublished drafts, next steps both open and completed, a post
whose author is null so "Gelöschtes Konto" is visible without deleting an account, and the
notifications the invitations imply. `unverified` has no confirmed address and so reaches
nothing but the verification wall — that screen is otherwise only reachable by registering by
hand and digging the link out of Mailpit. It prints a compact account table and a few entry
URLs when it finishes.

**Thirteen of the groups are public**, nine of them small ones founded by `silbenmeer`, so
"Gruppen entdecken" always has more than one page. Thirteen rather than eleven because discovery
hides the groups you are in: the busiest accounts belong to two public groups, and eleven would
have left them nine — one page. `silbenmeer` is the exception by construction, seeing four.

**`tintenfleck` is the account both story-idea views page for**: eleven ideas of their own and
twelve others' still open, so "Meine Storyideen" and "Storyideen entdecken" each hold two pages
at ten to a page. Both numbers had to be built rather than assumed, because discovery lists only
`open` ideas and hides your own — one of `tintenfleck`'s eleven is closed, which is also what
shows that the own-ideas view ignores status.

**Story-idea timestamps are stamped from fixture position**, five hours apart and ascending with
the ids, so ordering by either agrees — the carousel walks by id and the board sorts by
`created_at`. They were all one `now()` until the carousel needed an order: twenty-three ties have
no defined sort, which is the same trap the posts fell into. Note that the fixture's ids decode to
a moment slightly in the past, so an idea created by hand sorts *above* every seeded one and can
be newest to the carousel while the board still puts a seeded idea first. Nothing in production
diverges that way, since both the id and the timestamp come from the insert.

**Pride and Punctuation holds ten threads**, titles of uneven length, so the tab strip's
horizontal scrolling is always testable — it scrolls with its scrollbar hidden, which only shows
with more tabs than fit.

One thread, "Der lange Aufstieg" in the public Zauberzwerg, holds **105 generated posts** so
numbered pages, the order toggle and a truthful post count are always testable; the section
number is in each text, which makes a wrong or repeated page visible instead of countable. Post
timestamps are **stamped from fixture position**, five minutes apart, because one insert
statement shares a single `now()` — a column full of ties has no defined sort order, and paging
over it repeats rows across pages.

**Favourites are seeded across all five kinds** (`seed/favourites.ts`), because every filter in
the interface is otherwise an empty list on a fresh checkout and the flag is never true anywhere.
Three posts spread through the 105-post thread are the ones that earn the fixture: coming back to
marked passages across six pages is what the post filter is *for*, and `write.ts` asserts every
favourite names an id the fixture actually holds — an FK violation reports the constraint and a
uuid, not which entry is wrong.

**It cannot demonstrate the ordering on three of the five.** Groups, threads and chats sort by
`last_activity_at`, which the seed does not spread and *cannot*: the column is the database's, a
`BEFORE UPDATE` trigger overwrites any value a fixture writes, and the cascade from inserting posts
stamps every row with the seeding moment. All 19 threads and all 3 chats therefore share one
timestamp and the 17 groups share two, so „Gruppen entdecken" pages 13 public groups over a tie of
9 — a boundary with no defined order, which is the same trap the post and story-idea timestamps
were staggered to avoid. Those two are staggered, and they are where a favourite visibly moves
something. Fixing the rest means disabling a trigger for the seed; the deeper fix is a unique
tiebreak in `listResultsWithCount`, which has none.

**The fixtures live in `seed/`, one file per kind**, with `seed.ts` keeping the guard, the
cleanup and the order: `accounts.ts`, `writing_groups.ts`, `story_ideas.ts`, `chats.ts`,
`ids.ts` and `write.ts`. A group's members, threads, posts and steps are nested in its own
block rather than spread across parallel inserts, so adding one is a single block; `write.ts`
turns the fixtures into inserts in dependency order.

Usernames are handles (`tintenfleck`, `zeilensprung`, …) rather than first names, because
members of a writing community pick a pen name far more often than they sign with their own.
Group titles are real books knocked slightly off course — "Die unendliche Gliederung",
"Pride and Punctuation" — so nobody mistakes a fixture for production data.

Three things about it are deliberate:

- **Hard-coded ids.** A URL you bookmarked still works after a re-seed. `uuidv7()` is only a
  column default, so explicit ids are fine; they are obviously synthetic
  (`01a00000-0000-7000-8000-…`) so a seeded row is recognisable in a query. One letter per
  kind and **never a leading zero**: `padStart` reads `"0a1"` and `"a1"` as the same id, which
  is how a user once shared one with a notification. `write.ts` asserts every id is distinct,
  and that each group's founder is a joined administrator of it — both checked by breaking
  them on purpose.
- **Real password hashing.** It calls `hashPassword`, because scrypt lives in the application
  and pgcrypto was removed on purpose. A hard-coded hash would rot the day its parameters
  changed and the accounts would silently stop being able to sign in.
- **It owns its nine usernames.** Cleanup matches id *or* username, so an account somebody made
  by hand as `mira` cannot block a re-run — and neither can renumbering the ids later.

It refuses to run unless **both** guards agree: `ENVIRONMENT` is `development` or `testing`, and
the `DATABASE_URL` host is obviously local. Only the second takes `--force`, which is how the
deployed testing instance is seeded against a host called `db`; no flag gets past the first,
because these accounts share one password and an environment that keeps what people write must
never be given them. It refreshes only its own fixture, so half-built state you are testing
survives.

Inserted through Kysely rather than the services, since those generate their own ids. Database
triggers still apply — `invited_at`, `joined_at`, `last_activity_at`. What it restates rather
than invokes is service-level behaviour: the notification an invitation produces, now derived
from the fixtures rather than listed, and `invited_by` on a pending membership. If either rule
changes, `write.ts` changes with it.

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

**An array of middleware needs `as const`.** Without it the array widens to
`MiddlewareHandler[]`, the route loses the middleware's environment, and `c.get("user")` becomes
`never` — a symptom that gives no hint of the cause
([honojs/middleware#847](https://github.com/honojs/middleware/issues/847)). This file used to say
arrays did not work at all, which was that bug read as a rule.

```ts
middleware: authenticated,                                    // one is written bare
middleware: [authenticated, authorizedAsModerator] as const,  // two or more, always as const
```

**Authentication first, then authorization.** `authenticated` establishes *who* is asking;
`authorizedAs…` says what they may do, reads the role off the user the first one set, and answers
401 if it is missing rather than throwing. The names say which of the two a middleware is, which
is the whole reason they are not all called `require…`.

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

## The carousel walks by id, not by offset

`QUERY /story-ideas/carousel` answers with one idea and the two either side of it, whole rather
than as ids, plus how many the set holds. It takes no filters: the set is the view's own — open
ideas the member has not read and did not write, no blocked authors — so there is nothing to pass.

- **Neighbours are found by id.** Ids are uuidv7, so comparing them is creation order, they are
  unique so no tiebreak is needed, and it is the primary key so each neighbour is one index scan.
  An offset would have been wrong the moment anybody posted an idea: every position behind the new
  row shifts, and a link would open beside the idea it named rather than failing.
- **One filter chain, shared.** `filtered()` in `story_idea_service.ts` is what both
  `listStoryIdeas` and the carousel build on. A neighbour the carousel offers but the board would
  hide is an idea nobody can reach twice, so the two cannot be allowed to drift apart.
- **The anchor ignores read state, and only that.** Marking the idea on screen as read must not
  invalidate the URL the member is sitting on. Everything else still holds, so their own idea, a
  closed one, or one whose author they have blocked answers 404.
- **An empty set is not an error.** Nulls and a total of zero, which is a member who has read
  everything.

`total` counts the set, not the member's position in it. The position would mean counting every
preceding row on each step, and for a list of unread things what is left is the more useful number.

## Two lists are deliberately not list endpoints

`GET /groups/{groupId}/threads` returns **every thread, most recently written in first**, for
the same class of reason: the interface shows them as one tab strip, which is the only way
between threads, so a thread missing from it is a thread nobody can reach — and the open one has
to be among them or its own tab disappears. Unlike members, threads do accumulate; when a strip
gets unwieldy the answer is a list of its own rather than a page of tabs.

`GET /groups/{groupId}/memberships` returns **everyone in the group in one answer** — no limit,
no offset, no sort, no search, and therefore no body, which is why it is a GET while every other
collection here is a QUERY. Somebody missing from the list of who is in a group is a worse
failure than a long list, and the interface groups joined above invited and sorts by name, which
it can only get right holding all of them. Groups are a handful of people; if that ever stops
being true this is the endpoint to revisit, and the shape (`{ results }`) leaves room to add
paging back without moving anything else.

## List endpoints

Use `listQuerySchema()` and `listResponseSchema()` from `list_endpoint.ts`, and
`listResultsWithCount()` from `list_endpoint_query.ts`. They page and count from a single
query builder, so the page and its total can never disagree.

List endpoints use the **HTTP QUERY method** (RFC 10008), so parameters arrive as a typed
JSON body. Mark the body `required: true`: with `required: false` an absent body skips
validation entirely and the schema's defaults never apply.

`sortAttribute` must be an enum derived from the table's own columns, because its value
reaches `dynamic.ref`. An unchecked value there is an injection.

Where an endpoint sorts by a *joined* table's column — `QUERY /groups` takes `invitedAt`, which
belongs to `user_in_writing_group` and not to the group — the `.keyof().extract()` form cannot
express it. `list_groups.ts` uses a literal map instead, with
`satisfies Record<Attribute, "table.column">` carrying the same guarantee: an attribute
without a mapping, or a column that has been renamed, fails to compile. Such a column is null on
rows outside that membership, which is why `listResultsWithCount` orders nulls last.

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

## An idea is written twice

`story_idea` carries a `teaser` and a `synopsis`, both `NOT NULL`, and they are the only pair of
mandatory prose fields anywhere here — everything else about an idea is optional on purpose. A
board shows the teaser, the idea's own page shows both, and the synopsis becomes the group's under
the same name, which is why `writing_group.blurb` was renamed to `synopsis`: one text, one word,
no mapping to remember.

`search` matches either, so a term in the long version still finds the idea whose teaser does not
mention it.

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

**Reading and writing are guarded differently.** A read of a group's contents asks
`selectVisibleWritingGroup` — which is what makes a public group public: §23's community-visible
state is a promise about the writing, and the discovery page says so ("Mitlesen kannst du
sofort"). Writing asks `selectRoleForUser`. Threads, one thread and its posts checked membership
instead until they were corrected; steps and memberships had always used visibility, so a
non-member could read a public group's member list but not a word of its story. Drafts do not
depend on either check — `readableBy` keeps them with their author whoever is asking.

## After changing a route

Regenerate the specification, or CI fails:

```bash
deno task open-api:generate
```

`open-api.json` is committed, and the frontend's client is generated from it, so regenerate
that too when the shape changes. `HOST_URL` ends up in the `servers` entry, so generate with
the same value CI uses — which is why CI copies `.example.env`.

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

**Gating is the default, not an opt-in.** `authenticated.ts` refuses an unverified member
with **403** — the session is fine, so 401 would send them back to the sign-in page they came
from. Five routes use `authenticated_allowing_unverified_email_address.ts` instead: the four
somebody needs *in order to* verify — reading who they are, signing out, resending, correcting
the address — and asking for deletion, which is how somebody leaves without ever verifying.
Choosing nothing gets the strict one, so a forgotten route fails closed. Both share
`session_user.ts`, so how a session is read cannot drift between them.

That property is also why the session check and the verification check are **one** middleware
rather than two composable ones. Authorization composes on top of `authenticated`; authentication
does not decompose below it — a route that listed only the session half would fail *open*, and
there are sixty routes in which to make that mistake.

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
session. Answer it with `INVALID_CREDENTIALS_BODY` — see below.

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

`requestAccountDeletion` answers **401** for a wrong password, with `INVALID_CREDENTIALS_BODY`
like every other re-authenticating route.

## A 401 says which kind it is

A 401 means two different things and the client has to tell them apart: the session has ended, or
the password just sent was wrong. Every wrong-password answer therefore uses
`INVALID_CREDENTIALS_BODY` from `http/response.ts`, which carries `code: "invalid_credentials"`;
a missing or expired session answers without a code.

The frontend signs a member out on any 401 it cannot account for, so a route that answers one
*without* the code closes whatever dialog they were in and loses what they typed — on the home
page that looks like nothing happening at all, which is why it hid for so long. Verified by
dropping the code from `changePassword` on purpose: the member was thrown from `/members` to `/`
mid-form.

It is a **constant rather than a helper** deliberately. A helper returning `c.json(...)` widens
the handler's return type to plain `Response`, which switches off the body and status checks for
the whole route — the same trap as a content-less response.

The four routes that answer it (`login`, `password`, `email_address/request_change`,
`account/request_deletion`) each assert the code in their wrong-password test. Nothing in the
type system requires it, since the field is optional; those tests are the guarantee.

## A session says where it came from

`user_session` carries a `user_agent` and an `ip_address`, written from the request that created
it, so a member can tell their own sessions apart from somebody else's in the settings dialog.
Four things about it:

- **The user agent is stored raw and parsed on read.** `util/user_agent_parts.ts` runs over
  `@std/http`'s parser in `list_sessions.ts` and the response carries `browser`,
  `operatingSystem`, `deviceType` and `vendor` — parts, never a sentence. "Safari auf iOS" and
  "Safari on iOS" are one fact in two languages, and a label written into the column could only
  ever be in one of them; §53 is the general form of that rule. Every part is null for a client
  the parser cannot read, which is a session somebody must still be able to see and end.
- **`device.model` is deliberately not carried.** Measured over twenty-six agents it is a
  placeholder (`K` on current Chrome for Android), a restatement (`iPhone`, `Macintosh`) or a
  part number (`SM-S918B`). `vendor` is the opposite — always a real brand or absent — which is
  why it is the part a member actually recognises.
- **One address resolver, `util/client_address.ts`.** The rate limiter buckets by it and a
  session records it. A second implementation that appended to `X-Forwarded-For` rather than
  reading the first entry would let a client choose its own rate-limit bucket.
- **Last use is derived, never stored.** Every request within the refresh interval pushes
  `expires_at` to now plus `SESSION_LIFETIME`, so subtracting the lifetime gives last use to
  within that interval. Nothing had to be added for it.
- **Neither column needs a retention rule**: both die with the session, 24 hours after its last
  use. That is also the answer to §18 for them — they are collected for one purpose and expire
  on their own.

Listing sessions filters `expires_at` itself. Expiry is checked in application code when a
session is read and the rows linger until the hourly sweep, so a list that trusted the table
would report sessions that are already dead.

Ending other sessions asks for **no password**, unlike the three routes that re-authenticate:
it is the defensive act, and a password blocks the case it exists for. It also spares the
session asking — signing somebody out of the tab they are working in punishes good hygiene.

## Blocking

`user_block` is one row per (blocker, blocked) pair, and it means **contact**, not visibility of
everything. Four routes ask `BlockService.isBlockedBetween` before letting one member reach
another: both invitation routes and both `/conversations` routes. Five things about it:

- **Symmetric.** A row in either direction refuses contact. An asymmetric block would leave the
  blocked member able to invite the blocker, which is the one thing blocking is for.
- **Neutral 403.** "Contact is not possible" never says who blocked whom. Which direction it was
  is only ever useful to somebody working out whether they were blocked.
- **Pending invitations go with the block**, in both directions and for groups and chats alike:
  an unanswered invitation is an outstanding contact attempt. Joined memberships are untouched —
  shared writing is joint work, and leaving is the member's own act. That residual is deliberate.
- **Several invitees are filtered, not refused.** `withoutBlocked` is why one administrator's
  block cannot make a whole group unreachable; only an empty result refuses, reusing the 409
  that already means "nobody to ask".
- **Lists filter on read**, never on write: `listUsers`, `listStoryIdeas`, `listNotifications`
  and `/search` take the hidden ids, so unblocking restores what was hidden. A notification with
  no actor stays readable — that is a deleted account, not a blocked one.

The fixture carries two blocks (`seed/blocks.ts`), and `write.ts` asserts no blocked pair also
has a pending invitation between them — that pair of states is one the application cannot
produce, and the assertion was checked by introducing it on purpose.

`GET /users/{userId}` carries `isBlocked`, which is only ever *the reader's own* block. Whether
somebody blocked the reader is exactly the disclosure the neutral 403 avoids.

## Favourites

One mark over five kinds — group, thread, post, story idea, chat — private to the member who set
it. `PUT`/`DELETE /favourites/{targetType}/{targetId}` is the whole API: one pair of routes rather
than five, the same argument that makes `ReportDialog` one component for seven kinds.

- **`favourite` carries no `target_type` column**, unlike `report`. Its references all cascade, so
  exactly one is set for the row's whole life and the kind is readable off the data;
  `notification` is the same shape for the same reason. `report` needs the enum precisely because
  its references are `ON DELETE SET NULL`, which leaves a row naming nothing. The kind survives as
  *request* vocabulary only — `FAVOURITE_COLUMN` in `service/favourite_target.ts` maps it to the
  column to write, and `satisfies` makes a new kind a compile error naming it.
- **`favourite_target.ts` is a leaf module on purpose.** The five services that join `favourite`
  need its constants, and `favourite_service` reaches `visible_target`, which reaches back into
  those services. Importing the constants from `favourite_service` closed that circle, and
  TypeScript answers a circular import with `any` — which surfaced as a join column silently typed
  as anything at all rather than as an error. Nothing about it looked wrong.
- **Setting one is visibility-checked, clearing one is not.** `resolveVisibleTarget` is shared with
  reporting, so the rules cannot drift. Clearing skips the check deliberately: a member who has
  lost access to something they favourited must still be able to remove the mark, and refusing
  would strand a row they can see in their own filter.
- **Favouriting your own thing is allowed.** Marking what you are working on is the ordinary case.
- **Ordering is one term, `ListOrdering.firstDescending`**, passed by the endpoint and never by a
  request — which is what keeps it out of `dynamic.ref`'s injection surface. It names the output
  alias `isFavourite` rather than a column, because the flag is an expression and Postgres resolves
  an alias in `ORDER BY`. Posts are the one kind that does **not** pass it: a thread is read in the
  order it was written, and hoisting a marked passage would put the end of a chapter above its
  beginning. The thread strip writes its own term instead, since it is not a list endpoint.

**One rule, two projections.** Favourites are why this pattern is written down: joining `favourite`
into the group's visibility check would have put it on all seventeen callers, sixteen of which only
ask yes or no. So `selectVisibleWritingGroup` is a lean gate and `selectWritingGroupForReader` is
the full read, both built on the same base query builder. `selectStoryIdeaGate` and the chat's
`ChatGroupGate` exist for the same reason, and the two chats ones mattered most: `selectChatGroup`
ran a correlated `COUNT` over `chatMessage` on every message sent and every page read, to answer a
question nobody was asking. Narrowing a selector produces a compile error at each caller that
needed the wide one, so the boundary is found rather than guessed.

## The report lifecycle

A report is `open`, `in_progress` or `closed`, and `PATCH /reports/{reportId}` is the one route that
moves it. There are two moves — taking one and closing it — and **no reopening**: a closing is
final. The body is a discriminated union on the destination, so the document itself says that a
closing carries an outcome and a note and that taking one does not; it reaches the generated client
as a `oneOf`, where building a closing without an outcome is a type error. A `refine` would enforce
the same rule invisibly, since it survives into neither the document nor the client.

`resolved` and `dismissed` used to be two closings. They are one now, and `report_outcome` says
which kind it was far more precisely — `content_removed`, `no_violation`, `duplicate` and six
others. A closing carries an outcome *and* a note, for the reason a member's report carries a
category and a reason: the enum is what the queue filters on, the prose is what the next operator
reads.

**There is no table beside the report, because the lifecycle only goes forward.** An earlier version
of this had one, on the argument that a mutable status cannot be audited — true, but only while
reopening exists to send a status backwards over a closing. Without it every move is written once
and nothing is ever overwritten, so the row *is* the record §16 asks for: who has it, when they took
it, when they closed it, with what outcome and note.

- **`status` is a generated column** over `in_progress_at` and `closed_at`, so it cannot disagree
  with them, and `kysely-codegen` types it `Generated<ReportStatus>` so nothing can try to write it.
  The timestamps are the truth; the column exists because the queue filters and indexes on one
  three-valued token, and spelled out by hand that filter is three predicates where forgetting
  `closed_at IS NULL` in the middle one silently includes every closed report that was ever taken.
- **A CHECK on this table cannot reference it.** `report_closed_has_an_outcome` is written against
  `closed_at`, not against `status`, for that reason — and so is the unique index's predicate, since
  a partial index cannot carry a generated column either.
- **There is no `opened_at`.** `created_at` already is it: a report is open from the moment it
  exists, and a report with neither timestamp set is one nobody has touched.
- **Taking a report somebody already holds is allowed** and hands it over. The state means "somebody
  has this, move on", not a lock — a claim nobody could take over would strand a report the day its
  holder stopped reading the queue. The cost, accepted: only the last holder is recorded.
- **Only the holder may close it**, which is what stops two operators judging one case; the loser
  gets a 409. `operator_id` is `ON DELETE SET NULL`, so a report whose holder deleted their account
  is held by nobody and anybody may close it — that is the whole of the escape hatch, and it falls
  out of the reference rather than being written.
- **Closing sets `operator_id` either way**, so closing one straight from the queue still records
  who did it while leaving `in_progress_at` null — honest, because nobody took it.

**The category is part of the one-report-per-member index key**, which is the line between
correcting a report and making a second claim. Without it a member who reported a post as harassment
and then noticed it was also plagiarism had the first claim silently overwritten. Two consequences,
and the second has bitten three times: the predicate is `closed_at IS NULL` rather than a status, or
taking a report would drop it out of the index and let the same member file it again; and
`insertReport`'s `ON CONFLICT` clause has to restate that predicate *the same way*, because any
disagreement makes Postgres answer "no unique or exclusion constraint matching the ON CONFLICT
specification" for every report anybody files.

## Paths in mailed links must exist in the frontend

The address-change mails pointed at `/confirm-email-change` for a day while the router only had
`/confirm-email-address-change`, so every link opened a blank page — nothing errored, the
feature simply did not work. Both sides now pin the paths: `request_change_test.ts` and
`request_deletion_test.ts` assert on the mailed text, and the frontend's
`router/__tests__/mailedPaths.spec.ts` asserts each one resolves to a route that opens without
a session.

## A group is a story, for now

`writing_group` carries the story's metadata — `subtitle`, `synopsis`, `story_status`, `genres`,
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

**`deno task test` runs `--parallel`**, which is five times faster (50s to 10s) and keeps the
suite honest: every file must own its identities, because a file that shares a username, an
address or a mailbox with another now fails immediately instead of waiting to collide with a
second test process one day.

So a fixture shared by more than one file is a **factory taking a scope**, not module-level
constants: `authFixture("login")`, `emailChangeFixture("confirm")`, `storyIdeaFixture`'s
`storyIdeaUsers("list")`, `accountDeletionFixture("request")`. Each derives its username and
address from the scope, so no two files can collide. Three rules follow:

- **Never empty shared state.** `deleteMailFor([address])`, not `deleteAllMail()`;
  `countMailFor([address])`, not `countMail()`. Emptying the mailbox deletes a message another
  file is waiting for, and counting it measures everyone's mail.
- **Never assert a global count.** `titles.includes(…)`, or a baseline delta as `search_test.ts`
  does — never "the board holds exactly one". Any other row, seeded or from a neighbouring
  test, makes that wrong.
- **Scope every query in a fixture to its own account.** `pendingAddress()` read whichever
  token came first until it joined `user` and filtered by username.

`clearRateLimits()` spares the block in `RATE_LIMIT_TEST_CLIENTS` (`198.51.100.`), because the
middleware's own test fills a window request by request and a `beforeEach` elsewhere used to
empty it mid-loop — which read as the limiter simply not working.

**Everything test-only lives in `src/test/`** — `support.ts` for the shared fixtures,
`auth.ts`, `mailpit.ts`, `email_address_change.ts`, `account_deletion.ts` for what a group of
tests shares. A file ending in
`_test.ts` announces itself; these do not, so the directory says it instead of the name and
they cannot be mistaken for production code. `database/test/support.ts` does the same.

Prefer assertions that would fail for the right reason: check that a *different* user still
sees the group, not just that the status code is 200.

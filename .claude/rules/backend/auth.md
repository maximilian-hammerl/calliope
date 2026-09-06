---
paths:
  - "backend/src/route/auth/**"
  - "backend/src/service/user_service.ts"
  - "backend/src/service/user_token_service.ts"
  - "backend/src/service/password_*_service.ts"
  - "backend/src/service/email_address_*_service.ts"
  - "backend/src/service/account_deletion_service.ts"
  - "backend/src/service/session_cookie_service.ts"
  - "backend/src/service/breached_password_service.ts"
  - "backend/src/service/platform_authorization.ts"
  - "backend/src/middleware/authenticated*.ts"
  - "backend/src/middleware/authorized_as_platform_role.ts"
  - "backend/src/middleware/session_user.ts"
  - "backend/src/util/token.ts"
  - "backend/src/util/password.ts"
  - "backend/src/util/user_agent_parts.ts"
  - "backend/src/util/client_address.ts"
---

# Accounts, sessions and mailed links

## Passwords and tokens are hashed in the application

`util/password.ts` (scrypt) and `util/token.ts` (SHA-256); pgcrypto is gone, so the plaintext never
enters Postgres where statement logging could catch it. A stored password reads
`scrypt$cost$blockSize$parallelisation$salt$hash` — the parameters travel with it, so raising the
cost locks nobody out. `selectUser` hashes against a throwaway when no account matches, so an
unknown username costs the same as a wrong password. Session tokens and mailed-link tokens share one
implementation; keep them apart by *purpose* in the database, not by hashing them differently.

**Always `parseToken`, never destructure a `split`.** The id half reaches a `uuid` column, and a
malformed value there is a 500 rather than "not signed in" — which is what the session cookie did.
`formatToken`/`parseToken` produce and read `id.secret`; the id finds the row by primary key. Do not
make `hashed_token` unique and look up by it — `user_session` started that way and moved off it.

## Tokens in links

`user_token` is one table for every mailed link, keyed by `purpose`: `password_reset`,
`email_address_verification`, `email_address_change`, `account_deletion`. Every value is declared in
the migration that creates the type — a value added to an enum cannot be used until its transaction
commits, so the CHECK pairing a purpose with its columns would need its own migration each time. A
partial unique index allows one outstanding token per member per purpose; issuing deletes the
previous one, and the insert is `onConflict` anyway because two requests arriving together each
delete nothing. Spending a token is `UPDATE … WHERE consumed_at IS NULL` in the caller's transaction,
which is what makes a link single-use under concurrency. **Answer a spent, expired or unknown token
identically** — which one it was is only useful to somebody guessing.

## Verifying an address

Registering starts a session **before** the address is verified: without one there is no way back
in to fix a typo. `authenticated.ts` refuses an unverified member with **403** (the session is fine,
so 401 would send them back to sign-in). Five routes use
`authenticated_allowing_unverified_email_address.ts` — the four needed *in order to* verify, and
asking for deletion. Choosing nothing gets the strict one, so a forgotten route fails closed; the
session check and the verification check are **one** middleware for the same reason. Correcting an
unverified address (`changeUnverifiedEmailAddress`) must never touch a verified one: the route
checks, the service checks, and the UPDATE carries `email_verified_at IS NULL` — a test proves the
database guard alone still refuses. It also deletes the outstanding token.

## Moving a verified address, changing a password, deleting an account

All three re-authenticate with the current password — a stolen session gets no further — and answer
a wrong one with **401 + `INVALID_CREDENTIALS_BODY`**, never a bare 401. Nothing moves on request:
the mailed link is what acts. Both address-change mails carry the *same* token, since cancelling
only restores what is already true. Confirming an address change ends every session; changing a
password ends every *other* session (signing somebody out of the tab they are in punishes hygiene)
and deletes any outstanding reset link. Deletion needs no verified address — somebody who mistyped
it must still be able to leave — and its confirmation page asks rather than acting on mount, or a
mail client that prefetches links would delete the account. Read the name and address *before* the
delete; the final mail has nowhere to go afterwards.

## Sessions

`user_session` stores a raw `user_agent` and an `ip_address`, parsed on read into `browser`,
`operatingSystem`, `deviceType` and `vendor` — parts, never a sentence, because a label can only be
in one language. `device.model` is deliberately not carried (a placeholder or a part number).
`util/client_address.ts` is the one address resolver, shared with the rate limiter; a second one
reading `X-Forwarded-For` differently would let a client pick its own bucket. Last use is derived
from `expires_at`, never stored. `selectUserForSession` pushes the expiry in its **own**
transaction — the touch is the session's business, not the request's. Ending other sessions asks
no password: it is the defensive act.

## Mailed paths must exist in the frontend

The address-change mails once pointed at a route the router did not have; every link opened a
blank page and nothing errored. `request_change_test.ts` and `request_deletion_test.ts` assert on
the mailed text, and the frontend's `mailedPaths.spec.ts` asserts each path resolves.

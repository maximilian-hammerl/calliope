---
paths:
  - "frontend/src/router/**"
  - "frontend/src/lib/auth/**"
  - "frontend/src/lib/format/sessionDevice.ts"
  - "frontend/src/components/settings/SessionsSection.vue"
---

# Sessions and routing

The cookie is `httpOnly`, so `GET /api/auth/me` is the only way to know whether this browser is
signed in. The guard resolves it through `lib/auth/session.ts`, cached via vue-query. After signing
in, out or up, call `forgetCurrentUser()` before navigating, or the guard acts on the stale answer.

**A route says who may open it with one `meta.access` value**, never a set of booleans: `member`
(the default, so a forgotten route locks rather than leaks), `guest`, `operator`, `anyone` (the
mailed-link landing pages, anything legal). The guard switches over it with `assertUnreachable`.
Verification is orthogonal: `access` asks whether there is a session, the unverified-address
redirect asks what state that session's account is in.

`SessionsSection` lists the member's own sessions, and **the API sends the parts of a user agent,
never a label**: `sessionDevice.ts` writes „Safari auf iOS · Apple Handy" from `browser`,
`operatingSystem`, `deviceType`, `vendor`, any of which may be null. The brand is there because
"iOS" identifies nothing to a member who knows Apple; a kind with no German word is left off.

`router/__tests__/mailedPaths.spec.ts` asserts every path the backend mails resolves to a route
that opens without a session — one once did not, and every link opened a blank page.

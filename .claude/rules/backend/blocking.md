---
paths:
  - "backend/src/route/blocks/**"
  - "backend/src/service/block_service.ts"
---

# Blocking

`user_block` is one row per (blocker, blocked) pair and means **contact**, not visibility of
everything. Four routes ask `BlockService.isBlockedBetween` before one member reaches another: both
invitation routes and both `/conversations` routes.

- **Symmetric.** A row in either direction refuses contact.
- **Neutral 403.** "Contact is not possible" never says who blocked whom.
- **Pending invitations go with the block**, both directions, groups and chats alike. Joined
  memberships are untouched — shared writing is joint work, and leaving is the member's own act.
- **Several invitees are filtered, not refused** (`withoutBlocked`); only an empty result refuses,
  reusing the 409 that already means "nobody to ask".
- **Lists filter on read**, never on write — `listUsers`, `listStoryIdeas`, `listNotifications`
  and `/search` take the hidden ids, so unblocking restores what was hidden. A notification with no
  actor stays readable; that is a deleted account, not a blocked one.

`GET /users/{userId}` carries `isBlocked`, which is only ever the *reader's own* block. Whether
somebody blocked the reader is the disclosure the neutral 403 avoids.

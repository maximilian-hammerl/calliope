---
paths:
  - "backend/seed/**"
  - "backend/seed.ts"
---

# The seed fixture

`deno task db:seed` writes a fixed fixture: nine accounts sharing the password `calliope`,
seventeen writing groups (thirteen public), twenty-three story ideas, three chats, two blocks, and a
forum. It refuses to run unless **both** guards agree — `PUBLIC_ENVIRONMENT` is `development` or
`testing`, and the `DATABASE_URL` host is local; only the second takes `--force`. It refreshes only
its own rows, so half-built state you are testing survives, and it runs in **one transaction**.

## Why the numbers are what they are

- **Thirteen public groups**, nine of them small ones founded by `silbenmeer`, so „Gruppen
  entdecken" always has more than one page — discovery hides the groups you are in, and eleven
  would have left the busiest accounts with one page.
- **`tintenfleck` pages both story-idea views**: eleven own ideas (one closed) and twelve others'
  open, so „Meine Storyideen" and „Storyideen entdecken" each hold two pages at ten a page.
- **Pride and Punctuation holds ten threads** of uneven title length, so the tab strip's hidden
  horizontal scrollbar is always testable.
- **„Der lange Aufstieg" holds 105 generated posts**, section number in each text, so numbered
  paging and the order toggle are testable and a repeated page is visible rather than countable.
- **Favourites cover all six kinds**, three of them posts spread through the long thread — coming
  back to marked passages across six pages is what the post filter is for.

## Timestamps

Post and story-idea timestamps are **stamped from fixture position** (five minutes and five hours
apart) because one insert shares a single `now()`, and a column full of ties has no defined sort —
paging over it repeats rows. Groups, threads and chats **cannot** be spread: `last_activity_at` is
the database's, a trigger overwrites whatever a fixture writes. So a favourite can be seen to move
a post or an idea, never a group.

## Ids

Hard-coded and obviously synthetic (`01a00000-0000-7000-8000-…`), one letter per kind in
`seed/ids.ts`, so a bookmarked URL survives a re-seed and a seeded row is recognisable in a query.
**Never a leading zero** — `padStart` reads `"0a1"` and `"a1"` as the same id. Group threads own
`threadId(1–10)` and `30–39`; the forum's start at 41. `write.ts` asserts every id is distinct, every
folder's parent is above it, every founder administers their group, every favourite names a row the
fixture holds (forum rows included), and no blocked pair has a pending invitation.

## What it restates

Rows are inserted through Kysely, not the services, so triggers still apply (`invited_at`,
`joined_at`, `last_activity_at`, the forum's `effective_member_permission`) while service-level
behaviour has to be restated: the notification an invitation produces, `invited_by` on a pending
membership. If either rule changes, `write.ts` changes with it. Passwords go through
`hashPassword`, because a hard-coded hash rots when the parameters change.

Usernames are pen names; group titles are real books knocked slightly off course, so nobody
mistakes a fixture for production data. Cleanup matches id *or* username, so a hand-made account
with a fixture name cannot block a re-run.

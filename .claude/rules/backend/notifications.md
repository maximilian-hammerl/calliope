---
paths:
  - "backend/src/route/notifications/**"
  - "backend/src/service/notification_service.ts"
---

# Who is told what

Producers write their notification inside the same transaction as the thing that happened, so an
event cannot exist unannounced. Four rules they all share:

- **Never the actor.** `actor_id IS DISTINCT FROM recipient_id` is a constraint, so a producer that
  forgets fails the whole request. An administrator changing their own role is where it bites.
- **Only a change that changes something.** A visibility notification is written when the value
  actually moves; a request sending the value it already has tells nobody. The producer reads the
  old row inside the same transaction.
- **Joined members only.** Group activity skips people who were invited and have not accepted.
- **Drafts tell nobody.** `new_writing_post` is written on publication — on insert if it goes
  straight out, on the update that clears `is_draft` otherwise. Editing a published post is silent.

A role change and a visibility change each keep **one notification per membership**, updated in
place by an upsert onto a partial unique index (`WHERE type = '…'`). The conflict target's `type` is
`sql.lit(…)`, not a bound value: a prepared statement's generic plan cannot match a parameter to the
index's literal, and the upsert then finds no constraint — see `reports.md`.

`occurredAt` and `readAt` come from the application clock like every other timestamp a write sets
(`backend/AGENTS.md`), so they can differ by milliseconds from the row's defaulted `created_at`.

`NOTIFICATION_RESPONSE` is a discriminated union mirroring the table's CHECK, so reading a thread
title off an invitation is a type error in the generated client rather than an empty string.

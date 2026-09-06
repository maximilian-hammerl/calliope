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

Timestamps come from the database clock (`sql\`now()\``), so rows written in one transaction agree
with each other and with column defaults.

`NOTIFICATION_RESPONSE` is a discriminated union mirroring the table's CHECK, so reading a thread
title off an invitation is a type error in the generated client rather than an empty string.

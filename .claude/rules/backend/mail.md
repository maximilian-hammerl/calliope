---
paths:
  - "backend/src/mail/**"
  - "backend/src/util/background.ts"
---

# Mail

`mail/` holds the transport and the messages; `service/` decides that something should be said.

- **Handlers never await a send.** `Mailer.sendInBackground` returns immediately: a send takes as
  long as the remote server likes (thirty seconds to open a connection, once, against the production
  relay), and awaiting it would make "no account has this address" answer measurably faster than a
  real send — an account oracle. A failure can only be logged; see `deployment/README.md`.
- **Tests read the message.** Mailpit is in the compose stack and `test/mailpit.ts` fetches from it.
  A reset token is stored hashed, so the mail is the only place its plaintext exists. Await
  `Mailer.flushPendingSends()` first, or the assertion races the send.
- **Text, not HTML.** A second copy of the same words is one more thing to keep in step.
- A background task that writes (`sendVerificationMail` → `issueToken`) runs after the response, so
  it opens **its own** transaction — the request's is already committed.

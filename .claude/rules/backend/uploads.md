---
paths:
  - "backend/src/storage/**"
  - "backend/src/image/**"
  - "backend/src/service/user_avatar_service.ts"
  - "backend/src/route/avatars/**"
  - "backend/src/route/users/me/set_avatar.ts"
  - "backend/src/route/users/me/delete_avatar.ts"
---

# Uploaded files and the pictures made from them (#94)

Bytes live on the filesystem, the reference lives in a column, and the two can disagree. Every rule
below follows from that: the ordering is chosen so the disagreement is always the harmless one — a
file nothing names, never a row naming a file that is gone.

## The store

`FILE_STORAGE_PATH` is required, a named volume in the deploy. Every file is named by a **uuidv7,
parsed before a path is built** — the column is `uuid` too, so this is the second lock and neither
is the only one. A write goes to `<id>.partial` and is **renamed into place**, because a crash
mid-write must not leave half a file under a name the database already points at.

## The picture

`toAvatar` answers `undefined` for anything that is not a picture we accept, and the route turns
that into a **422** — a decode failure and a refused format are the same answer to a caller, and
neither is a malformed request.

- **The format allowlist is checked *after* decoding**, so the accepted set is a statement rather
  than an accident of which loaders a build carries. `sharp.block()` refuses SVG as well; the
  allowlist is the rule, the block is the second lock.
- **`.rotate()` comes before the resize and is not optional.** A phone stores a photograph as-shot
  with an EXIF tag, and re-encoding drops the tag — without it the picture arrives turned.
- **Re-encoding is the sanitiser**, and stripping EXIF is why it also matters for privacy: a phone
  photograph carries where it was taken. One stored size, `AVATAR_SIZE`.

## Deleting, which is never inline

A row goes; the file stays for `sweepUnreferencedFiles` to collect. Deleting the bytes with the row
would make restoring last week's dump produce broken images. The grace period is **one day longer
than `RETENTION_DAYS` in `deployment/backup.sh`** so a restored dump cannot name a swept file —
raise that and this has to follow. `backup.sh` tars the volume *after* the dump, in that order, so
the files are a superset of what the rows reference.

## Serving

`get_avatar` asks `isInUse` before reading, so a withdrawn picture stops being served the moment its
row goes. `private, max-age=3600, immutable` is not about revalidation — a new id per upload makes a
*changed* picture a changed address — it bounds **how long a withdrawn one lingers in a cache that
already holds it**, which is what an operator removing an offensive avatar is waiting on.

## The upload's size limit is chosen in `app.ts`

`bodyLimit` runs before route middleware, so a larger limit declared on the upload route never
executes and the global one refuses first. The global limiter picks by path instead. A limit that
belongs to one route therefore lives in `app.ts`, which is the surprise worth knowing.

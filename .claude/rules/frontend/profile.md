---
paths:
  - "frontend/src/components/user/**"
  - "frontend/src/lib/format/avatar.ts"
---

# A member's picture

`UserAvatar` takes an optional `avatarUrl` and falls back to the initial. The fallback is a sibling
of `AvatarImage`, not a `v-else`, because reka also falls back on a *load failure*. Nothing builds
the path: the server sends it.

**The picture saves on its own, inside `ProfileDialog` but outside its form** — a multipart body
where the profile is a JSON patch, and joining them would let one failure discard the other's work.
**Saving or removing invalidates the current user as well as the profile**; the top bar reads its
picture from `/auth/me`.

The preview is the picture — round, `object-cover`, at profile size — which is an honest preview
because the server centre-crops. shadcn's `Attachment` is the wrong shape (presentational, no file
input); it would suit #31 and #95, which are lists of files. The declaration appears only once a
file is chosen and the credit line only when the picture is not the member's own — asking everybody
for a source is what turns a declaration into a field people type „meins" into (#29).

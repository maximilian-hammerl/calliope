---
paths:
  - "frontend/src/App.vue"
  - "frontend/src/components/layout/**"
  - "frontend/src/components/context/**"
  - "frontend/src/composables/useGroupContext.ts"
  - "frontend/src/views/**"
---

# The frame is mounted once

`App.vue` wraps the router view in `AppLayout`, and **no page renders its own**. When each view did,
every navigation rebuilt the bars — and with them `ChatsDialog`, which owns the `EventSource`, so
every navigation reopened the stream and refetched the chat list: 39 stream opens in twelve minutes
on the deployed instance.

`AppLayout` knows nothing but the bars and the body. Anything a group's pages share belongs to
**`GroupLayout`**, the parent route of `/groups/:groupId` — the group's query, the reader's
permissions, both rails and the sheet — read by children through `useGroupContext()`. `GroupLayout`
is **reused** when only `:groupId` changes, so nothing in it may read the parameter at mount:
`groupId` is a computed and every query takes it as one.

**Navigation is a bottom bar below `md`**, a flex row of `AppLayout` rather than a fixed overlay, so
nothing can cover the composer. **The right rail is a sheet below `lg`**, chosen on a media query
rather than a CSS breakpoint so the rail's contents mount once.

`<TopBar v-if="user">` cannot tell a failed session check from a signed-out one, which is why the
rate-limit and connection notices cover the whole screen.

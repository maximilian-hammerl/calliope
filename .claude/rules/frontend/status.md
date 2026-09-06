---
paths:
  - "frontend/src/lib/api/queryClient.ts"
  - "frontend/src/components/common/ConnectionLost.vue"
  - "frontend/src/components/common/RateLimited.vue"
  - "frontend/src/lib/format/rateLimit.ts"
  - "frontend/src/lib/format/failure.ts"
  - "frontend/src/composables/**"
---

# Statuses the whole interface reacts to, and errors that need a renderer

## `queryClient` holds the global statuses

502/504 and a rejected fetch set `backendReachable`; a **429** sets `rateLimitedUntil`; a 401
reaches the router through `setSessionLostHandler`. `App.vue` renders `ConnectionLost` or
`RateLimited` — while either holds *every* request fails, so a message beside one control would
leave the rest failing silently. Everything else stays local (400 field issues, 403 banned, 409).

The rate limit has two budgets, so the notice says two things: a spent write budget reads „Du kannst
weiterlesen, aber gerade nichts speichern" over a page that still works; a spent read budget takes
the screen. The wait comes from `Retry-After`, which counts down within the window. `RateLimited`
does **not** probe — retrying is what caused the state — where `ConnectionLost` does. Both size
themselves to cover the screen, because a limited member who reloads gets no bars at all. The wording
is in `lib/format/rateLimit.ts`; four sign-in views had their own sentence and two had drifted.

## An error a composable produces must have a renderer

Every `use*` that turns a failure into a German sentence is producing something for a member to
read. If no component reads it the failure is silent — `useFavourite` shipped that way, its error
destructured by none of five call sites. Two shapes: a component used in more than one layout
renders its own (`FavouriteToggle`); a form or section uses `Alert variant="destructive"` with
`role="alert"`, or a `text-destructive` paragraph with `role="alert"` in a compact row. The message
is written once in the composable.

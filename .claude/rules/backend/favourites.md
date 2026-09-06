---
paths:
  - "backend/src/route/favourites/**"
  - "backend/src/service/favourite_service.ts"
  - "backend/src/query/favourite.ts"
  - "backend/src/service/visible_target.ts"
---

# Favourites

One mark over six kinds, private to the member. `PUT`/`DELETE /favourites/{targetType}/{targetId}`
is the whole API — one pair of routes rather than six.

- **`favourite` has no `target_type` column.** Its references cascade, so the kind is readable off
  the data; `FAVOURITE_COLUMN` maps the request vocabulary to the column. (`report` is different:
  its references are `SET NULL`, so it keeps the type.)
- **`query/favourite.ts` imports nothing from `service/`.** Every service that joins `favourite`
  imports it, and `favourite_service` reaches them back through `visible_target`; an import the other
  way closes a cycle, which TypeScript answers with `any` on a join column rather than an error.
  Deno's lint has no cycle rule.
- **`withFavourite()` is the only place the join is written.** Its
  `.on("favourite.userId", "=", readerId)` scopes a favourite to the reader; spread over five
  services it was eight copies. The helper is generic over the builder, so its references are
  asserted inside — the price of writing it once.
- **Setting one is visibility-checked, clearing one is not.** A member who lost access to something
  must still be able to remove the mark. `resolveVisibleTarget` is shared with reporting.

---
paths:
  - "backend/src/list/**"
  - "backend/src/route/**/list_*.ts"
  - "backend/src/route/search.ts"
---

# List endpoints

`listQuerySchema()` and `listResponseSchema()` from `list/list_endpoint.ts`,
`listResultsWithCount()` from `list/list_endpoint_query.ts`. They page and count from one query
builder, so the page and its total cannot disagree.

- **HTTP QUERY** (RFC 10008): parameters arrive as a typed JSON body. Mark it `required: true` —
  with `required: false` an absent body skips validation and the schema's defaults never apply.
- **`sortAttribute` is an enum derived from the table's own columns**, because its value reaches
  `dynamic.ref`; an unchecked value there is an injection. Where a list sorts by a *joined* column
  (`QUERY /groups` takes `invitedAt` from the membership), use a literal map with
  `satisfies Record<Attribute, "table.column">` — a renamed column still fails to compile.
- **`id` is always the last sort term.** Without it a list ordered on a repeated value has no
  defined order at a page boundary. Every list selects `id`; Postgres resolves a bare name against
  output columns first, so it needs no qualifying. Nulls sort last, for the joined columns.
- **`search` comes with the schema**, minimum length `TEXT_MINIMUM.search`, `ilike` on a substring.
  Build the pattern with `searchPattern()` — `%` and `_` mean something to `like`. Apply it with
  Kysely's `$if()` rather than reassigning the builder through an `if`; reassignment loses the
  builder's type. The non-null assertion inside the callback is the accepted cost.
- `FAVOURITES_FIRST` is a `SortTerm` handed to `listResultsWithCount` ahead of the request's own; it
  never comes from a request. Posts do not pass it — a thread is read in the order it was written.

## Two collections are deliberately not lists

`GET /groups/{groupId}/threads` returns every thread, newest activity first: the tab strip is the
only way between threads, so a missing one is unreachable. `GET /groups/{groupId}/memberships`
returns everyone, unpaged and unsorted: somebody missing from a member list is worse than a long
one, and the interface groups joined above invited, which it can only do holding all of them.

## The QUERY /users response

`USER_RESPONSE` is id and username only. A username is public within the platform; an email
address never is, and the schema *picks* rather than omits so a column added later cannot leak.

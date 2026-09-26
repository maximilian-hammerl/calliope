---
paths:
  - "backend/src/scope/**"
  - "backend/src/route/groups/**"
  - "backend/src/route/forum/**"
  - "backend/src/route/parent_scope_test.ts"
  - "backend/src/route/stranger_access_test.ts"
  - "backend/src/test/route_fixtures.ts"
---

# The ids in a path

A path names a child under its parent, and the member's rights are asked of the parent. A child from
somewhere else would be reached with rights it was never given.

## A resolver per id, then the handler

Each id has a resolver in `scope/`, and a route takes them as one chain from `scope/chains.ts` —
`middleware: JOINED_GROUP_POST`, which is `authenticated, joinedGroup, threadInGroup, postInThread`.
Each finds its row under the one resolved before it, answers 404 when the row is missing or not
visible, and hands it on — `c.get("thread")`. What the member may *do* stays in the handler, as
`mayAct` and a 403. A new path shape gets a new chain there, never a list in the route.

- **`visibleGroup` for a read, `joinedGroup` for a write** — the two gates `groups.md` describes.
- **They run before the validators**, so a malformed id is refused there with the validators' 400,
  `invalidRequest`, rather than reaching the database.
- **A folder id in a body** goes through `folderOf` or `forumFolderOf`, the resolvers' own lookup.

## Scoped ids

Resolvers hand ids on branded — `ThreadId`, `FolderId`, … in `scoped_id.ts` — and a service that
acts on a child takes only the brand, so a handler that skipped its resolver does not compile. The
lookups the resolvers use are the exception: their child parameter stays a string. A service test
that made its own ids scopes them with `mint`.

**Never cast to a scoped id or call `mint` outside `src/scope/` and tests**: take it from the
route's chain, or from `folderOf`/`forumFolderOf` for one in a body. No test probes a body, so a
cast there leaks.

## What the compiler does not see

A resolver left out of a chain still compiles, since Hono merges what every middleware declares; it
answers 500 at runtime (`earlier`). That is why the chains are written once, in `chains.ts`, and
`parent_scope_test.ts` covers the rest: it finds every path with a parent and a child in
`open-api.json` and requires a 404 for a child of another group and of the forum. A new route fails
there until it has a case.

## Beside it

`stranger_access_test.ts` asks the wider question: for every route with an id in its path, what a
member with no part in the rows gets at each visibility — and that, where they cannot see the rows,
the answer matches one for ids nobody has. `SCOPES` names the rows each part of the API is tried on;
a path under a new prefix fails there until it has some. Ids in a request body are not covered.

## Not covered

Favourites and forum permissions take a kind and an id, not a parent and a child;
`visible_target.ts` resolves those. Accepting an invitation names no child.

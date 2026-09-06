---
paths:
  - "frontend/src/lib/api/**"
  - "frontend/orval.config.ts"
  - "frontend/scripts/**"
  - "frontend/src/composables/usePagedList.ts"
  - "frontend/src/composables/useChatMessages.ts"
  - "frontend/src/components/common/ListPagination.vue"
---

# The generated client, query keys, paging

## Orval

- **Orval classifies by HTTP method**, so the QUERY list endpoints would become mutations. Each is
  declared as a query in `orval.config.ts` under `override.operations`; a new list endpoint needs
  the same entry.
- **The client resolves for every status and never throws**; `lib/api/apiFetch.ts` is the mutator
  that throws `ApiError`. It lives outside the generated `src/api/`.
- **Every operation gets its own copy of each model** (`LoginUser401`, …) and no shared error type,
  which is why `ApiErrorBody` is hand-written. Narrow responses on `status` before use.

## Query keys

**A list's key is a prefix of everything nested under it.** `['QUERY','api','chats']` also matches
`['QUERY','api','chats',id,'messages',body]`, so invalidating the list refetched every open
conversation. `listOnlyFilter` adds the length check; `exactKeyFilter` matches one key. Both return a
whole **filter** — pass them as the argument, never as `queryKey`. A QUERY key ends in the request
body, so `listKeyPrefix` drops that slot; a **GET** key has no body slot, so dropping its last
segment matches siblings too — invalidate a GET list with its key as it is. `queryKeys.spec.ts` pins
both behaviours.

## Paging

`usePagedList` owns the page number in the URL, the offset, the count and the correction of an
out-of-range page; `ListPagination` draws the strip over reka's `Pagination`, taking reka's props
(`page`, `total`, `itemsPerPage`) straight through. **Call it before the query it pages** and pass
the total as a getter, `() => total.value` — the body needs `offset` while the key is being built and
the total comes back from that same query. Getting the order wrong throws
`Cannot access 'offset' before initialization` during setup, which looks like a data problem.
`placeholderData: keepPreviousData`, or the strip blinks out between pages and the correction
watcher reads a momentary "0 results" as "page 1 is the last page". Switching order and returning
to page one is *one* `push`.

**Cursor-paged endpoints are hand-written**: Orval's `useInfinite` substitutes a query parameter,
and these carry paging in a body, so `useChatMessages` wraps the generated `listMessages` in its own
`useInfiniteQuery`, keyed off `getListMessagesQueryKey` so invalidation still reaches it.

## Length limits

`src/api/textLimit.ts` is generated from `open-api.json` by `scripts/generateTextLimit.ts`, keyed
`TEXT_LIMIT.<operation>.<property>.maxLength`. It reads every `oneOf` branch as well as the top
level — reading only the top produced no bounds at all for `moveReport`, silently — and throws if
branches disagree. The script is TypeScript run by Node's type stripping, so `tsconfig.node.json`
includes `scripts/**/*` and sets `erasableSyntaxOnly`, making stripping-incompatible syntax a type
error rather than a run-time one.

## 401

A 401 is only a lost session when the API says so: the wrong-password answer carries
`code: "invalid_credentials"`; anything else signs the member out. Two exceptions stay named in
`queryClient.ts` — the guard's own session check, and `logoutUser`.

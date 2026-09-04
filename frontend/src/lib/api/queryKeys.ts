/**
 * Turns a generated list query key into a prefix that matches every page of that list,
 * whatever body it was asked with.
 *
 * Orval puts the request body in the key's last slot, and omitting the argument does not
 * shorten the array — it leaves `undefined` sitting there. TanStack compares that slot
 * against the real body and finds no match, so an invalidation written as
 * `getListPostsQueryKey(groupId, threadId)` looks right and refreshes nothing at all.
 *
 * Dropping the slot is also the more correct filter: a mutation invalidates the list as
 * such, not the one page whose parameters the caller happens to know.
 *
 * **Only for a QUERY list.** A GET list — threads, memberships — carries no body slot, so its
 * whole key is its identity; dropping the last segment there leaves `['api','groups',id]`,
 * which matches every other nested GET of that group. Invalidate those with the key itself.
 */
export function listKeyPrefix(queryKey: readonly unknown[]): unknown[] {
  return queryKey.slice(0, -1)
}

/**
 * The same thing, but matching only *that* list — not the resources nested under it. QUERY-only
 * for the same reason as above.
 *
 * Orval's keys are the URL split into segments, so a list's prefix is also the prefix of
 * everything below it: `['QUERY','api','chats']` matches the messages of every chat as well.
 * Marking a chat read invalidated the list and, silently, the open conversation with it — one
 * request per page once the conversation pages. The length check is what separates the two,
 * since a nested key is always longer.
 */
export function listOnlyFilter(queryKey: readonly unknown[]) {
  return {
    queryKey: queryKey.slice(0, -1),
    predicate: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey.length === queryKey.length,
  }
}

/**
 * A **GET** list's own key and nothing nested under it. The counterpart of `listOnlyFilter`,
 * which slices a body slot a GET key does not have.
 *
 * Orval's keys are the URL split into segments, so a GET list's whole key is a prefix of every
 * item below it: `['api','forum','threads']` matches `['api','forum','threads',id]` for every
 * thread. Invalidating the list after a favourite therefore refetched the detail query of every
 * thread the reader had opened. The length check is the only thing separating the two.
 */
export function exactKeyFilter(queryKey: readonly unknown[]) {
  return {
    queryKey,
    predicate: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey.length === queryKey.length,
  }
}

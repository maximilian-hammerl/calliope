/**
 * Turns a generated list query key into a prefix that matches every page of that list,
 * whatever body it was asked with.
 *
 * Orval puts the request body in the key's last slot, and omitting the argument does not
 * shorten the array — it leaves `undefined` sitting there. TanStack compares that slot
 * against the real body and finds no match, so an invalidation written as
 * `getListMembershipsQueryKey(groupId)` looks right and refreshes nothing at all.
 *
 * Dropping the slot is also the more correct filter: a mutation invalidates the list as
 * such, not the one page whose parameters the caller happens to know.
 */
export function listKeyPrefix(queryKey: readonly unknown[]): unknown[] {
  return queryKey.slice(0, -1)
}

/**
 * The same thing, but matching only *that* list — not the resources nested under it.
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

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

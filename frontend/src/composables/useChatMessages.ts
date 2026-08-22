import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { getListMessagesQueryKey, listMessages } from '@/api/chats/chats'
import type { ListMessages200ResultsItem } from '@/api/models'

/**
 * A conversation's history, paged backwards by cursor.
 *
 * Hand-written rather than generated: Orval's `useInfinite` substitutes a *query parameter*,
 * and these endpoints carry their paging in a JSON body, so the generated `listMessages`
 * function is called directly instead. `getListMessagesQueryKey` still supplies the key, so
 * an invalidation written against the generated key reaches this query too.
 */
const PAGE_SIZE = 50

export function useChatMessages(chatGroupId: MaybeRefOrGetter<string>) {
  const query = useInfiniteQuery({
    // The body slot carries the page size only; the cursor lives in the page params, or every
    // page would be a separate cache entry.
    queryKey: computed(() => getListMessagesQueryKey(toValue(chatGroupId), { limit: PAGE_SIZE })),
    queryFn: ({ pageParam }) =>
      listMessages(toValue(chatGroupId), {
        limit: PAGE_SIZE,
        before: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    // Null means the beginning of the conversation has been reached.
    getNextPageParam: (lastPage) =>
      lastPage.status === 200 ? (lastPage.data.nextCursor ?? undefined) : undefined,
  })

  /** Every page flattened. Each page is newest-first, and pages run newest to oldest. */
  const fetched = computed<ListMessages200ResultsItem[]>(() =>
    (query.data.value?.pages ?? []).flatMap((page) =>
      page.status === 200 ? page.data.results : [],
    ),
  )

  /** Whether a load has ever succeeded, which is not the same as having any messages. */
  const hasLoaded = computed<boolean>(() =>
    (query.data.value?.pages ?? []).some((page) => page.status === 200),
  )

  return {
    fetched,
    hasLoaded,
    isPending: query.isPending,
    isError: query.isError,
    hasOlder: query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: query.fetchNextPage,
    refetch: query.refetch,
  }
}

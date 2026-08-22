import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useSearch as useSearchQuery } from '@/api/search/search'
import type { Search200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'

/**
 * One request per search rather than one per kind: the endpoint runs them together, so the
 * results arrive as a set instead of three sections appearing raggedly, and a member typing
 * spends one of their 300 requests per quarter hour rather than three.
 */
export function useSearch(term: Ref<string>): {
  results: ComputedRef<Search200 | undefined>
  isSearching: Ref<boolean>
  termIsLongEnough: ComputedRef<boolean>
  minimumLength: number
} {
  const minimumLength = TEXT_LIMIT.search.search.minLength ?? 3

  /** What the request actually asks for, which only follows the field once typing pauses. */
  const settled = ref<string>('')
  const trimmed = computed<string>(() => term.value.trim())
  const termIsLongEnough = computed<boolean>(() => trimmed.value.length >= minimumLength)

  watchDebounced(
    trimmed,
    (value) => {
      settled.value = value
    },
    { debounce: 300 },
  )

  const { data, isFetching } = useSearchQuery(() => ({ search: settled.value }), {
    query: {
      // Below the minimum the server would refuse it anyway, so nothing is asked.
      enabled: () => settled.value.length >= minimumLength,
      // The same term a moment later is the same answer; typing back and forth is free.
      staleTime: 30_000,
    },
  })

  const results = computed<Search200 | undefined>(() =>
    data.value?.status === 200 ? data.value.data : undefined,
  )

  // Still typing counts as searching, so the popover does not flash "nothing found" between
  // a keystroke and the request it will cause.
  const isSearching = computed<boolean>(
    () => isFetching.value || (termIsLongEnough.value && settled.value !== trimmed.value),
  )

  return { results, isSearching, termIsLongEnough, minimumLength }
}

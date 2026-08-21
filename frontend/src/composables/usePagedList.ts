import { computed, type MaybeRefOrGetter, onMounted, toValue, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * The page a list is showing, kept in the URL.
 *
 * In the URL because that is what makes jumping durable: a reload, the back button and a
 * second tab opened on the page being referenced all keep their place. Route keys are English
 * like every other path; only what the member reads is German.
 *
 * The total is read *lazily* — through a getter, never during setup — so this can be called
 * either side of the query that produces it. A view needs `offset` to build its request and
 * the request to know the total, and one of the two consts has to come second: reading eagerly
 * put whichever it was in its temporal dead zone and the list rendered nothing at all.
 */
export function usePagedList(
  pageSize: number,
  totalResults: MaybeRefOrGetter<number | undefined>,
  parameter = 'page',
) {
  const route = useRoute()
  const router = useRouter()

  const page = computed<number>(() => {
    const asked = Number(route.query[parameter])
    return Number.isInteger(asked) && asked >= 1 ? asked : 1
  })

  const offset = computed<number>(() => (page.value - 1) * pageSize)

  const pageCount = computed<number>(() =>
    Math.max(1, Math.ceil((toValue(totalResults) ?? 0) / pageSize)),
  )

  /**
   * Merges into the query rather than replacing it, so a list's page and whatever else a view
   * keeps there survive each other. An `undefined` value drops the key, which is how a default
   * stays absent from the address and a plain link stays plain.
   */
  function navigate(patch: Record<string, string | undefined>): void {
    void router.push({ query: { ...route.query, ...patch } })
  }

  function goToPage(next: number): void {
    navigate({ [parameter]: next === 1 ? undefined : String(next) })
  }

  /**
   * A page that no longer exists — rows were deleted, a filter narrowed the list, or a link is
   * stale — would otherwise render as an empty list. Corrected only once the count is *known*:
   * acting while it is unknown reads the momentary nothing as "there is one page" and undoes
   * every page change, which looks exactly like a dead button.
   */
  onMounted(() => {
    watch([() => toValue(totalResults), pageCount, page], ([total, pages, current]) => {
      if (total !== undefined && current > pages) {
        goToPage(pages)
      }
    })
  })

  return { page, offset, pageCount, goToPage, navigate }
}

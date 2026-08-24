import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useListSteps } from '@/api/steps/steps'
import type { ListSteps200ResultsItem } from '@/api/models'

/**
 * A group's next steps, split by state. Both the rail block and the views that label it need the
 * open count — the block to list them, the label to say „3 offen" while it is closed — and
 * vue-query serves the second caller from the first one's cache.
 */
export function useSteps(groupId: Ref<string> | (() => string)): {
  open: ComputedRef<ListSteps200ResultsItem[]>
  completed: ComputedRef<ListSteps200ResultsItem[]>
} {
  const { data } = useListSteps(() => (typeof groupId === 'function' ? groupId() : groupId.value))

  const steps = computed<ListSteps200ResultsItem[]>(() =>
    data.value?.status === 200 ? data.value.data.results : [],
  )

  return {
    open: computed<ListSteps200ResultsItem[]>(() =>
      steps.value.filter((step) => step.completedAt === null),
    ),
    completed: computed<ListSteps200ResultsItem[]>(() =>
      steps.value.filter((step) => step.completedAt !== null),
    ),
  }
}

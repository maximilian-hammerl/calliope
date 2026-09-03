import type { ComputedRef, InjectionKey } from 'vue'
import { inject, provide } from 'vue'
import type { GetGroup200, ListMemberships200ResultsItem } from '@/api/models'

/**
 * What every page inside a group needs, fetched once by `GroupLayout` rather than by each of
 * them. Before this the group page, a thread and a page each ran `useGetGroup` and
 * `useListMemberships` and each derived the two permissions itself — three copies that had
 * already drifted into two different shapes.
 */
export type GroupContext = {
  groupId: ComputedRef<string>
  group: ComputedRef<GetGroup200 | undefined>
  memberships: ComputedRef<ListMemberships200ResultsItem[]>
  /** Writers and administrators. A reader may only read; giving them a voice is #38. */
  mayWrite: ComputedRef<boolean>
  mayAdminister: ComputedRef<boolean>
  isPending: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  /** The group and the lists it is reached from, which both show the favourite. */
  refreshGroup: () => Promise<void>
}

const GROUP_CONTEXT = Symbol('groupContext') as InjectionKey<GroupContext>

export function provideGroupContext(context: GroupContext): void {
  provide(GROUP_CONTEXT, context)
}

/**
 * Throws rather than returning undefined: a page that asks for this is a page under
 * `/groups/:groupId`, so a missing provider is a routing mistake and not a state to render.
 */
export function useGroupContext(): GroupContext {
  const context = inject(GROUP_CONTEXT)
  if (context === undefined) {
    throw new Error('useGroupContext() outside GroupLayout')
  }
  return context
}

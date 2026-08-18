import { computed, type ComputedRef, type Ref } from 'vue'
import { useGetCurrentUser } from '@/api/auth/auth'
import type { ListMemberships200ResultsItem } from '@/api/models'

/**
 * The group endpoints do not report the viewer's own role, so it is read out of the member
 * list the group page loads anyway. Only a joined membership carries a role: someone invited
 * as an administrator has not accepted yet and may not act as one.
 */
export function useGroupRole(memberships: Ref<ListMemberships200ResultsItem[]>): {
  role: ComputedRef<ListMemberships200ResultsItem['role'] | undefined>
  mayWrite: ComputedRef<boolean>
} {
  const { data } = useGetCurrentUser()

  const role = computed(() => {
    const userId = data.value?.status === 200 ? data.value.data.id : undefined
    if (userId === undefined) {
      return undefined
    }

    const own = memberships.value.find((membership) => membership.userId === userId)
    return own?.status === 'joined' ? own.role : undefined
  })

  // Readers may read and comment; writing is for writers and administrators.
  const mayWrite = computed(() => role.value === 'writer' || role.value === 'administrator')

  return { role, mayWrite }
}

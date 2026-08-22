import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListMembershipsQueryKey,
  useAcceptInvitation,
  useRemoveMember,
} from '@/api/memberships/memberships'
import { useGetCurrentUser } from '@/api/auth/auth'
import { getGetGroupQueryKey, getListGroupsQueryKey } from '@/api/groups/groups'
import { listOnlyFilter } from '@/lib/api/queryKeys'

/**
 * Everything a member does to their own membership: accepting an invitation, declining one, and
 * leaving. Four places offer some of it — the banner on the group, the Einladungen section of
 * Meine Gruppen, and the members list — and all of them invalidate the same three things
 * afterwards, which is the part worth having in one place.
 *
 * Declining and leaving are one call. The endpoint treats them as the same act, because both
 * end with no membership row, and the only difference is which word the member reads.
 */
export function useOwnMembership(groupId: Ref<string> | (() => string)): {
  accept: () => Promise<boolean>
  decline: () => Promise<boolean>
  leave: () => Promise<boolean>
  isAccepting: Ref<boolean>
  isDeclining: Ref<boolean>
  isBusy: ComputedRef<boolean>
  error: Ref<string | undefined>
} {
  const queryClient = useQueryClient()
  const error = ref<string | undefined>(undefined)

  const id = (): string => (typeof groupId === 'function' ? groupId() : groupId.value)

  const { data: currentUserData } = useGetCurrentUser()
  const { mutateAsync: acceptInvitation, isPending: isAccepting } = useAcceptInvitation()
  const { mutateAsync: removeMembership, isPending: isDeclining } = useRemoveMember()

  /** One's own row, which is what the endpoint allows without administering the group. */
  function removeOwn(forGroupId: string): Promise<unknown> {
    const userId = currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined
    if (userId === undefined) {
      return Promise.reject(new Error('No current user'))
    }
    return removeMembership({ groupId: forGroupId, userId })
  }

  /** The group's own standing changed, and so did every list it appears in. */
  async function refresh(forGroupId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(forGroupId) }),
      queryClient.invalidateQueries(listOnlyFilter(getListGroupsQueryKey())),
      queryClient.invalidateQueries({
        queryKey: getListMembershipsQueryKey(forGroupId),
      }),
    ])
  }

  /** False when it failed, so the caller can leave the row where it is and say so. */
  async function respond(
    action: (forGroupId: string) => Promise<unknown>,
    message: string,
  ): Promise<boolean> {
    const forGroupId = id()
    error.value = undefined

    try {
      await action(forGroupId)
    } catch {
      error.value = message
      return false
    }

    await refresh(forGroupId)
    return true
  }

  return {
    accept: () =>
      respond(
        (forGroupId) => acceptInvitation({ groupId: forGroupId }),
        'Die Einladung konnte nicht angenommen werden. Versuche es noch einmal.',
      ),
    decline: () =>
      respond(removeOwn, 'Die Einladung konnte nicht abgelehnt werden. Versuche es noch einmal.'),
    leave: () =>
      respond(removeOwn, 'Die Gruppe konnte nicht verlassen werden. Versuche es noch einmal.'),
    isAccepting,
    isDeclining,
    isBusy: computed<boolean>(() => isAccepting.value || isDeclining.value),
    error,
  }
}

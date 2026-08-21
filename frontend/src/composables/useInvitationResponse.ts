import { computed, type ComputedRef, ref, type Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListMembershipsQueryKey,
  useAcceptInvitation,
  useLeaveGroup,
} from '@/api/memberships/memberships'
import { getGetGroupQueryKey, getListGroupsQueryKey } from '@/api/groups/groups'
import { listOnlyFilter } from '@/lib/api/queryKeys'

/**
 * Answering an invitation to a writing group. Two places offer this — the banner on the group
 * itself and the Einladungen section of Meine Gruppen — and both have to invalidate the same
 * three things afterwards, which is the part worth having in one place.
 *
 * Declining is `leaveGroup`: the backend treats leaving and declining as the same act, since
 * both end with no membership row.
 */
export function useInvitationResponse(groupId: Ref<string> | (() => string)): {
  accept: () => Promise<boolean>
  decline: () => Promise<boolean>
  isAccepting: Ref<boolean>
  isDeclining: Ref<boolean>
  isBusy: ComputedRef<boolean>
  error: Ref<string | undefined>
} {
  const queryClient = useQueryClient()
  const error = ref<string | undefined>(undefined)

  const id = (): string => (typeof groupId === 'function' ? groupId() : groupId.value)

  const { mutateAsync: acceptInvitation, isPending: isAccepting } = useAcceptInvitation()
  const { mutateAsync: leaveGroup, isPending: isDeclining } = useLeaveGroup()

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
      respond(
        (forGroupId) => leaveGroup({ groupId: forGroupId }),
        'Die Einladung konnte nicht abgelehnt werden. Versuche es noch einmal.',
      ),
    isAccepting,
    isDeclining,
    isBusy: computed<boolean>(() => isAccepting.value || isDeclining.value),
    error,
  }
}

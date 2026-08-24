import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListChatMembershipsQueryKey,
  getListChatsQueryKey,
  useAcceptChatInvitation,
  useLeaveChat,
} from '@/api/chats/chats'
import { listKeyPrefix, listOnlyFilter } from '@/lib/api/queryKeys'

/**
 * Everything a member does to their own place in a chat: accepting an invitation, declining
 * one, and leaving. The chat-side twin of `useOwnMembership`, and for the same reason — the
 * list of chats and the invitation pane both offer some of it and invalidate the same things.
 *
 * Declining and leaving are one call, as they are for a group: both end with no membership
 * row, and the only difference is which word the member reads.
 */
export function useOwnChatMembership(chatGroupId: Ref<string> | (() => string)): {
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

  const id = (): string => (typeof chatGroupId === 'function' ? chatGroupId() : chatGroupId.value)

  const { mutateAsync: acceptInvitation, isPending: isAccepting } = useAcceptChatInvitation()
  const { mutateAsync: leaveChat, isPending: isDeclining } = useLeaveChat()

  /**
   * Only the list: whoever is gone from a chat has no business refetching its memberships, and
   * for the last one out the chat itself no longer exists.
   */
  async function refreshList() {
    await queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))
  }

  /** False when it failed, so the caller can leave the pane where it is and say so. */
  async function respond(
    action: (forChatGroupId: string) => Promise<unknown>,
    message: string,
  ): Promise<boolean> {
    const forChatGroupId = id()
    error.value = undefined

    try {
      await action(forChatGroupId)
    } catch {
      error.value = message
      return false
    }

    await refreshList()
    return true
  }

  return {
    accept: () =>
      respond(async (forChatGroupId) => {
        await acceptInvitation({ chatId: forChatGroupId })
        // Joining changes who is in it, and the pane names them.
        await queryClient.invalidateQueries({
          queryKey: listKeyPrefix(getListChatMembershipsQueryKey(forChatGroupId)),
        })
      }, 'Die Einladung konnte nicht angenommen werden. Versuche es noch einmal.'),
    decline: () =>
      respond(
        (forChatGroupId) => leaveChat({ chatId: forChatGroupId }),
        'Die Einladung konnte nicht abgelehnt werden. Versuche es noch einmal.',
      ),
    leave: () =>
      respond(
        (forChatGroupId) => leaveChat({ chatId: forChatGroupId }),
        'Der Chat konnte nicht verlassen werden. Versuche es noch einmal.',
      ),
    isAccepting,
    isDeclining,
    isBusy: computed<boolean>(() => isAccepting.value || isDeclining.value),
    error,
  }
}

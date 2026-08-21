import { ref } from 'vue'
import {
  useClearReaderState,
  useSetReaderState,
  useStartStoryIdeaConversation,
} from '@/api/story-ideas/story-ideas'
import { getListChatsQueryKey } from '@/api/chats/chats'
import { openChatDialog } from '@/lib/chat/openChatDialog'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'

/**
 * What a member can do *to* somebody else's idea, shared by the detail page and the carousel.
 * It performs the change and reports what happened; invalidation is the caller's, because the
 * two views cache different things — the carousel holds its slides itself and would drop the
 * one on screen if it refetched.
 */
export function useStoryIdeaActions() {
  const { mutateAsync: setReaderState } = useSetReaderState()
  const { mutateAsync: clearReaderState } = useClearReaderState()
  const savingReaderState = ref<boolean>(false)

  /**
   * Null puts the idea back to unread, which is the absence of a row rather than a third value.
   * Choosing the state an idea already has clears it, so one control both sets and undoes.
   */
  async function changeReaderState(ideaId: string, state: 'read' | 'marked' | null) {
    savingReaderState.value = true
    try {
      if (state === null) {
        await clearReaderState({ ideaId })
      } else {
        await setReaderState({ ideaId, data: { state } })
      }
    } finally {
      savingReaderState.value = false
    }
  }

  const { mutateAsync: startConversation, isPending: startingConversation } =
    useStartStoryIdeaConversation()
  const conversationError = ref<string | undefined>(undefined)

  /** Creates the chat with the author invited, then opens the messages dialog on it. */
  async function askAboutIdea(ideaId: string) {
    conversationError.value = undefined
    try {
      const created = await startConversation({ ideaId })
      if (created.status !== 201) {
        return
      }
      await queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))
      openChatDialog(created.data.id)
    } catch {
      conversationError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    }
  }

  return {
    savingReaderState,
    changeReaderState,
    startingConversation,
    conversationError,
    askAboutIdea,
  }
}

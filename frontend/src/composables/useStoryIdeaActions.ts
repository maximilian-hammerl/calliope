import { ref } from 'vue'
import { failureMessage } from '@/lib/format/failure'
import {
  useClearStoryIdeaRead,
  useMarkStoryIdeaRead,
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
  const { mutateAsync: markRead } = useMarkStoryIdeaRead()
  const { mutateAsync: clearRead } = useClearStoryIdeaRead()
  const savingRead = ref<boolean>(false)

  /**
   * False puts the idea back to unread, which is the absence of a row rather than a value. One
   * control both sets and undoes.
   */
  async function changeRead(ideaId: string, isRead: boolean) {
    savingRead.value = true
    try {
      if (isRead) {
        await markRead({ ideaId })
      } else {
        await clearRead({ ideaId })
      }
    } finally {
      savingRead.value = false
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
    } catch (error) {
      conversationError.value = failureMessage(error)
    }
  }

  return {
    savingRead,
    changeRead,
    startingConversation,
    conversationError,
    askAboutIdea,
  }
}

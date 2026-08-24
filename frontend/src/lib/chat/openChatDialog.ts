import { ref } from 'vue'

/**
 * A chat has no URL, and the Chats dialog lives in the top bar. Pages that start a
 * conversation set this; the top bar watches it and opens the dialog at that chat, then
 * clears it so the same chat can be requested again later.
 */
export const requestedChatId = ref<string | undefined>(undefined)

export function openChatDialog(chatGroupId: string): void {
  requestedChatId.value = chatGroupId
}

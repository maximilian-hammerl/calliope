<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { Plus } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getListChatMembershipsQueryKey, useInviteToChat } from '@/api/chats/chats'
import type { ListUsers200ResultsItem } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { Alert, AlertDescription } from '@/components/ui/alert'
import UserPicker from '@/components/user/UserPicker.vue'

const props = defineProps<{ chatGroupId: string; memberIds: string[] }>()

const queryClient = useQueryClient()

const picker = useTemplateRef('picker')
const open = ref<boolean>(false)
const formError = ref<string | undefined>(undefined)

// A different conversation is a different invitation.
watch(
  () => props.chatGroupId,
  () => {
    open.value = false
    picker.value?.reset()
    formError.value = undefined
  },
)

const { mutateAsync: inviteToChat, isPending } = useInviteToChat()

async function invite(user: ListUsers200ResultsItem) {
  formError.value = undefined

  try {
    await inviteToChat({ chatId: props.chatGroupId, data: { userId: user.id } })
  } catch (error) {
    formError.value =
      error instanceof ApiError && error.status === 409
        ? `${user.username} ist schon eingeladen oder schon dabei.`
        : 'Die Einladung wurde nicht verschickt. Versuche es noch einmal.'
    return
  }

  picker.value?.reset()
  open.value = false
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListChatMembershipsQueryKey(props.chatGroupId)),
  })
}
</script>

<template>
  <div>
    <button
      type="button"
      class="flex items-center gap-[4px] text-[12.5px] text-ink-5 hover:text-oak-deep"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Plus :size="14" :stroke-width="1.5" />
      Einladen
    </button>

    <div v-if="open" class="mt-2">
      <Alert v-if="formError" variant="destructive" role="alert" class="mb-2">
        <AlertDescription>{{ formError }}</AlertDescription>
      </Alert>

      <!-- No v-model: a pick here is the invitation, so nothing stays selected afterwards. -->
      <UserPicker
        ref="picker"
        input-id="chat-invite-search"
        :exclude-ids="memberIds"
        :disabled="isPending"
        @pick="invite"
      />
    </div>
  </div>
</template>

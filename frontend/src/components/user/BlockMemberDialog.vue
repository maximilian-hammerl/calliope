<script setup lang="ts">
/**
 * The copy carries the feature's real shape: a block stops contact, and deliberately does not
 * touch what is already shared. Saying so here is what keeps the word "blockieren" honest.
 */
import { ref } from 'vue'
import { useBlockMember } from '@/api/blocks/blocks'
import { getGetUserQueryKey, getListUsersQueryKey } from '@/api/users/users'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ userId: string; username: string }>()
const emit = defineEmits<{ blocked: [] }>()

const { mutateAsync: block, isPending } = useBlockMember()
const error = ref<string | undefined>(undefined)

async function confirm() {
  error.value = undefined
  try {
    await block({ data: { userId: props.userId } })
  } catch {
    error.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(props.userId) }),
    queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListUsersQueryKey()) }),
  ])

  open.value = false
  emit('blocked')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>{{ props.username }} blockieren?</DialogTitle>
        <DialogDescription>
          Ihr könnt euch danach nicht mehr einladen — in keine Gruppe und in keinen Chat.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="error" variant="destructive" role="alert">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <p>Offene Einladungen zwischen euch werden zurückgezogen.</p>
        <p>
          Gruppen und Chats, in denen ihr beide schon seid, bleiben bestehen — die kannst du selbst
          verlassen. Geschriebenes bleibt stehen.
        </p>
        <p>Du kannst die Blockierung jederzeit in den Einstellungen aufheben.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" variant="destructive" :disabled="isPending" @click="confirm">
          Blockieren
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

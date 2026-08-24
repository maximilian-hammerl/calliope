<script setup lang="ts">
/**
 * Leaving is reversible only if somebody invites you back, and for the last person out it is
 * not reversible at all: the conversation and everything said in it go with them, by the
 * trigger that removes a chat nobody is left in. Same two variants as `LeaveGroupDialog`.
 */
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
import { Spinner } from '@/components/ui/spinner'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  pending: boolean
  /** Counts anybody still deciding: an unanswered invitation keeps the conversation alive. */
  deletesTheChat: boolean
  error?: string
}>()
defineEmits<{ confirmed: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>
          {{ props.deletesTheChat ? 'Chat verlassen und löschen?' : 'Chat verlassen?' }}
        </DialogTitle>
        <DialogDescription>
          <template v-if="props.deletesTheChat">
            Du bist die letzte Person darin. Verlässt du ihn, wird er gelöscht.
          </template>
          <template v-else>
            Du kannst nur wieder dazukommen, wenn dich jemand erneut einlädt.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="props.error" variant="destructive" role="alert">
          <AlertDescription>{{ props.error }}</AlertDescription>
        </Alert>

        <p v-if="props.deletesTheChat">
          Alle Nachrichten gehen mit ihm. Das lässt sich nicht zurückholen.
        </p>
        <p v-else>Was du geschrieben hast, bleibt im Chat stehen.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          :variant="props.deletesTheChat ? 'destructive' : 'default'"
          :disabled="pending"
          @click="$emit('confirmed')"
        >
          <Spinner v-if="pending" />
          {{ props.deletesTheChat ? 'Verlassen und löschen' : 'Chat verlassen' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

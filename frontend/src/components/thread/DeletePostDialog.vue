<script setup lang="ts">
/**
 * Solid rather than destructive: the design system reserves the red fill for acts that destroy a
 * body of writing including other people's, and names a single post as outside it — one
 * paragraph, removed by whoever wrote it or by somebody who administers the group.
 *
 * The name is there when it is somebody else's, because removing your own paragraph and
 * moderating another member's are not the same act and the confirmation is where that registers.
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
  /** Absent for your own post, and for one whose author deleted their account. */
  authorName?: string
  pending: boolean
  error?: string
}>()
defineEmits<{ confirmed: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>
          <template v-if="props.authorName"> Beitrag von {{ props.authorName }} löschen? </template>
          <template v-else>Beitrag löschen?</template>
        </DialogTitle>
        <DialogDescription>Der Beitrag verschwindet aus dem Thema.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="props.error" variant="destructive" role="alert">
          <AlertDescription>{{ props.error }}</AlertDescription>
        </Alert>

        <p v-if="props.authorName">
          Du löschst, was jemand anderes geschrieben hat. Das lässt sich nicht zurückholen.
        </p>
        <p v-else>Das lässt sich nicht zurückholen.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" :disabled="pending" @click="$emit('confirmed')">
          <Spinner v-if="pending" />
          Beitrag löschen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

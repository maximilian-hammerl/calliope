<script setup lang="ts">
/**
 * Deleting an idea destroys only its author's own text — conversations that grew out of it are
 * ordinary chats and stay — so the confirmation stops at Solid. Red is for taking other people's
 * writing with you.
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
  title: string
  pending: boolean
  error?: string
}>()
defineEmits<{ confirmed: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>„{{ props.title }}“ löschen?</DialogTitle>
        <DialogDescription>
          Die Idee wird gelöscht und ist danach nicht mehr zu finden.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="props.error" variant="destructive" role="alert">
          <AlertDescription>{{ props.error }}</AlertDescription>
        </Alert>

        <p>
          Das lässt sich nicht zurückholen. Chats, die daraus entstanden sind, bleiben bestehen.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" :disabled="pending" @click="$emit('confirmed')">
          <Spinner v-if="pending" />
          Idee löschen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

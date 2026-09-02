<script setup lang="ts">
/**
 * Destructive fill, as a thread's deletion takes: a page is a body of writing the group
 * maintains together, so what is lost is not only the deleter's own.
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
const props = defineProps<{ title: string; pending: boolean; error?: string }>()
defineEmits<{ confirmed: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>„{{ props.title }}“ löschen?</DialogTitle>
        <DialogDescription>Die Seite und ihr Text werden gelöscht.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="props.error" variant="destructive" role="alert">
          <AlertDescription>{{ props.error }}</AlertDescription>
        </Alert>

        <p>Das lässt sich nicht zurückholen.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" variant="destructive" :disabled="pending" @click="$emit('confirmed')">
          <Spinner v-if="pending" />
          Seite löschen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

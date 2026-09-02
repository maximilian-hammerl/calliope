<script setup lang="ts">
/**
 * Deleting a thread destroys writing that is not only the deleter's own, and nothing brings it
 * back — which is why this takes the destructive fill the design system otherwise reserves for
 * the account-deletion flow. Removing a member or a single post does not: those are reversible
 * by doing them again.
 *
 * The post count is named because "dieses Thema löschen" understates what happens.
 */
import { computed } from 'vue'
import { pluralize } from '@/lib/format/formatText'
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
  postCount?: number
  pending: boolean
  error?: string
}>()
defineEmits<{ confirmed: [] }>()

/**
 * Absent while the posts are still loading, and left unsaid at zero rather than read
 * "0 Beiträge". The singular drops the numeral: "seine 1 Beitrag" agrees with nothing.
 */
const posts = computed<string | undefined>(() => {
  if (props.postCount === undefined || props.postCount === 0) {
    return undefined
  }
  return props.postCount === 1
    ? 'sein Beitrag'
    : `seine ${pluralize(props.postCount, 'Beitrag', 'Beiträge')}`
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>„{{ props.title }}“ löschen?</DialogTitle>
        <DialogDescription>
          <template v-if="posts"> Das Thema und {{ posts }} werden gelöscht. </template>
          <template v-else>Das Thema wird gelöscht.</template>
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="props.error" variant="destructive" role="alert">
          <AlertDescription>{{ props.error }}</AlertDescription>
        </Alert>

        <p v-if="posts">Auch was andere geschrieben haben. Das lässt sich nicht zurückholen.</p>
        <p v-else>Das lässt sich nicht zurückholen.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" variant="destructive" :disabled="pending" @click="$emit('confirmed')">
          <Spinner v-if="pending" />
          Thema löschen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

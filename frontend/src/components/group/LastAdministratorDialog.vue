<script setup lang="ts">
/**
 * Warns rather than refuses: nothing in the database stops a group losing its last
 * administrator, and the guard that would was judged more machinery than a state nobody has
 * reached is worth. See the issue for the reasoning, including why account deletion cannot be
 * blocked the same way.
 *
 * Only a confirmation — the change itself stays with the list, so there is one place that
 * patches a membership and invalidates it.
 */
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
defineProps<{ pending: boolean }>()
defineEmits<{ confirmed: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>Du verwaltest diese Gruppe allein</DialogTitle>
        <DialogDescription>
          Gibst du die Rolle ab, verwaltet danach niemand mehr diese Gruppe.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <p>
          Dann kann niemand mehr Mitglieder einladen, Rollen ändern oder die Gruppe bearbeiten —
          auch du nicht.
        </p>
        <p>Mach am besten zuerst jemand anderen zum Admin.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" variant="destructive" :disabled="pending" @click="$emit('confirmed')">
          Rolle trotzdem abgeben
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

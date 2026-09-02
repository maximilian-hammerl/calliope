<script setup lang="ts">
/**
 * Leaving is reversible only if somebody invites you back, and for the last member it is not
 * reversible at all: the group and everything written in it go with them, by the trigger that
 * removes a group nobody is left in. That case gets the destructive weight; the ordinary one
 * says what it costs and no more.
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
const props = defineProps<{
  pending: boolean
  deletesTheGroup: boolean
  leavesNobodyAdministering: boolean
}>()
defineEmits<{ confirmed: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-confirm">
      <DialogHeader>
        <DialogTitle>
          {{ props.deletesTheGroup ? 'Gruppe verlassen und löschen?' : 'Gruppe verlassen?' }}
        </DialogTitle>
        <DialogDescription>
          <template v-if="props.deletesTheGroup">
            Du bist das letzte Mitglied. Verlässt du die Gruppe, wird sie gelöscht.
          </template>
          <template v-else>
            Du kannst nur wieder dazukommen, wenn dich jemand erneut einlädt.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <p v-if="props.deletesTheGroup">
          Alle Themen, Beiträge und Nächsten Schritte gehen mit ihr. Das lässt sich nicht
          zurückholen.
        </p>
        <p v-else-if="props.leavesNobodyAdministering">
          Du verwaltest die Gruppe allein. Danach kann niemand mehr Mitglieder einladen, Rollen
          ändern oder die Gruppe bearbeiten. Mach am besten zuerst jemand anderen zum Admin.
        </p>
        <p v-else>Was du geschrieben hast, bleibt in der Gruppe stehen.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="pending" @click="open = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          :variant="props.deletesTheGroup ? 'destructive' : 'default'"
          :disabled="pending"
          @click="$emit('confirmed')"
        >
          {{ props.deletesTheGroup ? 'Verlassen und löschen' : 'Gruppe verlassen' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

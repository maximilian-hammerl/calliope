<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getListMembershipsQueryKey, useInviteMember } from '@/api/memberships/memberships'
import type { InviteMemberBodyRole, ListUsers200ResultsItem } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import UserPicker from '@/components/user/UserPicker.vue'
import { Spinner } from '@/components/ui/spinner'

const props = defineProps<{ groupId: string; memberIds: string[] }>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()

const picker = useTemplateRef('picker')
const selected = ref<ListUsers200ResultsItem | undefined>(undefined)
const role = ref<InviteMemberBodyRole>('writer')
const formError = ref<string | undefined>(undefined)

watch(open, (isOpen) => {
  if (isOpen) {
    return
  }
  picker.value?.reset()
  selected.value = undefined
  role.value = 'writer'
  formError.value = undefined
})

// A different pick is a different attempt, so the failure of the last one stops applying.
watch(selected, () => {
  formError.value = undefined
})

const { mutateAsync: inviteMember, isPending } = useInviteMember()

async function submit() {
  const user = selected.value
  if (user === undefined) {
    return
  }

  formError.value = undefined

  try {
    await inviteMember({ groupId: props.groupId, data: { userId: user.id, role: role.value } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      formError.value = `${user.username} gehört schon zur Gruppe oder ist bereits eingeladen.`
      return
    }
    formError.value = 'Die Einladung konnte nicht verschickt werden. Versuche es noch einmal.'
    return
  }

  await queryClient.invalidateQueries({
    queryKey: getListMembershipsQueryKey(props.groupId),
  })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Mitglied einladen</DialogTitle>
        <DialogDescription>
          Such nach dem Benutzernamen. Eingeladene entscheiden selbst, ob sie beitreten.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <UserPicker
          ref="picker"
          v-model="selected"
          label="Benutzername"
          :exclude-ids="memberIds"
          :active="open"
          :disabled="isPending"
        />

        <!-- Always here, rather than appearing on selection: a dialog that grows under the
             cursor mid-interaction moves the buttons out from under it. -->
        <FieldGroup>
          <Field>
            <FieldLabel for="invite-role">Rolle</FieldLabel>
            <select
              id="invite-role"
              v-model="role"
              name="role"
              class="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm disabled:opacity-50 md:h-9"
              :disabled="selected === undefined"
            >
              <option value="writer">Schreibt — verfasst Beiträge</option>
              <option value="reader">Liest — liest mit und kommentiert</option>
              <option value="administrator">Admin — verwaltet Mitglieder</option>
            </select>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isPending || selected === undefined">
            <Spinner v-if="isPending" />
            Mitglied einladen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * Banning is an operator stopping an account for the whole platform, which is a different act
 * from one member blocking another — so the copy says what it costs and asks for a reason. The
 * reason is a note for operators and is never shown to the banned member; what they read at
 * sign-in is one fixed sentence.
 */
import { ref, watch } from 'vue'
import { getGetUserQueryKey, getListUsersQueryKey, useBanUser } from '@/api/users/users'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { TEXT_LIMIT } from '@/api/textLimit'
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
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ userId: string; username: string }>()
const emit = defineEmits<{ banned: [] }>()

const { mutateAsync: ban, isPending } = useBanUser()
const reason = ref<string>('')
const error = ref<string | undefined>(undefined)

watch(open, () => {
  reason.value = ''
  error.value = undefined
})

async function confirm() {
  error.value = undefined

  if (reason.value.trim() === '') {
    error.value = 'Gib einen Grund an.'
    return
  }

  try {
    await ban({ userId: props.userId, data: { reason: reason.value.trim() } })
  } catch (caught) {
    // The one refusal worth naming: an operator cannot be banned until the role is revoked.
    error.value =
      caught instanceof ApiError && caught.status === 403
        ? 'Konten mit einer Plattformrolle können nicht gesperrt werden.'
        : 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(props.userId) })
  await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListUsersQueryKey()) })
  open.value = false
  emit('banned')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>„{{ props.username }}“ sperren?</DialogTitle>
        <DialogDescription>
          Das Konto kann sich nicht mehr anmelden, und alle offenen Sitzungen enden sofort.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 text-note text-ink-4">
        <Alert v-if="error" variant="destructive" role="alert">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <p>
          Geschriebenes bleibt stehen, und die Adresse bleibt belegt — mit ihr lässt sich kein neues
          Konto anlegen. Die Sperre lässt sich wieder aufheben.
        </p>

        <FieldGroup>
          <Field>
            <FieldLabel for="banReason">Grund</FieldLabel>
            <Input
              id="banReason"
              v-model="reason"
              name="banReason"
              :maxlength="TEXT_LIMIT.banUser.reason.maxLength"
              autocomplete="off"
            />
            <p class="text-control text-ink-5">
              Nur für andere Moderatorinnen und Moderatoren. Das gesperrte Konto sieht ihn nicht.
            </p>
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
          Abbrechen
        </Button>
        <!-- Solid, not destructive: the design system reserves that fill for acts that destroy
             writing and cannot be undone by repeating them. A ban destroys nothing and lifts. -->
        <Button type="button" :disabled="isPending" @click="confirm">
          <Spinner v-if="isPending" />
          Konto sperren
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

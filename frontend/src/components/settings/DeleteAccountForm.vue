<script setup lang="ts">
/**
 * Asking for the deletion link: the password field, the red button, and what to do with a
 * wrong password. Shared because a member reaches this from two places — the settings dialog,
 * and the verification wall, which is the only page an unverified account can open at all.
 *
 * The surrounding explanation is slotted rather than built in: the wall knows the account is
 * in no group yet, and says so, where the dialog has to account for a member's writing.
 */
import { ref } from 'vue'
import { useRequestAccountDeletion } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { ApiError } from '@/lib/api/apiFetch'
import { type FieldMessages, fieldMessage } from '@/lib/validation/fieldMessage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const emit = defineEmits<{ requested: [] }>()

const { mutateAsync: requestDeletion, isPending } = useRequestAccountDeletion()

const LIMIT = TEXT_LIMIT.requestAccountDeletion

const FIELD_MESSAGES: FieldMessages = {
  missing: 'Gib dein aktuelles Passwort ein.',
  malformed: 'Gib dein aktuelles Passwort ein.',
  tooLong: `Das Passwort darf höchstens ${formatCount(LIMIT.password.maxLength)} Zeichen lang sein.`,
}

const password = ref<string>('')
const fieldError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

function validate(): boolean {
  const form = formElement.value
  if (form === null) {
    return false
  }

  const input = form.elements.namedItem('deletionPassword')
  const invalid = input instanceof HTMLInputElement && !input.validity.valid

  fieldError.value = invalid ? fieldMessage(FIELD_MESSAGES, input.validity) : undefined
  return !invalid
}

async function submit() {
  formError.value = undefined

  if (!validate()) {
    return
  }

  try {
    await requestDeletion({ data: { password: password.value } })
  } catch (error) {
    // An answer, not a lost session — `EXPECTED_401_MUTATIONS` keeps the global handler off it.
    if (error instanceof ApiError && error.status === 401) {
      fieldError.value = 'Das Passwort ist nicht korrekt.'
      return
    }
    formError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  password.value = ''
  emit('requested')
}
</script>

<template>
  <form ref="formElement" class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <div class="flex flex-col gap-3 text-[13px] leading-[1.6] text-ink-5">
      <slot />
    </div>

    <Alert v-if="formError" variant="destructive" role="alert">
      <AlertDescription>{{ formError }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <Field :data-invalid="fieldError !== undefined ? true : undefined">
        <FieldLabel for="deletionPassword">Aktuelles Passwort</FieldLabel>
        <Input
          id="deletionPassword"
          v-model="password"
          class="h-11 md:h-9"
          name="deletionPassword"
          type="password"
          :maxlength="LIMIT.password.maxLength"
          autocomplete="current-password"
          required
          :aria-invalid="fieldError !== undefined ? true : undefined"
        />
        <FieldError :errors="[fieldError]" />
      </Field>
    </FieldGroup>

    <div class="flex flex-col gap-3">
      <Button type="submit" variant="destructive" class="h-11 md:h-9" :disabled="isPending">
        <Spinner v-if="isPending" data-icon="inline-start" />
        Löschen-Link anfordern
      </Button>
      <slot name="cancel" />
    </div>
  </form>
</template>

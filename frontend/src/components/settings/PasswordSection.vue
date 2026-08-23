<script setup lang="ts">
/**
 * Changing a password while signed in. This session survives and every other one ends, so
 * nobody is thrown out of the tab they are working in for practising good hygiene.
 */
import { ref } from 'vue'
import { useChangePassword } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { ApiError } from '@/lib/api/apiFetch'
import type { FieldMessages } from '@/lib/validation/fieldMessage'
import { fieldMessage, PASSWORDS_DIFFER } from '@/lib/validation/fieldMessage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type PasswordFieldName = 'currentPassword' | 'newPassword' | 'newPasswordConfirmation'

const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangePassword()

const currentPassword = ref<string>('')
const newPassword = ref<string>('')
const newPasswordConfirmation = ref<string>('')
const passwordErrors = ref<Partial<Record<PasswordFieldName, string>>>({})
const passwordFormError = ref<string | undefined>(undefined)
const passwordChanged = ref<boolean>(false)

const PASSWORD_LIMIT = TEXT_LIMIT.changePassword
const PASSWORD_FIELD_NAMES = ['currentPassword', 'newPassword', 'newPasswordConfirmation'] as const

const tooLong = `Das Passwort darf höchstens ${formatCount(PASSWORD_LIMIT.newPassword.maxLength)} Zeichen lang sein.`

const PASSWORD_FIELD_MESSAGES: Record<PasswordFieldName, FieldMessages> = {
  currentPassword: {
    missing: 'Gib dein aktuelles Passwort ein.',
    malformed: 'Gib dein aktuelles Passwort ein.',
    tooLong,
  },
  newPassword: {
    missing: 'Wähle ein neues Passwort.',
    malformed: 'Wähle ein neues Passwort.',
    tooLong,
  },
  newPasswordConfirmation: {
    missing: 'Wiederhole dein neues Passwort.',
    malformed: 'Wiederhole dein neues Passwort.',
    tooLong,
  },
}

const passwordFormElement = ref<HTMLFormElement | null>(null)

function validatePasswordForm(): boolean {
  const form = passwordFormElement.value
  if (form === null) {
    return false
  }

  const errors: Partial<Record<PasswordFieldName, string>> = {}

  for (const name of PASSWORD_FIELD_NAMES) {
    const input = form.elements.namedItem(name)
    if (input instanceof HTMLInputElement && !input.validity.valid) {
      errors[name] = fieldMessage(PASSWORD_FIELD_MESSAGES[name], input.validity)
    }
  }

  if (
    errors.newPasswordConfirmation === undefined &&
    newPasswordConfirmation.value !== newPassword.value
  ) {
    errors.newPasswordConfirmation = PASSWORDS_DIFFER
  }

  passwordErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submitPassword() {
  passwordFormError.value = undefined
  passwordChanged.value = false

  if (!validatePasswordForm()) {
    return
  }

  try {
    await changePassword({
      data: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      passwordErrors.value = { currentPassword: 'Das Passwort ist nicht korrekt.' }
      return
    }
    passwordFormError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  currentPassword.value = ''
  newPassword.value = ''
  newPasswordConfirmation.value = ''
  passwordChanged.value = true
}
</script>

<template>
  <p v-if="passwordChanged" class="mb-4 text-[13px] leading-[1.6] text-ink-5">
    Dein neues Passwort ist gespeichert. Auf allen anderen Geräten wurdest du abgemeldet.
  </p>

  <form
    ref="passwordFormElement"
    class="flex flex-col gap-4"
    novalidate
    @submit.prevent="submitPassword"
  >
    <Alert v-if="passwordFormError" variant="destructive" role="alert">
      <AlertDescription>{{ passwordFormError }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <Field :data-invalid="passwordErrors.currentPassword !== undefined ? true : undefined">
        <FieldLabel for="settingsCurrentPassword">Aktuelles Passwort</FieldLabel>
        <Input
          id="settingsCurrentPassword"
          v-model="currentPassword"
          name="currentPassword"
          type="password"
          :maxlength="PASSWORD_LIMIT.currentPassword.maxLength"
          autocomplete="current-password"
          required
          :aria-invalid="passwordErrors.currentPassword !== undefined ? true : undefined"
        />
        <FieldError :errors="[passwordErrors.currentPassword]" />
      </Field>

      <Field :data-invalid="passwordErrors.newPassword !== undefined ? true : undefined">
        <FieldLabel for="settingsNewPassword">Neues Passwort</FieldLabel>
        <Input
          id="settingsNewPassword"
          v-model="newPassword"
          name="newPassword"
          type="password"
          :maxlength="PASSWORD_LIMIT.newPassword.maxLength"
          autocomplete="new-password"
          required
          :aria-invalid="passwordErrors.newPassword !== undefined ? true : undefined"
        />
        <FieldError :errors="[passwordErrors.newPassword]" />
      </Field>

      <Field
        :data-invalid="passwordErrors.newPasswordConfirmation !== undefined ? true : undefined"
      >
        <FieldLabel for="settingsNewPasswordRepeat"> Neues Passwort wiederholen </FieldLabel>
        <Input
          id="settingsNewPasswordRepeat"
          v-model="newPasswordConfirmation"
          name="newPasswordConfirmation"
          type="password"
          :maxlength="PASSWORD_LIMIT.newPassword.maxLength"
          autocomplete="new-password"
          required
          :aria-invalid="passwordErrors.newPasswordConfirmation !== undefined ? true : undefined"
        />
        <FieldError :errors="[passwordErrors.newPasswordConfirmation]" />
      </Field>
    </FieldGroup>

    <Button type="submit" :disabled="isChangingPassword">
      <Spinner v-if="isChangingPassword" data-icon="inline-start" />
      Passwort ändern
    </Button>
  </form>
</template>

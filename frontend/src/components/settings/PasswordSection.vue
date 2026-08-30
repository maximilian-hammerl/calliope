<script setup lang="ts">
/**
 * Changing a password while signed in. This session survives and every other one ends, so
 * nobody is thrown out of the tab they are working in for practising good hygiene.
 */
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useChangePassword } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage, PASSWORD_BREACHED_MESSAGE } from '@/lib/format/failure'
import {
  focusFirstInvalid,
  passwordRepeatMessage,
  passwordSchema,
} from '@/lib/validation/fieldSchemas'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangePassword()

const passwordFormError = ref<string | undefined>(undefined)
const passwordChanged = ref<boolean>(false)

const PASSWORD_LIMIT = TEXT_LIMIT.changePassword
const CURRENT = passwordSchema(PASSWORD_LIMIT.currentPassword, 'Gib dein aktuelles Passwort ein.')
const NEW = passwordSchema(PASSWORD_LIMIT.newPassword, 'Wähle ein neues Passwort.')
const REPEAT = passwordSchema(PASSWORD_LIMIT.newPassword, 'Wiederhole dein neues Passwort.')

const formElement = ref<HTMLFormElement | null>(null)

const passwordForm = useForm({
  defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirmation: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    passwordFormError.value = undefined
    passwordChanged.value = false

    try {
      await changePassword({
        data: { currentPassword: value.currentPassword, newPassword: value.newPassword },
      })
    } catch (error) {
      if (error instanceof ApiError && error.body.code === 'password_breached') {
        passwordForm.setFieldMeta('newPassword', (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: PASSWORD_BREACHED_MESSAGE },
        }))
        return
      }
      // An answer rather than a lost session, and about the password that was typed — so it is
      // said on that field.
      if (error instanceof ApiError && error.status === 401) {
        passwordForm.setFieldMeta('currentPassword', (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: 'Das Passwort ist nicht korrekt.' },
        }))
        return
      }
      passwordFormError.value = failureMessage(error)
      return
    }

    passwordForm.reset()
    passwordChanged.value = true
  },
})
</script>

<template>
  <p v-if="passwordChanged" class="mb-4 text-row text-ink-5">
    Dein neues Passwort ist gespeichert. Auf allen anderen Geräten wurdest du abgemeldet.
  </p>

  <form
    ref="formElement"
    class="flex flex-col gap-4"
    novalidate
    @submit.prevent="passwordForm.handleSubmit()"
  >
    <Alert v-if="passwordFormError" variant="destructive" role="alert">
      <AlertDescription>{{ passwordFormError }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <passwordForm.Field name="currentPassword" :validators="{ onSubmit: CURRENT }">
        <template v-slot="{ field }">
          <FormTextField
            :field="field"
            label="Aktuelles Passwort"
            type="password"
            :maxlength="PASSWORD_LIMIT.currentPassword.maxLength"
            autocomplete="current-password"
          />
        </template>
      </passwordForm.Field>

      <passwordForm.Field name="newPassword" :validators="{ onSubmit: NEW }">
        <template v-slot="{ field }">
          <FormTextField
            :field="field"
            label="Neues Passwort"
            type="password"
            :maxlength="PASSWORD_LIMIT.newPassword.maxLength"
            autocomplete="new-password"
          />
        </template>
      </passwordForm.Field>

      <passwordForm.Field
        name="newPasswordConfirmation"
        :validators="{
          onSubmit: ({ value, fieldApi }) =>
            passwordRepeatMessage(REPEAT, value, fieldApi.form.getFieldValue('newPassword')),
        }"
      >
        <template v-slot="{ field }">
          <FormTextField
            :field="field"
            label="Neues Passwort wiederholen"
            type="password"
            :maxlength="PASSWORD_LIMIT.newPassword.maxLength"
            autocomplete="new-password"
          />
        </template>
      </passwordForm.Field>
    </FieldGroup>

    <Button type="submit" :disabled="isChangingPassword">
      <Spinner v-if="isChangingPassword" />
      Passwort ändern
    </Button>
  </form>
</template>

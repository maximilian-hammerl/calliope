<script setup lang="ts">
/**
 * Moving a verified address. Nothing changes on submit: a link goes to the new address and
 * the old one keeps the account until that link is opened.
 */
import MailedLinkNote from '@/components/common/MailedLinkNote.vue'
import { computed, ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useRequestEmailAddressChange,
} from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { queryClient } from '@/lib/api/queryClient'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import {
  emailAddressSchema,
  focusFirstInvalid,
  parsed,
  passwordSchema,
} from '@/lib/validation/fieldSchemas'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const { data: currentUser } = useGetCurrentUser()
const currentAddress = computed<string>(() =>
  currentUser.value?.status === 200 ? currentUser.value.data.emailAddress : '',
)

const { mutateAsync: requestChange, isPending } = useRequestEmailAddressChange()

const formError = ref<string | undefined>(undefined)
const requestedFor = ref<string | undefined>(undefined)

const LIMIT = TEXT_LIMIT.requestEmailAddressChange
const NEW_ADDRESS = emailAddressSchema(LIMIT.emailAddress, 'Gib eine E-Mail-Adresse ein.')
const PASSWORD = passwordSchema(LIMIT.password, 'Gib dein aktuelles Passwort ein.')

/** Both of these are about what was typed, so each is said on its own field. */
function setFieldError(field: 'emailAddress' | 'password', message: string) {
  form.setFieldMeta(field, (meta) => ({
    ...meta,
    errorMap: { ...meta.errorMap, onServer: message },
  }))
}

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { emailAddress: '', password: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined
    requestedFor.value = undefined

    try {
      await requestChange({
        data: { emailAddress: parsed(NEW_ADDRESS, value.emailAddress), password: value.password },
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setFieldError('password', 'Das Passwort ist nicht korrekt.')
          return
        }
        if (error.status === 409) {
          setFieldError('emailAddress', 'Diese E-Mail-Adresse wird bereits verwendet.')
          return
        }
      }
      formError.value = failureMessage(error)
      return
    }

    await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
    requestedFor.value = parsed(NEW_ADDRESS, value.emailAddress)
    form.reset()
  },
})
</script>

<template>
  <p class="mb-4 text-row text-ink-5">
    Aktuell: <span class="text-ink-2">{{ currentAddress }}</span>
  </p>

  <template v-if="requestedFor">
    <p class="text-row text-ink-5">
      Wir haben einen Link an <span class="text-ink-2">{{ requestedFor }}</span> geschickt. Bis du
      ihn öffnest, bleibt deine bisherige Adresse in Kraft. An sie ist ebenfalls eine Nachricht
      unterwegs.
    </p>
    <MailedLinkNote class="mb-4 text-[13px]" />
  </template>

  <form
    ref="formElement"
    class="flex flex-col gap-4"
    novalidate
    @submit.prevent="form.handleSubmit()"
  >
    <Alert v-if="formError" variant="destructive" role="alert">
      <AlertDescription>{{ formError }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <form.Field name="emailAddress" :validators="{ onSubmit: NEW_ADDRESS }">
        <template v-slot="{ field }">
          <FormTextField
            :field="field"
            label="Neue E-Mail-Adresse"
            type="email"
            :maxlength="LIMIT.emailAddress.maxLength"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
          />
        </template>
      </form.Field>

      <form.Field name="password" :validators="{ onSubmit: PASSWORD }">
        <template v-slot="{ field }">
          <FormTextField
            :field="field"
            label="Aktuelles Passwort"
            type="password"
            :maxlength="LIMIT.password.maxLength"
            autocomplete="current-password"
          />
        </template>
      </form.Field>
    </FieldGroup>

    <Button type="submit" :disabled="isPending">
      <Spinner v-if="isPending" />
      Link an neue Adresse senden
    </Button>
  </form>
</template>

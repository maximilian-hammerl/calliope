<script setup lang="ts">
/**
 * Moving a verified address. Nothing changes on submit: a link goes to the new address and
 * the old one keeps the account until that link is opened.
 */
import MailedLinkNote from '@/components/common/MailedLinkNote.vue'
import { computed, ref } from 'vue'
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useRequestEmailAddressChange,
} from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { queryClient } from '@/lib/api/queryClient'
import { ApiError } from '@/lib/api/apiFetch'
import type { FieldMessages } from '@/lib/validation/fieldMessage'
import { fieldMessage } from '@/lib/validation/fieldMessage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const { data: currentUser } = useGetCurrentUser()
const currentAddress = computed<string>(() =>
  currentUser.value?.status === 200 ? currentUser.value.data.emailAddress : '',
)

const { mutateAsync: requestChange, isPending } = useRequestEmailAddressChange()

type FieldName = 'emailAddress' | 'password'

const newAddress = ref<string>('')
const password = ref<string>('')
const fieldErrors = ref<Partial<Record<FieldName, string>>>({})
const formError = ref<string | undefined>(undefined)
const requestedFor = ref<string | undefined>(undefined)

const LIMIT = TEXT_LIMIT.requestEmailAddressChange
const FIELD_NAMES = ['emailAddress', 'password'] as const

const FIELD_MESSAGES: Record<FieldName, FieldMessages> = {
  emailAddress: {
    missing: 'Gib eine E-Mail-Adresse ein.',
    malformed: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    tooLong: `Die E-Mail-Adresse darf höchstens ${formatCount(LIMIT.emailAddress.maxLength)} Zeichen lang sein.`,
  },
  password: {
    missing: 'Gib dein aktuelles Passwort ein.',
    malformed: 'Gib dein aktuelles Passwort ein.',
    tooLong: `Das Passwort darf höchstens ${formatCount(LIMIT.password.maxLength)} Zeichen lang sein.`,
  },
}

const formElement = ref<HTMLFormElement | null>(null)

function validate(): boolean {
  const form = formElement.value
  if (form === null) {
    return false
  }

  const errors: Partial<Record<FieldName, string>> = {}

  for (const name of FIELD_NAMES) {
    const input = form.elements.namedItem(name)
    if (input instanceof HTMLInputElement && !input.validity.valid) {
      errors[name] = fieldMessage(FIELD_MESSAGES[name], input.validity)
    }
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit() {
  formError.value = undefined
  requestedFor.value = undefined

  if (!validate()) {
    return
  }

  const requested = newAddress.value.trim()

  try {
    await requestChange({ data: { emailAddress: requested, password: password.value } })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        fieldErrors.value = { password: 'Das Passwort ist nicht korrekt.' }
        return
      }
      if (error.status === 409) {
        fieldErrors.value = { emailAddress: 'Diese E-Mail-Adresse wird bereits verwendet.' }
        return
      }
      if (error.status === 400) {
        fieldErrors.value = { emailAddress: FIELD_MESSAGES.emailAddress.malformed }
        return
      }
    }
    formError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
  requestedFor.value = requested
  newAddress.value = ''
  password.value = ''
}
</script>

<template>
  <p class="mb-4 text-[13px] leading-[1.6] text-ink-5">
    Aktuell: <span class="text-ink-8">{{ currentAddress }}</span>
  </p>

  <template v-if="requestedFor">
    <p class="text-[13px] leading-[1.6] text-ink-5">
      Wir haben einen Link an <span class="text-ink-8">{{ requestedFor }}</span> geschickt. Bis du
      ihn öffnest, bleibt deine bisherige Adresse in Kraft. An sie ist ebenfalls eine Nachricht
      unterwegs.
    </p>
    <MailedLinkNote class="mb-4 text-[13px]" />
  </template>

  <form ref="formElement" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <Alert v-if="formError" variant="destructive" role="alert">
      <AlertDescription>{{ formError }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <Field :data-invalid="fieldErrors.emailAddress !== undefined ? true : undefined">
        <FieldLabel for="newEmailAddress">Neue E-Mail-Adresse</FieldLabel>
        <Input
          id="newEmailAddress"
          v-model="newAddress"
          class="h-11 md:h-9"
          name="emailAddress"
          type="email"
          :maxlength="LIMIT.emailAddress.maxLength"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          required
          :aria-invalid="fieldErrors.emailAddress !== undefined ? true : undefined"
        />
        <FieldError :errors="[fieldErrors.emailAddress]" />
      </Field>

      <Field :data-invalid="fieldErrors.password !== undefined ? true : undefined">
        <FieldLabel for="currentPassword">Aktuelles Passwort</FieldLabel>
        <Input
          id="currentPassword"
          v-model="password"
          class="h-11 md:h-9"
          name="password"
          type="password"
          :maxlength="LIMIT.password.maxLength"
          autocomplete="current-password"
          required
          :aria-invalid="fieldErrors.password !== undefined ? true : undefined"
        />
        <FieldError :errors="[fieldErrors.password]" />
      </Field>
    </FieldGroup>

    <Button type="submit" class="h-11 md:h-9" :disabled="isPending">
      <Spinner v-if="isPending" data-icon="inline-start" />
      Link an neue Adresse senden
    </Button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useResetPassword } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { ApiError } from '@/lib/api/apiFetch'
import { type FieldMessages, fieldMessage, PASSWORDS_DIFFER } from '@/lib/validation/fieldMessage'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type FieldName = 'password' | 'passwordConfirmation'

const route = useRoute()

const token = typeof route.query.token === 'string' ? route.query.token : undefined

/**
 * A link with no token is as unusable as a spent one, so both land in the same state rather
 * than showing a form that cannot succeed.
 */
const status = ref<'form' | 'done' | 'expired'>(token === undefined ? 'expired' : 'form')

const password = ref<string>('')
const passwordConfirmation = ref<string>('')

const fieldErrors = ref<Partial<Record<FieldName, string>>>({})
const formError = ref<string | undefined>(undefined)

const { mutateAsync: setPassword, isPending } = useResetPassword()

const LIMIT = TEXT_LIMIT.resetPassword

const FIELD_NAMES = ['password', 'passwordConfirmation'] as const

const FIELD_MESSAGES: Record<FieldName, FieldMessages> = {
  password: {
    missing: 'Gib ein neues Passwort ein.',
    malformed: 'Gib ein neues Passwort ein.',
    tooLong: `Das Passwort darf höchstens ${formatCount(LIMIT.password.maxLength)} Zeichen lang sein.`,
  },
  passwordConfirmation: {
    missing: 'Wiederhole dein neues Passwort.',
    malformed: 'Wiederhole dein neues Passwort.',
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

  // After the native rules, so an empty repeat reads as missing rather than as not matching.
  // Only the repeat is marked: the password itself is not wrong, the second field disagrees.
  if (errors.passwordConfirmation === undefined && passwordConfirmation.value !== password.value) {
    errors.passwordConfirmation = PASSWORDS_DIFFER
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit() {
  formError.value = undefined

  if (token === undefined || !validate()) {
    return
  }

  try {
    // Not trimmed: a password may legitimately begin or end with a space.
    await setPassword({ data: { token, password: password.value } })
  } catch (error) {
    if (error instanceof ApiError) {
      // The one answer the API gives for spent, expired and unknown alike.
      if (error.status === 410) {
        status.value = 'expired'
        return
      }
      if (error.status === 400) {
        fieldErrors.value = { password: FIELD_MESSAGES.password.malformed }
        return
      }
      if (error.status === 429) {
        formError.value = 'Zu viele Versuche. Versuche es in einigen Minuten noch einmal.'
        return
      }
    }
    formError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  // Every session ended with the reset, including this browser's if it had one. The guard
  // reads the session from the cache, so the stale answer has to go or it would send a
  // signed-in visitor home instead of to the sign-in page.
  forgetCurrentUser()
  password.value = ''
  passwordConfirmation.value = ''
  status.value = 'done'
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-[25px] leading-[1.2]">
          {{ status === 'done' ? 'Passwort geändert' : 'Neues Passwort' }}
        </h1>
        <p v-if="status === 'form'" class="text-[13.5px] leading-[1.5] text-ink-5">
          Vergib ein neues Passwort für dein Konto.
        </p>
      </div>

      <template v-if="status === 'done'">
        <div class="mt-5 flex flex-col gap-3 text-[13.5px] leading-[1.6] text-ink-5">
          <p>
            Dein neues Passwort ist gespeichert. Du wurdest auf allen Geräten abgemeldet und kannst
            dich jetzt neu anmelden.
          </p>
        </div>

        <Button as-child class="mt-7 h-11 w-full md:h-9">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>

      <template v-else-if="status === 'expired'">
        <div class="mt-5 flex flex-col gap-3 text-[13.5px] leading-[1.6] text-ink-5">
          <p>
            Dieser Link lässt sich nicht mehr verwenden. Links gelten nur kurze Zeit und nur ein
            einziges Mal.
          </p>
          <p>Fordere einen neuen an, dein Passwort ist unverändert geblieben.</p>
        </div>

        <div class="mt-7 flex flex-col gap-3">
          <Button as-child class="h-11 md:h-9">
            <RouterLink :to="{ name: 'forgotPassword' }">Neuen Link anfordern</RouterLink>
          </Button>
          <Button as-child variant="ghost" class="h-11 md:h-9">
            <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
          </Button>
        </div>
      </template>

      <template v-else>
        <form
          ref="formElement"
          class="mt-7 flex flex-col gap-5"
          novalidate
          @submit.prevent="submit"
        >
          <Alert v-if="formError" variant="destructive" role="alert">
            <AlertDescription>{{ formError }}</AlertDescription>
          </Alert>

          <FieldGroup>
            <Field :data-invalid="fieldErrors.password !== undefined ? true : undefined">
              <FieldLabel for="password">Neues Passwort</FieldLabel>
              <Input
                id="password"
                v-model="password"
                class="h-11 md:h-9"
                name="password"
                type="password"
                :maxlength="LIMIT.password.maxLength"
                autocomplete="new-password"
                required
                :aria-invalid="fieldErrors.password !== undefined ? true : undefined"
              />
              <FieldError :errors="[fieldErrors.password]" />
            </Field>

            <Field
              :data-invalid="fieldErrors.passwordConfirmation !== undefined ? true : undefined"
            >
              <FieldLabel for="passwordConfirmation">Neues Passwort wiederholen</FieldLabel>
              <Input
                id="passwordConfirmation"
                v-model="passwordConfirmation"
                class="h-11 md:h-9"
                name="passwordConfirmation"
                type="password"
                :maxlength="LIMIT.password.maxLength"
                autocomplete="new-password"
                required
                :aria-invalid="fieldErrors.passwordConfirmation !== undefined ? true : undefined"
              />
              <FieldError :errors="[fieldErrors.passwordConfirmation]" />
            </Field>
          </FieldGroup>

          <Button type="submit" class="h-11 md:h-9" :disabled="isPending">
            <Spinner v-if="isPending" data-icon="inline-start" />
            Passwort speichern
          </Button>
        </form>
      </template>
    </div>
  </main>
</template>

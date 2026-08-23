<script setup lang="ts">
import { ref } from 'vue'
import { useRequestPasswordReset } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { ApiError } from '@/lib/api/apiFetch'
import type { FieldMessages } from '@/lib/validation/fieldMessage'
import { fieldMessage } from '@/lib/validation/fieldMessage'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import MailedLinkNote from '@/components/common/MailedLinkNote.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const login = ref<string>('')

const fieldErrors = ref<{ login?: string }>({})
const formError = ref<string | undefined>(undefined)
const requested = ref<boolean>(false)

const { mutateAsync: requestReset, isPending } = useRequestPasswordReset()

const LIMIT = TEXT_LIMIT.requestPasswordReset

const FIELD_MESSAGES: Record<'login', FieldMessages> = {
  login: {
    missing: 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.',
    malformed: 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.',
    tooLong: `Das darf höchstens ${formatCount(LIMIT.login.maxLength)} Zeichen lang sein.`,
  },
}

const formElement = ref<HTMLFormElement | null>(null)

function validate(): boolean {
  const form = formElement.value
  if (form === null) {
    return false
  }

  const input = form.elements.namedItem('login')
  if (input instanceof HTMLInputElement && !input.validity.valid) {
    fieldErrors.value = { login: fieldMessage(FIELD_MESSAGES.login, input.validity) }
    return false
  }

  fieldErrors.value = {}
  return true
}

async function submit() {
  formError.value = undefined

  if (!validate()) {
    return
  }

  try {
    await requestReset({ data: { login: login.value.trim() } })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        fieldErrors.value = { login: FIELD_MESSAGES.login.malformed }
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

  requested.value = true
}

/** Lets someone who mistyped correct it without navigating away and losing the page. */
function startOver() {
  requested.value = false
  login.value = ''
  fieldErrors.value = {}
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">Passwort vergessen</h1>
        <p v-if="!requested" class="text-note text-ink-5">
          Wir schicken dir einen Link, mit dem du ein neues Passwort vergeben kannst.
        </p>
      </div>

      <!--
        Deliberately says "wenn es ein Konto gibt" rather than confirming one: the API answers
        the same way either way, and a page that said "Link verschickt" would give away who is
        registered.
      -->
      <template v-if="requested">
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Wenn es ein Konto mit diesen Angaben gibt, ist ein Link an die hinterlegte
            E-Mail-Adresse unterwegs. Sieh in deinem Postfach nach.
          </p>
          <MailedLinkNote class="text-[13.5px]" />
        </div>

        <div class="mt-7 flex flex-col gap-3">
          <Button as-child>
            <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
          </Button>
          <Button variant="ghost" @click="startOver"> Andere Angaben verwenden </Button>
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
            <Field :data-invalid="fieldErrors.login !== undefined ? true : undefined">
              <FieldLabel for="login">Benutzername oder E-Mail-Adresse</FieldLabel>
              <Input
                id="login"
                v-model="login"
                name="login"
                pattern=".*\S.*"
                :maxlength="LIMIT.login.maxLength"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                required
                :aria-invalid="fieldErrors.login !== undefined ? true : undefined"
              />
              <FieldError :errors="[fieldErrors.login]" />
            </Field>
          </FieldGroup>

          <Button type="submit" :disabled="isPending">
            <Spinner v-if="isPending" data-icon="inline-start" />
            Link anfordern
          </Button>
        </form>

        <p class="mt-6 text-[13px] leading-[1.5] text-ink-5">
          Doch wieder eingefallen?
          <RouterLink :to="{ name: 'login' }" class="text-oak-deep underline underline-offset-2">
            Anmelden
          </RouterLink>
        </p>
      </template>
    </div>
  </main>
</template>

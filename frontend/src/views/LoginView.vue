<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUser } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { ApiError } from '@/lib/api/apiFetch'
import type { FieldMessages } from '@/lib/validation/fieldMessage'
import { fieldMessage } from '@/lib/validation/fieldMessage'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type FieldName = 'login' | 'password'

const route = useRoute()
const router = useRouter()

const login = ref<string>('')
const password = ref<string>('')

const fieldErrors = ref<Partial<Record<FieldName, string>>>({})
const formError = ref<string | undefined>(undefined)

const { mutateAsync: signIn, isPending } = useLoginUser()

const FIELD_NAMES = ['login', 'password'] as const

/** The API's own bounds, so the form cannot disagree with what the server will accept. */
const LIMIT = TEXT_LIMIT.loginUser

/**
 * The inputs' own `required`, `pattern` and `maxlength` decide what counts as invalid; this
 * only decides how it is phrased. The API reports the same failures but words them in
 * English, so its issues are mapped onto these too.
 */
const FIELD_MESSAGES: Record<FieldName, FieldMessages> = {
  login: {
    missing: 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.',
    malformed: 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.',
    tooLong: `Das darf höchstens ${formatCount(LIMIT.login.maxLength)} Zeichen lang sein.`,
  },
  password: {
    missing: 'Gib dein Passwort ein.',
    malformed: 'Gib dein Passwort ein.',
    tooLong: `Das Passwort darf höchstens ${formatCount(LIMIT.password.maxLength)} Zeichen lang sein.`,
  },
}

const formElement = ref<HTMLFormElement | null>(null)

/**
 * Reads the constraints already declared on the inputs rather than restating them. The form
 * carries `novalidate` so the browser shows no bubbles of its own — those appear one at a
 * time, in the browser's language rather than the page's, and cannot be styled.
 */
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

/** Returns whether every reported issue belonged to a field that is shown. */
function applyServerIssues(apiError: ApiError): boolean {
  const issues = apiError.body.issues ?? []
  if (issues.length === 0) {
    return false
  }

  const errors: Partial<Record<FieldName, string>> = {}
  for (const issue of issues) {
    if (!(issue.path in FIELD_MESSAGES)) {
      return false
    }
    const field = issue.path as FieldName
    errors[field] = FIELD_MESSAGES[field].malformed
  }

  fieldErrors.value = errors
  return true
}

async function submit() {
  formError.value = undefined

  if (!validate()) {
    return
  }

  try {
    // Only the identifier is trimmed: a password may legitimately begin or end with a space.
    await signIn({ data: { login: login.value.trim(), password: password.value } })
  } catch (error) {
    if (error instanceof ApiError) {
      // A rejected sign-in is an expected answer rather than a fault, and it cannot be
      // attributed to one field, so it stays a plain statement above the form.
      if (error.status === 401) {
        formError.value = 'Benutzername, E-Mail-Adresse oder Passwort ist nicht korrekt.'
        return
      }
      if (error.status === 400 && applyServerIssues(error)) {
        return
      }
      if (error.status === 429) {
        formError.value = 'Zu viele Anmeldeversuche. Versuche es in einigen Minuten noch einmal.'
        return
      }
    }
    formError.value = 'Die Anmeldung ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  // The guard reads the session from the cache, so the signed-out answer has to be dropped
  // before navigating or it would send us straight back here.
  forgetCurrentUser()

  const redirect = route.query.redirect
  await router.push(typeof redirect === 'string' ? redirect : { name: 'home' })
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-[25px] leading-[1.2]">Anmelden</h1>
        <p class="text-[13.5px] leading-[1.5] text-ink-5">Melde dich an, um weiterzuschreiben.</p>
      </div>

      <form ref="formElement" class="mt-7 flex flex-col gap-5" novalidate @submit.prevent="submit">
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

          <Field :data-invalid="fieldErrors.password !== undefined ? true : undefined">
            <FieldLabel for="password">Passwort</FieldLabel>
            <Input
              id="password"
              v-model="password"
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

        <Button type="submit" :disabled="isPending">
          <Spinner v-if="isPending" data-icon="inline-start" />
          Anmelden
        </Button>
      </form>

      <div class="mt-6 flex flex-col gap-2 text-[13px] leading-[1.5] text-ink-5">
        <p>
          <RouterLink
            :to="{ name: 'forgotPassword' }"
            class="text-oak-deep underline underline-offset-2"
          >
            Passwort vergessen?
          </RouterLink>
        </p>
        <p>
          Noch kein Konto?
          <RouterLink :to="{ name: 'register' }" class="text-oak-deep underline underline-offset-2">
            Konto erstellen
          </RouterLink>
        </p>
      </div>
    </div>
  </main>
</template>

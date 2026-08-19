<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRegisterUser } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { ApiError } from '@/lib/api/apiFetch'
import { type FieldMessages, fieldMessage, PASSWORDS_DIFFER } from '@/lib/validation/fieldMessage'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type FieldName = 'username' | 'emailAddress' | 'password' | 'passwordConfirmation'

const router = useRouter()

const username = ref<string>('')
const emailAddress = ref<string>('')
const password = ref<string>('')
const passwordConfirmation = ref<string>('')

const fieldErrors = ref<Partial<Record<FieldName, string>>>({})
const formError = ref<string | undefined>(undefined)

const { mutateAsync: signUp, isPending } = useRegisterUser()

const FIELD_NAMES = ['username', 'emailAddress', 'password', 'passwordConfirmation'] as const

/** The API's own bounds, so the form cannot disagree with what the server will accept. */
const LIMIT = TEXT_LIMIT.registerUser

/**
 * The inputs' own `required`, `type`, `pattern`, `minlength` and `maxlength` decide what
 * counts as invalid; this only decides how it is phrased. The API reports the same failures
 * but words them in English, so its issues are mapped onto these too.
 */
const FIELD_MESSAGES: Record<FieldName, FieldMessages> = {
  username: {
    // Whitespace-only trips `pattern`, which for a member is the same as leaving it empty.
    missing: 'Gib einen Benutzernamen ein.',
    malformed: 'Gib einen Benutzernamen ein.',
    tooShort: `Der Benutzername braucht mindestens ${formatCount(LIMIT.username.minLength)} Zeichen.`,
    tooLong: `Der Benutzername darf höchstens ${formatCount(LIMIT.username.maxLength)} Zeichen lang sein.`,
  },
  emailAddress: {
    missing: 'Gib eine E-Mail-Adresse ein.',
    malformed: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    tooLong: `Die E-Mail-Adresse darf höchstens ${formatCount(LIMIT.emailAddress.maxLength)} Zeichen lang sein.`,
  },
  password: {
    missing: 'Wähle ein Passwort.',
    malformed: 'Wähle ein Passwort.',
    tooLong: `Das Passwort darf höchstens ${formatCount(LIMIT.password.maxLength)} Zeichen lang sein.`,
  },
  passwordConfirmation: {
    missing: 'Wiederhole dein Passwort.',
    malformed: 'Wiederhole dein Passwort.',
    tooLong: `Das Passwort darf höchstens ${formatCount(LIMIT.password.maxLength)} Zeichen lang sein.`,
  },
}

const formElement = ref<HTMLFormElement | null>(null)

/**
 * Reads the constraints already declared on the inputs rather than restating them. The form
 * carries `novalidate` so the browser shows no bubbles of its own — those appear one at a
 * time, in the browser's language rather than the page's, and cannot be styled.
 *
 * `validity` is read instead of `checkValidity()` because the latter fires an `invalid`
 * event for every field.
 */
function validate(): boolean {
  const form = formElement.value
  if (form === null) {
    return false
  }

  const errors: Partial<Record<FieldName, string>> = {}

  for (const name of FIELD_NAMES) {
    const input = form.elements.namedItem(name)
    if (!(input instanceof HTMLInputElement) || input.validity.valid) {
      continue
    }
    errors[name] = fieldMessage(FIELD_MESSAGES[name], input.validity)
  }

  // After the native rules, so an empty repeat reads as missing rather than as not matching.
  // Only the repeat is marked: the password itself is not wrong, the second field disagrees.
  if (errors.passwordConfirmation === undefined && passwordConfirmation.value !== password.value) {
    errors.passwordConfirmation = PASSWORDS_DIFFER
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
    await signUp({
      data: {
        username: username.value.trim(),
        emailAddress: emailAddress.value.trim(),
        password: password.value,
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400 && applyServerIssues(error)) {
        return
      }
      if (error.status === 409) {
        // Which of the two collided is not disclosed, so neither is named here.
        formError.value = 'Benutzername oder E-Mail-Adresse ist bereits vergeben.'
        return
      }
      if (error.status === 429) {
        formError.value = 'Zu viele Versuche. Versuche es in einigen Minuten noch einmal.'
        return
      }
    }
    formError.value = 'Die Registrierung ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  // Registering already starts a session, so the cached signed-out answer has to go before
  // navigating or the guard would send us straight back here.
  forgetCurrentUser()
  await router.push({ name: 'home' })
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-[25px] leading-[1.2]">Konto erstellen</h1>
        <p class="text-[13.5px] leading-[1.5] text-ink-5">
          Leg ein Konto an, um einer Schreibgruppe beizutreten.
        </p>
      </div>

      <form ref="formElement" class="mt-7 flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field :data-invalid="fieldErrors.username !== undefined ? true : undefined">
            <FieldLabel for="username">Benutzername</FieldLabel>
            <Input
              id="username"
              v-model="username"
              class="h-11 md:h-9"
              name="username"
              pattern=".*\S.*"
              :minlength="LIMIT.username.minLength"
              :maxlength="LIMIT.username.maxLength"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
              :aria-invalid="fieldErrors.username !== undefined ? true : undefined"
            />
            <FieldDescription>
              Andere Mitglieder sehen deinen Benutzernamen und finden dich darüber. Wähle nichts,
              was privat bleiben soll.
            </FieldDescription>
            <FieldError :errors="[fieldErrors.username]" />
          </Field>

          <Field :data-invalid="fieldErrors.emailAddress !== undefined ? true : undefined">
            <FieldLabel for="emailAddress">E-Mail-Adresse</FieldLabel>
            <Input
              id="emailAddress"
              v-model="emailAddress"
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
            <FieldDescription>
              Deine E-Mail-Adresse sieht niemand außer dir. Sie wird weder anderen Mitgliedern
              angezeigt noch weitergegeben.
            </FieldDescription>
            <FieldError :errors="[fieldErrors.emailAddress]" />
          </Field>

          <Field :data-invalid="fieldErrors.password !== undefined ? true : undefined">
            <FieldLabel for="password">Passwort</FieldLabel>
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

          <Field :data-invalid="fieldErrors.passwordConfirmation !== undefined ? true : undefined">
            <FieldLabel for="passwordConfirmation">Passwort wiederholen</FieldLabel>
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
          Konto erstellen
        </Button>
      </form>

      <p class="mt-6 text-[13px] leading-[1.5] text-ink-5">
        Du hast schon ein Konto?
        <RouterLink :to="{ name: 'login' }" class="text-oak-deep underline underline-offset-2">
          Anmelden
        </RouterLink>
      </p>
    </div>
  </main>
</template>

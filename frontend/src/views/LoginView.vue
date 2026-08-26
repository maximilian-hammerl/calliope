<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUser } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
// From the generated client, so renaming the code in the backend breaks compilation
// here rather than quietly turning the message back into a generic failure.
import { LoginUser403Code } from '@/api/models'
import { focusFirstInvalid, loginSchema, passwordSchema } from '@/lib/validation/fieldSchemas'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import EnvironmentNotice from '@/components/common/EnvironmentNotice.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const route = useRoute()
const router = useRouter()

const formError = ref<string | undefined>(undefined)

const { mutateAsync: signIn, isPending } = useLoginUser()

/** The API's own bounds, so the form cannot disagree with what the server will accept. */
const LIMIT = TEXT_LIMIT.loginUser

// Rules and wording from `lib/validation/fieldSchemas`; only the empty-field wording is this
// form's own, because it names what is being asked for.
const LOGIN = loginSchema(LIMIT.login, 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.')
const PASSWORD = passwordSchema(LIMIT.password, 'Gib dein Passwort ein.')

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { login: '', password: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    try {
      await signIn({ data: { login: value.login, password: value.password } })
    } catch (error) {
      if (error instanceof ApiError) {
        // A rejected sign-in is an expected answer rather than a fault, and it cannot be
        // attributed to one field, so it stays a plain statement above the form.
        if (error.status === 401) {
          formError.value = 'Benutzername, E-Mail-Adresse oder Passwort ist nicht korrekt.'
          return
        }
        // Reached only with the right password, which is what makes saying so safe. Deliberately
        // without the operator's recorded reason: that note is written for operators.
        if (error.status === 403 && error.body.code === LoginUser403Code.account_banned) {
          formError.value =
            'Dieses Konto wurde gesperrt. Wende dich an uns, wenn du das für einen Fehler hältst.'
          return
        }
      }
      formError.value = failureMessage(
        error,
        'Die Anmeldung ist gerade nicht möglich. Versuche es später noch einmal.',
      )
      return
    }

    // The guard reads the session from the cache, so the signed-out answer has to be dropped
    // before navigating or it would send us straight back here.
    forgetCurrentUser()

    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : { name: 'home' })
  },
})
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">Anmelden</h1>
        <p class="text-note text-ink-5">Melde dich an, um weiterzuschreiben.</p>
      </div>

      <EnvironmentNotice class="mt-6" about-passwords />

      <form
        ref="formElement"
        class="mt-7 flex flex-col gap-5"
        novalidate
        @submit.prevent="form.handleSubmit()"
      >
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <form.Field name="login" :validators="{ onSubmit: LOGIN }">
            <template v-slot="{ field }">
              <FormTextField
                :field="field"
                id="login"
                label="Benutzername oder E-Mail-Adresse"
                :maxlength="LIMIT.login.maxLength"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
              />
            </template>
          </form.Field>

          <form.Field name="password" :validators="{ onSubmit: PASSWORD }">
            <template v-slot="{ field }">
              <FormTextField
                :field="field"
                id="password"
                label="Passwort"
                type="password"
                :maxlength="LIMIT.password.maxLength"
                autocomplete="current-password"
              />
            </template>
          </form.Field>
        </FieldGroup>

        <Button type="submit" :disabled="isPending">
          <Spinner v-if="isPending" />
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

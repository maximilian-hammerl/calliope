<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useRouter } from 'vue-router'
import { useRegisterUser } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage, PASSWORD_BREACHED_MESSAGE } from '@/lib/format/failure'
import {
  emailAddressSchema,
  focusFirstInvalid,
  parsed,
  passwordRepeatMessage,
  passwordSchema,
  usernameSchema,
} from '@/lib/validation/fieldSchemas'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import EnvironmentNotice from '@/components/common/EnvironmentNotice.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const router = useRouter()

const formError = ref<string | undefined>(undefined)

const { mutateAsync: signUp, isPending } = useRegisterUser()

/** The API's own bounds, so the form cannot disagree with what the server will accept. */
const LIMIT = TEXT_LIMIT.registerUser

// Each field's rules come from `lib/validation/fieldSchemas`; only the empty-field wording is this
// form's own, because it names what is being asked for.
const USERNAME = usernameSchema(LIMIT.username)
const EMAIL_ADDRESS = emailAddressSchema(LIMIT.emailAddress, 'Gib eine E-Mail-Adresse ein.')
const PASSWORD = passwordSchema(LIMIT.password, 'Wähle ein Passwort.')
const REPEAT = passwordSchema(LIMIT.password, 'Wiederhole dein Passwort.')

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: {
    username: '',
    emailAddress: '',
    password: '',
    passwordConfirmation: '',
  },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    try {
      await signUp({
        data: {
          username: parsed(USERNAME, value.username),
          emailAddress: parsed(EMAIL_ADDRESS, value.emailAddress),
          password: value.password,
        },
      })
    } catch (error) {
      if (error instanceof ApiError && error.body.code === 'password_breached') {
        form.setFieldMeta('password', (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: PASSWORD_BREACHED_MESSAGE },
        }))
        return
      }
      if (error instanceof ApiError) {
        if (error.status === 409) {
          // Which of the two collided is not disclosed, so neither is named here.
          formError.value = 'Benutzername oder E-Mail-Adresse ist bereits vergeben.'
          return
        }
      }
      formError.value = failureMessage(
        error,
        'Die Registrierung ist gerade nicht möglich. Versuche es später noch einmal.',
      )
      return
    }

    // Registering already starts a session, so the cached signed-out answer has to go before
    // navigating or the guard would send us straight back here.
    forgetCurrentUser()
    await router.push({ name: 'home' })
  },
})
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">Konto erstellen</h1>
        <p class="text-note text-ink-5">Leg ein Konto an, um einer Schreibgruppe beizutreten.</p>
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
          <form.Field name="username" :validators="{ onSubmit: USERNAME }">
            <template v-slot="{ field }">
              <FormTextField
                :field="field"
                label="Benutzername"
                :minlength="LIMIT.username.minLength"
                :maxlength="LIMIT.username.maxLength"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
              >
                <!-- The permanence gets its own sentence: it is the only part of this choice that
                     cannot be undone, and two testers have registered with their address. -->
                <template #description>
                  Andere Mitglieder sehen deinen Benutzernamen und finden dich darüber. Wähle
                  nichts, was privat bleiben soll.
                  <strong>Ändern lässt er sich später nicht.</strong>
                </template>
              </FormTextField>
            </template>
          </form.Field>

          <form.Field name="emailAddress" :validators="{ onSubmit: EMAIL_ADDRESS }">
            <template v-slot="{ field }">
              <FormTextField
                :field="field"
                label="E-Mail-Adresse"
                :maxlength="LIMIT.emailAddress.maxLength"
                type="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
              >
                <template #description>
                  Deine E-Mail-Adresse sieht niemand außer dir. Sie wird weder anderen Mitgliedern
                  angezeigt noch weitergegeben.
                </template>
              </FormTextField>
            </template>
          </form.Field>

          <form.Field name="password" :validators="{ onSubmit: PASSWORD }">
            <template v-slot="{ field }">
              <FormTextField
                :field="field"
                label="Passwort"
                :maxlength="LIMIT.password.maxLength"
                type="password"
                autocomplete="new-password"
              />
            </template>
          </form.Field>

          <form.Field
            name="passwordConfirmation"
            :validators="{
              onSubmit: ({ value, fieldApi }) =>
                passwordRepeatMessage(REPEAT, value, fieldApi.form.getFieldValue('password')),
            }"
          >
            <template v-slot="{ field }">
              <FormTextField
                :field="field"
                label="Passwort wiederholen"
                :maxlength="LIMIT.password.maxLength"
                type="password"
                autocomplete="new-password"
              />
            </template>
          </form.Field>
        </FieldGroup>

        <Button type="submit" :disabled="isPending">
          <Spinner v-if="isPending" />
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

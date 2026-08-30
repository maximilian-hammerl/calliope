<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useRoute } from 'vue-router'
import { useResetPassword } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage, PASSWORD_BREACHED_MESSAGE } from '@/lib/format/failure'
import {
  focusFirstInvalid,
  passwordRepeatMessage,
  passwordSchema,
} from '@/lib/validation/fieldSchemas'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const route = useRoute()

const token = typeof route.query.token === 'string' ? route.query.token : undefined

/**
 * A link with no token is as unusable as a spent one, so both land in the same state rather
 * than showing a form that cannot succeed.
 */
const status = ref<'form' | 'done' | 'expired'>(token === undefined ? 'expired' : 'form')

const formError = ref<string | undefined>(undefined)

const { mutateAsync: setPassword, isPending } = useResetPassword()

const LIMIT = TEXT_LIMIT.resetPassword

// Rules and wording from `lib/validation/fieldSchemas`; only the empty-field wording is this
// form's own, because it names what is being asked for.
const PASSWORD = passwordSchema(LIMIT.password, 'Gib ein neues Passwort ein.')
const REPEAT = passwordSchema(LIMIT.password, 'Wiederhole dein neues Passwort.')

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { password: '', passwordConfirmation: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    if (token === undefined) {
      return
    }

    try {
      // Not trimmed: a password may legitimately begin or end with a space.
      await setPassword({ data: { token, password: value.password } })
    } catch (error) {
      if (error instanceof ApiError && error.body.code === 'password_breached') {
        form.setFieldMeta('password', (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: PASSWORD_BREACHED_MESSAGE },
        }))
        return
      }
      if (error instanceof ApiError) {
        // The one answer the API gives for spent, expired and unknown alike.
        if (error.status === 410) {
          status.value = 'expired'
          return
        }
      }
      formError.value = failureMessage(error)
      return
    }

    // Every session ended with the reset, including this browser's if it had one. The guard
    // reads the session from the cache, so the stale answer has to go or it would send a
    // signed-in visitor home instead of to the sign-in page.
    forgetCurrentUser()
    form.reset()
    status.value = 'done'
  },
})
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">
          {{ status === 'done' ? 'Passwort geändert' : 'Neues Passwort' }}
        </h1>
        <p v-if="status === 'form'" class="text-note text-ink-5">
          Vergib ein neues Passwort für dein Konto.
        </p>
      </div>

      <template v-if="status === 'done'">
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Dein neues Passwort ist gespeichert. Du wurdest auf allen Geräten abgemeldet und kannst
            dich jetzt neu anmelden.
          </p>
        </div>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>

      <template v-else-if="status === 'expired'">
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Dieser Link lässt sich nicht mehr verwenden. Links gelten nur kurze Zeit und nur ein
            einziges Mal.
          </p>
          <p>Fordere einen neuen an, dein Passwort ist unverändert geblieben.</p>
        </div>

        <div class="mt-7 flex flex-col gap-3">
          <Button as-child>
            <RouterLink :to="{ name: 'forgotPassword' }">Neuen Link anfordern</RouterLink>
          </Button>
          <Button as-child variant="ghost">
            <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
          </Button>
        </div>
      </template>

      <template v-else>
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
            <form.Field name="password" :validators="{ onSubmit: PASSWORD }">
              <template v-slot="{ field }">
                <FormTextField
                  :field="field"
                  label="Neues Passwort"
                  type="password"
                  :maxlength="LIMIT.password.maxLength"
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
                  label="Neues Passwort wiederholen"
                  type="password"
                  :maxlength="LIMIT.password.maxLength"
                  autocomplete="new-password"
                />
              </template>
            </form.Field>
          </FieldGroup>

          <Button type="submit" :disabled="isPending">
            <Spinner v-if="isPending" />
            Passwort speichern
          </Button>
        </form>
      </template>
    </div>
  </main>
</template>

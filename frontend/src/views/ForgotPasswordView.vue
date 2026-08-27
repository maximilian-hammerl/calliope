<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useRequestPasswordReset } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, loginSchema, parsed } from '@/lib/validation/fieldSchemas'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import MailedLinkNote from '@/components/common/MailedLinkNote.vue'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const LIMIT = TEXT_LIMIT.requestPasswordReset

// Rules and wording from `lib/validation/fieldSchemas`; only the empty-field wording is this
// form's own, because it names what is being asked for.
const LOGIN = loginSchema(LIMIT.login, 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.')

const formError = ref<string | undefined>(undefined)
const requested = ref<boolean>(false)

const { mutateAsync: requestReset, isPending } = useRequestPasswordReset()

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { login: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    try {
      await requestReset({ data: { login: parsed(LOGIN, value.login) } })
    } catch (error) {
      if (error instanceof ApiError) {
      }
      formError.value = failureMessage(error)
      return
    }

    requested.value = true
  },
})

/** Lets someone who mistyped correct it without navigating away and losing the page. */
function startOver() {
  requested.value = false
  formError.value = undefined
  form.reset()
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
                  label="Benutzername oder E-Mail-Adresse"
                  :maxlength="LIMIT.login.maxLength"
                  autocomplete="username"
                  autocapitalize="none"
                  spellcheck="false"
                />
              </template>
            </form.Field>
          </FieldGroup>

          <Button type="submit" :disabled="isPending">
            <Spinner v-if="isPending" />
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

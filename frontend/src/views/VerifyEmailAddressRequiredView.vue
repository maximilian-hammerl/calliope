<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useRouter } from 'vue-router'
import {
  getGetCurrentUserQueryKey,
  useChangeEmailAddress,
  useGetCurrentUser,
  useLogoutUser,
  useResendEmailAddressVerification,
} from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { queryClient } from '@/lib/api/queryClient'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import { emailAddressSchema, focusFirstInvalid, parsed } from '@/lib/validation/fieldSchemas'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import MailedLinkNote from '@/components/common/MailedLinkNote.vue'
import DeleteAccountForm from '@/components/settings/DeleteAccountForm.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Pencil, Send, Trash2 } from '@lucide/vue'

const router = useRouter()

const { data: currentUser } = useGetCurrentUser()
const emailAddress = computed(() =>
  currentUser.value?.status === 200 ? currentUser.value.data.emailAddress : '',
)

const { mutateAsync: resend, isPending: isResending } = useResendEmailAddressVerification()
const { mutateAsync: changeAddress, isPending: isChanging } = useChangeEmailAddress()
const { mutateAsync: logOut } = useLogoutUser()

/**
 * One value rather than a boolean per branch: two flags could both be set, which would mean
 * nothing and which nothing would catch.
 */
const mode = ref<'choices' | 'correcting' | 'deleting'>('choices')

const deletionRequested = ref<boolean>(false)
const resent = ref<boolean>(false)
const formError = ref<string | undefined>(undefined)

const LIMIT = TEXT_LIMIT.changeEmailAddress

const NEW_ADDRESS = emailAddressSchema(LIMIT.emailAddress, 'Gib eine E-Mail-Adresse ein.')

async function resendLink() {
  formError.value = undefined

  try {
    await resend()
  } catch (error) {
    formError.value = failureMessage(error)
    return
  }

  resent.value = true
}

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { emailAddress: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    try {
      await changeAddress({ data: { emailAddress: parsed(NEW_ADDRESS, value.emailAddress) } })
    } catch (error) {
      if (error instanceof ApiError) {
        // Unlike a 400, this one is worth saying on the field: it is about the address typed, and
        // no client rule could have known it.
        if (error.status === 409) {
          form.setFieldMeta('emailAddress', (meta) => ({
            ...meta,
            errorMap: {
              ...meta.errorMap,
              onServer: 'Diese E-Mail-Adresse wird bereits verwendet.',
            },
          }))
          return
        }
      }
      formError.value = failureMessage(error)
      return
    }

    // The heading shows the address, which the change just moved.
    await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
    mode.value = 'choices'
    form.reset()
    resent.value = true
  },
})

async function signOut() {
  await logOut().catch(() => undefined)
  forgetCurrentUser()
  await router.push({ name: 'login' })
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">Bestätige deine E-Mail-Adresse</h1>
        <p class="text-note text-ink-5">
          Wir haben dir einen Link an <span class="text-ink-2">{{ emailAddress }}</span> geschickt.
          Öffne ihn, dann geht es los.
        </p>
        <!-- One note for the whole page: every state here is about the same mailed link, and
             each branch carrying its own would show the sentence twice. -->
        <MailedLinkNote />
      </div>

      <Alert v-if="formError" variant="destructive" role="alert" class="mt-5">
        <AlertDescription>{{ formError }}</AlertDescription>
      </Alert>

      <!-- No note here: the one under the heading is a standing statement about mailed links
           and already covers this. -->
      <p v-else-if="resent" class="mt-5 text-note text-ink-5">Ist unterwegs.</p>

      <template v-if="mode === 'choices'">
        <div class="mt-7 flex flex-col gap-3">
          <Button :disabled="isResending" @click="resendLink">
            <!-- The spinner stands in the icon's place rather than beside it, so the row keeps
                 its width while the link is on its way. -->
            <Spinner v-if="isResending" />
            <Send v-else :stroke-width="1.5" aria-hidden="true" />
            Link erneut senden
          </Button>
          <Button variant="outline" @click="mode = 'correcting'">
            <Pencil :stroke-width="1.5" />
            E-Mail-Adresse ändern
          </Button>
          <!--
            Leaving has to be possible from here. Every other route sends an unverified member
            back to this page, so without it the only way out of a mistyped address is to
            prove an address they may not want to give.
          -->
          <Button variant="outline" @click="mode = 'deleting'">
            <Trash2 :stroke-width="1.5" />
            Konto löschen
          </Button>
        </div>

        <p class="mt-6 text-[13px] leading-[1.5] text-ink-5">
          <button type="button" class="text-oak-deep underline underline-offset-2" @click="signOut">
            Abmelden
          </button>
        </p>
      </template>

      <!--
        The escape hatch: a mistyped address would otherwise leave the account unreachable,
        because the link went somewhere its owner cannot read.
      -->
      <form
        ref="formElement"
        v-else-if="mode === 'correcting'"
        class="mt-7 flex flex-col gap-5"
        novalidate
        @submit.prevent="form.handleSubmit()"
      >
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
        </FieldGroup>

        <div class="flex flex-col gap-3">
          <Button type="submit" :disabled="isChanging">
            <Spinner v-if="isChanging" />
            Adresse ändern und Link senden
          </Button>
          <Button type="button" variant="outline" @click="mode = 'choices'"> Abbrechen </Button>
        </div>
      </form>

      <div v-else class="mt-7">
        <template v-if="deletionRequested">
          <p class="text-note text-ink-5">
            Wir haben einen Link an <span class="text-ink-2">{{ emailAddress }}</span> geschickt.
            Erst wenn du ihn öffnest, wird dein Konto gelöscht. Kommst du an diese Adresse nicht
            heran, ändere sie zuerst.
          </p>

          <Button variant="outline" class="mt-5 w-full" @click="mode = 'choices'"> Zurück </Button>
        </template>

        <DeleteAccountForm v-else @requested="deletionRequested = true">
          <p>
            Löschen ist <span class="text-ink-2">endgültig</span>. Es passiert nicht sofort: wir
            schicken dir erst einen Link an deine E-Mail-Adresse.
          </p>
          <p>Du bist noch in keiner Gruppe, also geht nichts verloren, was jemand anderes liest.</p>

          <template #cancel>
            <Button type="button" variant="outline" @click="mode = 'choices'"> Abbrechen </Button>
          </template>
        </DeleteAccountForm>
      </div>
    </div>
  </main>
</template>

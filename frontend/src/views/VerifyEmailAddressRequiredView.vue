<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getGetCurrentUserQueryKey,
  useChangeEmailAddress,
  useGetCurrentUser,
  useLogoutUser,
  useResendEmailAddressVerification,
} from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { queryClient } from '@/lib/api/queryClient'
import { ApiError } from '@/lib/api/apiFetch'
import { type FieldMessages, fieldMessage } from '@/lib/validation/fieldMessage'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const router = useRouter()

const { data: currentUser } = useGetCurrentUser()
const emailAddress = computed(() =>
  currentUser.value?.status === 200 ? currentUser.value.data.emailAddress : '',
)

const { mutateAsync: resend, isPending: isResending } = useResendEmailAddressVerification()
const { mutateAsync: changeAddress, isPending: isChanging } = useChangeEmailAddress()
const { mutateAsync: logOut } = useLogoutUser()

const resent = ref<boolean>(false)
const correcting = ref<boolean>(false)
const newAddress = ref<string>('')
const fieldErrors = ref<{ emailAddress?: string }>({})
const formError = ref<string | undefined>(undefined)

const LIMIT = TEXT_LIMIT.changeEmailAddress

const FIELD_MESSAGES: Record<'emailAddress', FieldMessages> = {
  emailAddress: {
    missing: 'Gib eine E-Mail-Adresse ein.',
    malformed: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    tooLong: `Die E-Mail-Adresse darf höchstens ${formatCount(LIMIT.emailAddress.maxLength)} Zeichen lang sein.`,
  },
}

const formElement = ref<HTMLFormElement | null>(null)

async function resendLink() {
  formError.value = undefined

  try {
    await resend()
  } catch {
    formError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  resent.value = true
}

function validate(): boolean {
  const form = formElement.value
  if (form === null) {
    return false
  }

  const input = form.elements.namedItem('emailAddress')
  if (input instanceof HTMLInputElement && !input.validity.valid) {
    fieldErrors.value = { emailAddress: fieldMessage(FIELD_MESSAGES.emailAddress, input.validity) }
    return false
  }

  fieldErrors.value = {}
  return true
}

async function submitAddress() {
  formError.value = undefined

  if (!validate()) {
    return
  }

  try {
    await changeAddress({ data: { emailAddress: newAddress.value.trim() } })
  } catch (error) {
    if (error instanceof ApiError) {
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

  // The heading shows the address, which the change just moved.
  await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
  correcting.value = false
  newAddress.value = ''
  resent.value = true
}

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
        <h1 class="text-[25px] leading-[1.2]">Bestätige deine E-Mail-Adresse</h1>
        <p class="text-[13.5px] leading-[1.5] text-ink-5">
          Wir haben dir einen Link an <span class="text-ink-8">{{ emailAddress }}</span> geschickt.
          Öffne ihn, dann geht es los.
        </p>
      </div>

      <Alert v-if="formError" variant="destructive" role="alert" class="mt-5">
        <AlertDescription>{{ formError }}</AlertDescription>
      </Alert>

      <p v-else-if="resent" class="mt-5 text-[13.5px] leading-[1.6] text-ink-5">
        Ist unterwegs. Kommt nichts an, sieh auch im Spam-Ordner nach.
      </p>

      <template v-if="!correcting">
        <div class="mt-7 flex flex-col gap-3">
          <Button class="h-11 md:h-9" :disabled="isResending" @click="resendLink">
            <Spinner v-if="isResending" data-icon="inline-start" />
            Link erneut senden
          </Button>
          <Button variant="ghost" class="h-11 md:h-9" @click="correcting = true">
            E-Mail-Adresse ändern
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
        v-else
        ref="formElement"
        class="mt-7 flex flex-col gap-5"
        novalidate
        @submit.prevent="submitAddress"
      >
        <FieldGroup>
          <Field :data-invalid="fieldErrors.emailAddress !== undefined ? true : undefined">
            <FieldLabel for="emailAddress">Neue E-Mail-Adresse</FieldLabel>
            <Input
              id="emailAddress"
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
        </FieldGroup>

        <div class="flex flex-col gap-3">
          <Button type="submit" class="h-11 md:h-9" :disabled="isChanging">
            <Spinner v-if="isChanging" data-icon="inline-start" />
            Adresse ändern und Link senden
          </Button>
          <Button type="button" variant="ghost" class="h-11 md:h-9" @click="correcting = false">
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  </main>
</template>

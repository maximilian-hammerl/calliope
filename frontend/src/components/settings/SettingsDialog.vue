<script setup lang="ts">
/**
 * One accordion rather than a stack of forms: each section owns its own primary button, and
 * only one is ever open, so two of them never compete for the same glance. It also gives the
 * next setting somewhere obvious to go.
 */
import { computed, ref } from 'vue'
import {
  getGetCurrentUserQueryKey,
  useChangePassword,
  useGetCurrentUser,
  useRequestAccountDeletion,
  useRequestEmailAddressChange,
} from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { queryClient } from '@/lib/api/queryClient'
import { ApiError } from '@/lib/api/apiFetch'
import { type FieldMessages, fieldMessage, PASSWORDS_DIFFER } from '@/lib/validation/fieldMessage'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const open = defineModel<boolean>('open', { required: true })

const { data: currentUser } = useGetCurrentUser()
const currentAddress = computed(() =>
  currentUser.value?.status === 200 ? currentUser.value.data.emailAddress : '',
)

const { mutateAsync: requestChange, isPending } = useRequestEmailAddressChange()

type FieldName = 'emailAddress' | 'password'

const newAddress = ref<string>('')
const password = ref<string>('')
const fieldErrors = ref<Partial<Record<FieldName, string>>>({})
const formError = ref<string | undefined>(undefined)
const requestedFor = ref<string | undefined>(undefined)

const LIMIT = TEXT_LIMIT.requestEmailAddressChange
const FIELD_NAMES = ['emailAddress', 'password'] as const

const FIELD_MESSAGES: Record<FieldName, FieldMessages> = {
  emailAddress: {
    missing: 'Gib eine E-Mail-Adresse ein.',
    malformed: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    tooLong: `Die E-Mail-Adresse darf höchstens ${formatCount(LIMIT.emailAddress.maxLength)} Zeichen lang sein.`,
  },
  password: {
    missing: 'Gib dein aktuelles Passwort ein.',
    malformed: 'Gib dein aktuelles Passwort ein.',
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

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit() {
  formError.value = undefined
  requestedFor.value = undefined

  if (!validate()) {
    return
  }

  const requested = newAddress.value.trim()

  try {
    await requestChange({ data: { emailAddress: requested, password: password.value } })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        fieldErrors.value = { password: 'Das Passwort ist nicht korrekt.' }
        return
      }
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

  await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
  requestedFor.value = requested
  newAddress.value = ''
  password.value = ''
}

type PasswordFieldName = 'currentPassword' | 'newPassword' | 'newPasswordConfirmation'

const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangePassword()

const currentPassword = ref<string>('')
const newPassword = ref<string>('')
const newPasswordConfirmation = ref<string>('')
const passwordErrors = ref<Partial<Record<PasswordFieldName, string>>>({})
const passwordFormError = ref<string | undefined>(undefined)
const passwordChanged = ref<boolean>(false)

const PASSWORD_LIMIT = TEXT_LIMIT.changePassword
const PASSWORD_FIELD_NAMES = ['currentPassword', 'newPassword', 'newPasswordConfirmation'] as const

const tooLong = `Das Passwort darf höchstens ${formatCount(PASSWORD_LIMIT.newPassword.maxLength)} Zeichen lang sein.`

const PASSWORD_FIELD_MESSAGES: Record<PasswordFieldName, FieldMessages> = {
  currentPassword: {
    missing: 'Gib dein aktuelles Passwort ein.',
    malformed: 'Gib dein aktuelles Passwort ein.',
    tooLong,
  },
  newPassword: {
    missing: 'Wähle ein neues Passwort.',
    malformed: 'Wähle ein neues Passwort.',
    tooLong,
  },
  newPasswordConfirmation: {
    missing: 'Wiederhole dein neues Passwort.',
    malformed: 'Wiederhole dein neues Passwort.',
    tooLong,
  },
}

const passwordFormElement = ref<HTMLFormElement | null>(null)

function validatePasswordForm(): boolean {
  const form = passwordFormElement.value
  if (form === null) {
    return false
  }

  const errors: Partial<Record<PasswordFieldName, string>> = {}

  for (const name of PASSWORD_FIELD_NAMES) {
    const input = form.elements.namedItem(name)
    if (input instanceof HTMLInputElement && !input.validity.valid) {
      errors[name] = fieldMessage(PASSWORD_FIELD_MESSAGES[name], input.validity)
    }
  }

  if (
    errors.newPasswordConfirmation === undefined &&
    newPasswordConfirmation.value !== newPassword.value
  ) {
    errors.newPasswordConfirmation = PASSWORDS_DIFFER
  }

  passwordErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submitPassword() {
  passwordFormError.value = undefined
  passwordChanged.value = false

  if (!validatePasswordForm()) {
    return
  }

  try {
    await changePassword({
      data: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      passwordErrors.value = { currentPassword: 'Das Passwort ist nicht korrekt.' }
      return
    }
    passwordFormError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  currentPassword.value = ''
  newPassword.value = ''
  newPasswordConfirmation.value = ''
  passwordChanged.value = true
}

const { mutateAsync: requestDeletion, isPending: isRequestingDeletion } =
  useRequestAccountDeletion()

const deletionPassword = ref<string>('')
const deletionError = ref<string | undefined>(undefined)
const deletionFormError = ref<string | undefined>(undefined)
const deletionRequested = ref<boolean>(false)

const DELETION_LIMIT = TEXT_LIMIT.requestAccountDeletion

const DELETION_FIELD_MESSAGES: FieldMessages = {
  missing: 'Gib dein aktuelles Passwort ein.',
  malformed: 'Gib dein aktuelles Passwort ein.',
  tooLong: `Das Passwort darf höchstens ${formatCount(DELETION_LIMIT.password.maxLength)} Zeichen lang sein.`,
}

const deletionFormElement = ref<HTMLFormElement | null>(null)

function validateDeletionForm(): boolean {
  const form = deletionFormElement.value
  if (form === null) {
    return false
  }

  const input = form.elements.namedItem('deletionPassword')
  const invalid = input instanceof HTMLInputElement && !input.validity.valid

  deletionError.value = invalid ? fieldMessage(DELETION_FIELD_MESSAGES, input.validity) : undefined

  return !invalid
}

async function submitDeletion() {
  deletionFormError.value = undefined
  deletionRequested.value = false

  if (!validateDeletionForm()) {
    return
  }

  try {
    await requestDeletion({ data: { password: deletionPassword.value } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      deletionError.value = 'Das Passwort ist nicht korrekt.'
      return
    }
    deletionFormError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  deletionPassword.value = ''
  deletionRequested.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Einstellungen</DialogTitle>
        <DialogDescription>Dein Konto, und worüber du benachrichtigt wirst.</DialogDescription>
      </DialogHeader>

      <!-- All closed to begin with: opening this should not present a form asking for a
           password, and deleting the account must never be the first thing on screen. -->
      <Accordion type="single" collapsible class="w-full">
        <AccordionItem value="email">
          <AccordionTrigger>E-Mail-Adresse</AccordionTrigger>
          <AccordionContent>
            <p class="mb-4 text-[13px] leading-[1.6] text-ink-5">
              Aktuell: <span class="text-ink-8">{{ currentAddress }}</span>
            </p>

            <p v-if="requestedFor" class="mb-4 text-[13px] leading-[1.6] text-ink-5">
              Wir haben einen Link an <span class="text-ink-8">{{ requestedFor }}</span> geschickt.
              Bis du ihn öffnest, bleibt deine bisherige Adresse in Kraft. An sie ist ebenfalls eine
              Nachricht unterwegs.
            </p>

            <form ref="formElement" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
              <Alert v-if="formError" variant="destructive" role="alert">
                <AlertDescription>{{ formError }}</AlertDescription>
              </Alert>

              <FieldGroup>
                <Field :data-invalid="fieldErrors.emailAddress !== undefined ? true : undefined">
                  <FieldLabel for="newEmailAddress">Neue E-Mail-Adresse</FieldLabel>
                  <Input
                    id="newEmailAddress"
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

                <Field :data-invalid="fieldErrors.password !== undefined ? true : undefined">
                  <FieldLabel for="currentPassword">Aktuelles Passwort</FieldLabel>
                  <Input
                    id="currentPassword"
                    v-model="password"
                    class="h-11 md:h-9"
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

              <Button type="submit" class="h-11 md:h-9" :disabled="isPending">
                <Spinner v-if="isPending" data-icon="inline-start" />
                Link an neue Adresse senden
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="password">
          <AccordionTrigger>Passwort</AccordionTrigger>
          <AccordionContent>
            <p v-if="passwordChanged" class="mb-4 text-[13px] leading-[1.6] text-ink-5">
              Dein neues Passwort ist gespeichert. Auf allen anderen Geräten wurdest du abgemeldet.
            </p>

            <form
              ref="passwordFormElement"
              class="flex flex-col gap-4"
              novalidate
              @submit.prevent="submitPassword"
            >
              <Alert v-if="passwordFormError" variant="destructive" role="alert">
                <AlertDescription>{{ passwordFormError }}</AlertDescription>
              </Alert>

              <FieldGroup>
                <Field
                  :data-invalid="passwordErrors.currentPassword !== undefined ? true : undefined"
                >
                  <FieldLabel for="settingsCurrentPassword">Aktuelles Passwort</FieldLabel>
                  <Input
                    id="settingsCurrentPassword"
                    v-model="currentPassword"
                    class="h-11 md:h-9"
                    name="currentPassword"
                    type="password"
                    :maxlength="PASSWORD_LIMIT.currentPassword.maxLength"
                    autocomplete="current-password"
                    required
                    :aria-invalid="passwordErrors.currentPassword !== undefined ? true : undefined"
                  />
                  <FieldError :errors="[passwordErrors.currentPassword]" />
                </Field>

                <Field :data-invalid="passwordErrors.newPassword !== undefined ? true : undefined">
                  <FieldLabel for="settingsNewPassword">Neues Passwort</FieldLabel>
                  <Input
                    id="settingsNewPassword"
                    v-model="newPassword"
                    class="h-11 md:h-9"
                    name="newPassword"
                    type="password"
                    :maxlength="PASSWORD_LIMIT.newPassword.maxLength"
                    autocomplete="new-password"
                    required
                    :aria-invalid="passwordErrors.newPassword !== undefined ? true : undefined"
                  />
                  <FieldError :errors="[passwordErrors.newPassword]" />
                </Field>

                <Field
                  :data-invalid="
                    passwordErrors.newPasswordConfirmation !== undefined ? true : undefined
                  "
                >
                  <FieldLabel for="settingsNewPasswordRepeat">
                    Neues Passwort wiederholen
                  </FieldLabel>
                  <Input
                    id="settingsNewPasswordRepeat"
                    v-model="newPasswordConfirmation"
                    class="h-11 md:h-9"
                    name="newPasswordConfirmation"
                    type="password"
                    :maxlength="PASSWORD_LIMIT.newPassword.maxLength"
                    autocomplete="new-password"
                    required
                    :aria-invalid="
                      passwordErrors.newPasswordConfirmation !== undefined ? true : undefined
                    "
                  />
                  <FieldError :errors="[passwordErrors.newPasswordConfirmation]" />
                </Field>
              </FieldGroup>

              <Button type="submit" class="h-11 md:h-9" :disabled="isChangingPassword">
                <Spinner v-if="isChangingPassword" data-icon="inline-start" />
                Passwort ändern
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>

        <!-- Last, and the only destructive action in the product: the one place a red button
             is the honest colour. -->
        <AccordionItem value="deletion">
          <AccordionTrigger>Konto löschen</AccordionTrigger>
          <AccordionContent>
            <p v-if="deletionRequested" class="mb-4 text-[13px] leading-[1.6] text-ink-5">
              Wir haben einen Link an <span class="text-ink-8">{{ currentAddress }}</span>
              geschickt. Erst wenn du ihn öffnest, wird dein Konto gelöscht. Bis dahin bleibt alles,
              wie es ist.
            </p>

            <div class="mb-4 flex flex-col gap-3 text-[13px] leading-[1.6] text-ink-5">
              <p>
                Löschen ist <span class="text-ink-8">endgültig</span>. Wir können dein Konto danach
                nicht zurückholen.
              </p>
              <p>
                Es passiert nicht sofort: wir schicken dir erst einen Link an deine E-Mail-Adresse.
                Solange du ihn nicht öffnest, bleibt dein Konto bestehen.
              </p>
              <p>
                Weg sind dein Konto, deine Mitgliedschaften, deine Einladungen und deine
                Benachrichtigungen. Was du in Gruppen geschrieben hast, bleibt dort stehen — es
                gehört zu Geschichten, an denen andere weitergeschrieben haben — aber ohne deinen
                Namen. Gruppen, in denen sonst niemand mehr ist, werden mit gelöscht.
              </p>
            </div>

            <form
              ref="deletionFormElement"
              class="flex flex-col gap-4"
              novalidate
              @submit.prevent="submitDeletion"
            >
              <Alert v-if="deletionFormError" variant="destructive" role="alert">
                <AlertDescription>{{ deletionFormError }}</AlertDescription>
              </Alert>

              <FieldGroup>
                <Field :data-invalid="deletionError !== undefined ? true : undefined">
                  <FieldLabel for="deletionPassword">Aktuelles Passwort</FieldLabel>
                  <Input
                    id="deletionPassword"
                    v-model="deletionPassword"
                    class="h-11 md:h-9"
                    name="deletionPassword"
                    type="password"
                    :maxlength="DELETION_LIMIT.password.maxLength"
                    autocomplete="current-password"
                    required
                    :aria-invalid="deletionError !== undefined ? true : undefined"
                  />
                  <FieldError :errors="[deletionError]" />
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                variant="destructive"
                class="h-11 md:h-9"
                :disabled="isRequestingDeletion"
              >
                <Spinner v-if="isRequestingDeletion" data-icon="inline-start" />
                Löschen-Link anfordern
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DialogContent>
  </Dialog>
</template>

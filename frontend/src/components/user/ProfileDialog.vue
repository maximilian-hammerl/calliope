<script setup lang="ts">
/**
 * Nothing here is required and nothing is hidden, so the description says who can read it
 * before anybody writes a word.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useDeleteAvatar, useSetAvatar, useUpdateOwnProfile } from '@/api/users/users'
import type { GetUser200, SetAvatarBodyOrigin } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { getGetCurrentUserQueryKey } from '@/api/auth/auth'
import { queryClient } from '@/lib/api/queryClient'
import AvatarPicker from '@/components/user/AvatarPicker.vue'
import {
  AVATAR_NEEDS_CREDIT,
  AVATAR_NOT_AN_IMAGE,
  AVATAR_TOO_LARGE,
  OWN_WORK,
} from '@/lib/format/avatar'
import { failureMessage } from '@/lib/format/failure'
import { formatCount } from '@/lib/format/formatNumber'
import { focusFirstInvalid, parsed, proseSchema } from '@/lib/validation/fieldSchemas'
import { PROFILE_FIELDS, PROFILE_LIMIT } from '@/lib/profile/profileFields'
import type { ProfileFieldKey } from '@/lib/profile/profileFields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ profile: GetUser200 }>()
const emit = defineEmits<{ saved: [] }>()

/**
 * The picture saves on its own rather than joining the profile form: it is a multipart body where
 * that one is a JSON patch of changed fields, and its declaration has nothing to do with the rest.
 */
const chosenFile = ref<File | undefined>(undefined)
const origin = ref<SetAvatarBodyOrigin>(OWN_WORK)
const credit = ref<string>('')
const confirmed = ref<boolean>(false)
const pictureError = ref<string | undefined>(undefined)

const setAvatar = useSetAvatar()
const removeAvatar = useDeleteAvatar()
const savingPicture = computed<boolean>(
  () => setAvatar.isPending.value || removeAvatar.isPending.value,
)

/** Every refusal the route can answer, said in words a member can act on. */
function pictureFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return AVATAR_TOO_LARGE
    if (error.status === 422) return AVATAR_NOT_AN_IMAGE
    if (error.status === 400) return AVATAR_NEEDS_CREDIT
  }
  return failureMessage(error, 'Das Bild ließ sich nicht speichern.')
}

/**
 * The profile *and* the current user: the top bar reads its own picture from `/auth/me`, so
 * refreshing only the profile leaves the old face in the corner until a reload.
 */
async function refreshEverywhere(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
  emit('saved')
}

/** One state after either act, so the block never says two things at once. */
function resetPicture(): void {
  chosenFile.value = undefined
  origin.value = OWN_WORK
  credit.value = ''
  confirmed.value = false
}

async function savePicture(): Promise<void> {
  pictureError.value = undefined
  if (chosenFile.value === undefined) return

  try {
    await setAvatar.mutateAsync({
      data: {
        image: chosenFile.value,
        origin: origin.value,
        credit: origin.value === OWN_WORK ? undefined : credit.value,
        confirmed: 'true',
      },
    })
    resetPicture()
    await refreshEverywhere()
  } catch (error) {
    pictureError.value = pictureFailure(error)
  }
}

async function removePicture(): Promise<void> {
  pictureError.value = undefined
  try {
    await removeAvatar.mutateAsync()
    // Also clears a pending choice: „entfernen" means no picture, so leaving one selected and
    // waiting to be saved says the opposite.
    resetPicture()
    await refreshEverywhere()
  } catch (error) {
    pictureError.value = pictureFailure(error)
  }
}

const limit = (key: ProfileFieldKey) => formatCount(PROFILE_LIMIT[key].maxLength)

/** Every field optional, so no `missing` wording; the plural ones take „dürfen". */
const SCHEMAS: Record<ProfileFieldKey, ReturnType<typeof proseSchema>> = {
  aboutMe: proseSchema(
    PROFILE_LIMIT.aboutMe,
    `Der Text über dich darf höchstens ${limit('aboutMe')} Zeichen lang sein.`,
  ),
  writingStyle: proseSchema(
    PROFILE_LIMIT.writingStyle,
    `Die Schreibweise darf höchstens ${limit('writingStyle')} Zeichen lang sein.`,
  ),
  postLength: proseSchema(
    PROFILE_LIMIT.postLength,
    `Die Beitragslänge darf höchstens ${limit('postLength')} Zeichen lang sein.`,
  ),
  writingFrequency: proseSchema(
    PROFILE_LIMIT.writingFrequency,
    `Die Schreibhäufigkeit darf höchstens ${limit('writingFrequency')} Zeichen lang sein.`,
  ),
  coWriterExpectations: proseSchema(
    PROFILE_LIMIT.coWriterExpectations,
    `Die Erwartungen dürfen höchstens ${limit('coWriterExpectations')} Zeichen lang sein.`,
  ),
  writingBoundaries: proseSchema(
    PROFILE_LIMIT.writingBoundaries,
    `Die NO-GOs dürfen höchstens ${limit('writingBoundaries')} Zeichen lang sein.`,
  ),
  genres: proseSchema(
    PROFILE_LIMIT.genres,
    `Die Lieblingsgenres dürfen höchstens ${limit('genres')} Zeichen lang sein.`,
  ),
}

const blank = (value: string) => (value.trim().length === 0 ? null : value.trim())

const { mutateAsync: updateProfile, isPending } = useUpdateOwnProfile()
const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const EMPTY = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, ''])) as Record<
  ProfileFieldKey,
  string
>

/** What the dialog was opened with, so a save carries only the fields that actually changed. */
const opened = ref<Record<ProfileFieldKey, string>>({ ...EMPTY })

const profileForm = useForm({
  defaultValues: { ...EMPTY },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    // Sending every field would overwrite whatever was edited elsewhere in the meantime, and
    // sending nothing is a 400 — so an unchanged profile just closes.
    const values: Partial<Record<ProfileFieldKey, string | null>> = {}
    for (const field of PROFILE_FIELDS) {
      const text = parsed(SCHEMAS[field.key], value[field.key])
      if (text !== opened.value[field.key]) {
        values[field.key] = blank(text)
      }
    }

    if (Object.keys(values).length === 0) {
      open.value = false
      return
    }

    try {
      await updateProfile({ data: values })
    } catch (error) {
      formError.value = failureMessage(error)
      return
    }

    open.value = false
    emit('saved')
  },
})

// Filled each time it opens, so a dialog closed without saving does not keep the abandoned text.
watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      return
    }
    formError.value = undefined
    for (const field of PROFILE_FIELDS) {
      const stored = props.profile[field.key] ?? ''
      opened.value[field.key] = stored
      profileForm.setFieldValue(field.key, stored)
    }
  },
  { immediate: true },
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Profil bearbeiten</DialogTitle>
        <DialogDescription>
          Alles freiwillig. Was du hier schreibst, können alle Mitglieder mit einem Konto lesen —
          außerhalb von Calliope ist nichts davon sichtbar. Genau dafür ist es da: Leute, die dich
          noch nicht kennen, sehen so, ob ihr zusammenpasst.
        </DialogDescription>
      </DialogHeader>

      <!-- One accordion, like the settings dialog: each half owns its own save, and only one is
           open, so two primary buttons never compete for the same glance. -->
      <Accordion type="single" collapsible class="w-full" default-value="angaben">
        <AccordionItem value="bild">
          <AccordionTrigger>Bild</AccordionTrigger>
          <AccordionContent class="flex min-w-0 flex-col gap-4">
            <Alert v-if="pictureError" variant="destructive" role="alert">
              <AlertDescription>{{ pictureError }}</AlertDescription>
            </Alert>

            <AvatarPicker
              v-model:file="chosenFile"
              v-model:origin="origin"
              v-model:credit="credit"
              v-model:confirmed="confirmed"
              :username="props.profile.username"
              :current-url="props.profile.avatarUrl"
              :disabled="savingPicture"
            />

            <div class="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                :disabled="chosenFile === undefined || !confirmed || savingPicture"
                @click="savePicture"
              >
                <Spinner v-if="setAvatar.isPending.value" />
                Bild speichern
              </Button>

              <Button
                v-if="props.profile.avatarUrl"
                type="button"
                variant="outline"
                :disabled="savingPicture"
                @click="removePicture"
              >
                <Spinner v-if="removeAvatar.isPending.value" />
                Bild entfernen
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="angaben">
          <AccordionTrigger>Angaben</AccordionTrigger>
          <AccordionContent>
            <form
              ref="formElement"
              class="flex flex-col gap-5"
              novalidate
              @submit.prevent="profileForm.handleSubmit()"
            >
              <Alert v-if="formError" variant="destructive" role="alert">
                <AlertDescription>{{ formError }}</AlertDescription>
              </Alert>

              <FieldGroup>
                <profileForm.Field
                  v-for="field in PROFILE_FIELDS"
                  :key="field.key"
                  :name="field.key"
                  :validators="{ onSubmit: SCHEMAS[field.key] }"
                >
                  <template v-slot="{ field: api }">
                    <FormTextField :field="api" :label="field.label" optional multiline rows="3">
                      <template #description>{{ field.description }}</template>
                    </FormTextField>
                  </template>
                </profileForm.Field>
              </FieldGroup>

              <DialogFooter>
                <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
                  Abbrechen
                </Button>
                <Button type="submit" :disabled="isPending">
                  <Spinner v-if="isPending" />
                  Änderungen speichern
                </Button>
              </DialogFooter>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DialogContent>
  </Dialog>
</template>

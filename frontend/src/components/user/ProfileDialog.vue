<script setup lang="ts">
/**
 * Nothing here is required and nothing is hidden, so the description says who can read it
 * before anybody writes a word.
 */
import { ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useUpdateOwnProfile } from '@/api/users/users'
import type { GetUser200 } from '@/api/models'
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
    </DialogContent>
  </Dialog>
</template>

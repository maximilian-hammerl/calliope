<script setup lang="ts">
/**
 * Asking for the deletion link: the password field, the red button, and what to do with a
 * wrong password. Shared because a member reaches this from two places — the settings dialog,
 * and the verification wall, which is the only page an unverified account can open at all.
 *
 * The surrounding explanation is slotted rather than built in: the wall knows the account is
 * in no group yet, and says so, where the dialog has to account for a member's writing.
 */
import { ref } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useRequestAccountDeletion } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, passwordSchema } from '@/lib/validation/fieldSchemas'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const emit = defineEmits<{ requested: [] }>()

const { mutateAsync: requestDeletion, isPending } = useRequestAccountDeletion()

const LIMIT = TEXT_LIMIT.requestAccountDeletion

const PASSWORD = passwordSchema(LIMIT.password, 'Gib dein aktuelles Passwort ein.')

const formError = ref<string | undefined>(undefined)

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { deletionPassword: '' },
  // Focus follows the first thing that is wrong; without it focus stays on the button.
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    try {
      await requestDeletion({ data: { password: value.deletionPassword } })
    } catch (error) {
      // An answer, not a lost session — `EXPECTED_401_MUTATIONS` keeps the global handler off it.
      // Said on the field, because it is about the password that was typed.
      if (error instanceof ApiError && error.status === 401) {
        form.setFieldMeta('deletionPassword', (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: 'Das Passwort ist nicht korrekt.' },
        }))
        return
      }
      formError.value = failureMessage(error)
      return
    }

    form.reset()
    emit('requested')
  },
})
</script>

<template>
  <form
    ref="formElement"
    class="flex flex-col gap-5"
    novalidate
    @submit.prevent="form.handleSubmit()"
  >
    <div class="flex flex-col gap-3 text-row text-ink-5">
      <slot />
    </div>

    <Alert v-if="formError" variant="destructive" role="alert">
      <AlertDescription>{{ formError }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <form.Field name="deletionPassword" :validators="{ onSubmit: PASSWORD }">
        <template v-slot="{ field }">
          <FormTextField
            :field="field"
            label="Aktuelles Passwort"
            type="password"
            :maxlength="LIMIT.password.maxLength"
            autocomplete="current-password"
          />
        </template>
      </form.Field>
    </FieldGroup>

    <div class="flex flex-col gap-3">
      <Button type="submit" variant="destructive" :disabled="isPending">
        <Spinner v-if="isPending" />
        Löschen-Link anfordern
      </Button>
      <slot name="cancel" />
    </div>
  </form>
</template>

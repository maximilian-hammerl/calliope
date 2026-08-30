<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { focusFirstInvalid, httpUrlSchema } from '@/lib/validation/fieldSchemas'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import FormTextField from '@/components/common/FormTextField.vue'

/**
 * The address for a link in a post. One dialog for both verbs, as the group and thread dialogs
 * are: an existing `href` means editing, and only then is removing offered.
 *
 * The scheme is checked here as well as by the API, so a member is told while the dialog is open
 * rather than when the post is sent. `mailto:` is refused deliberately by both: the allowlist is
 * `HREF` in `backend/src/document/document_schema.ts`.
 */
const props = defineProps<{ href?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [href: string]; remove: [] }>()

const editing = computed<boolean>(() => props.href !== undefined && props.href.length > 0)

const ADDRESS = httpUrlSchema('Gib die Adresse des Links ein.')

const formElement = ref<HTMLFormElement | null>(null)

const form = useForm({
  defaultValues: { address: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: ({ value }) => {
    // Normalised through `URL`, so `example.org/x ` and `https://example.org/x` reach the document
    // in one shape. The schema has already proved it parses.
    emit('submit', new URL(value.address).toString())
    open.value = false
  },
})

// Opening fills the field from the link being edited; closing clears it either way.
watch(open, (isOpen) => {
  form.reset({ address: isOpen ? (props.href ?? '') : '' })
})

function remove() {
  emit('remove')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>{{ editing ? 'Link bearbeiten' : 'Link einfügen' }}</DialogTitle>
        <DialogDescription> Die Adresse, auf die der markierte Text zeigt. </DialogDescription>
      </DialogHeader>

      <form
        ref="formElement"
        class="flex flex-col gap-5"
        novalidate
        @submit.prevent="form.handleSubmit()"
      >
        <FieldGroup>
          <form.Field name="address" :validators="{ onSubmit: ADDRESS }">
            <template v-slot="{ field }">
              <FormTextField
                id="link-address"
                :field="field"
                label="Adresse"
                type="url"
                placeholder="https://"
                required
              />
            </template>
          </form.Field>
        </FieldGroup>

        <DialogFooter>
          <!-- Only offered where there is a link to remove, so the dialog never shows a control
               that would do nothing. -->
          <Button v-if="editing" type="button" variant="outline" @click="remove">
            Link entfernen
          </Button>
          <Button type="button" variant="outline" @click="open = false">Abbrechen</Button>
          <Button type="submit">{{ editing ? 'Änderungen speichern' : 'Link einfügen' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

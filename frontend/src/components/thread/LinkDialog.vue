<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * The address for a link in a post. One dialog for both verbs, as the group and thread dialogs
 * are: an existing `href` means editing, and only then is removing offered.
 *
 * The scheme is checked here as well as by the API, so a member is told while the dialog is open
 * rather than when the post is sent. `mailto:` is refused deliberately — see #44.
 */
const props = defineProps<{ href?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [href: string]; remove: [] }>()

const editing = computed<boolean>(() => props.href !== undefined && props.href.length > 0)

const address = ref<string>('')
const addressError = ref<string | undefined>(undefined)

// Opening fills the field from the link being edited; closing clears it either way.
watch(open, (isOpen) => {
  address.value = isOpen ? (props.href ?? '') : ''
  addressError.value = undefined
})

function submit() {
  const entered = address.value.trim()

  if (entered.length === 0) {
    addressError.value = 'Gib die Adresse des Links ein.'
    return
  }

  let url: URL
  try {
    url = new URL(entered)
  } catch {
    addressError.value = 'Das ist keine vollständige Adresse. Sie muss mit https:// beginnen.'
    return
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    addressError.value = 'Nur Adressen mit https:// oder http:// sind möglich.'
    return
  }

  addressError.value = undefined
  emit('submit', url.toString())
  open.value = false
}

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

      <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <FieldGroup>
          <Field :data-invalid="addressError !== undefined ? true : undefined">
            <FieldLabel for="link-address">Adresse</FieldLabel>
            <Input
              id="link-address"
              v-model="address"
              name="address"
              type="url"
              placeholder="https://"
              required
              :aria-invalid="addressError !== undefined ? true : undefined"
            />
            <FieldError :errors="[addressError]" />
          </Field>
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

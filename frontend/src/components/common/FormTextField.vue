<script setup lang="ts">
/**
 * One text field of a form: its label, its input, its description and its error, wired together.
 *
 * It exists because four things had to be repeated per field and two of them are easy to forget.
 * `aria-invalid` and `data-invalid` say *that* the field is wrong; **`aria-describedby` is what
 * says why** — without it somebody tabbing back to a field hears "invalid" and nothing more. Doing
 * that by hand meant a hand-written id on every field and every error.
 *
 * `field` is TanStack Form's field API. It is typed loosely on purpose: the generic signature of a
 * `FieldApi` carries eleven parameters, and naming them here would tie this component to the shape
 * of whichever form rendered it.
 */
import { computed } from 'vue'
import { firstError } from '@/lib/validation/fieldSchemas'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Or every passed-through attribute lands twice: once on the Field wrapper by Vue's own
// inheritance and once on the Input below.
defineOptions({ inheritAttrs: false })

type FieldApi = {
  name: string
  state: { value: string; meta: { errors: readonly unknown[] } }
  handleChange: (value: string) => void
}

const props = defineProps<{
  field: FieldApi
  label: string
  /** The input's `id`, which the label points at and the error derives its own id from. */
  id: string
}>()

const invalid = computed<true | undefined>(() =>
  props.field.state.meta.errors.length > 0 ? true : undefined,
)

/** Only referenced while there is an error to read, or a screen reader announces an empty node. */
const describedBy = computed<string | undefined>(() =>
  invalid.value === true ? `${props.id}-error` : undefined,
)
</script>

<template>
  <Field :data-invalid="invalid">
    <FieldLabel :for="id">{{ label }}</FieldLabel>
    <Input
      :id="id"
      :name="field.name"
      :model-value="field.state.value"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      v-bind="$attrs"
      @update:model-value="(value) => field.handleChange(String(value))"
    />
    <FieldDescription v-if="$slots.description">
      <slot name="description" />
    </FieldDescription>
    <FieldError :id="`${id}-error`" :errors="firstError(field.state.meta.errors)" />
  </Field>
</template>

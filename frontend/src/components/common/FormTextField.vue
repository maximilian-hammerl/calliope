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
import { computed, useId } from 'vue'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// Or every passed-through attribute lands twice: once on the Field wrapper by Vue's own
// inheritance and once on the control below.
defineOptions({ inheritAttrs: false })

type FieldApi = {
  name: string
  state: { value: string; meta: { errors: readonly unknown[] } }
  handleChange: (value: string) => void
}

const props = defineProps<{
  field: FieldApi
  label: string
  // These three are declared props rather than attributes, or they land on the control too.
  optional?: boolean
  /**
   * For the one field whose own control already names it — the chat row, revealed by a „+ Chat"
   * button. Hidden, not dropped: it still answers what the input is for.
   */
  labelHidden?: boolean
  /** Prose rather than a line: the same field, wired the same way, with `rows` as an attribute. */
  multiline?: boolean
  /**
   * Only where something outside this component has to name the input. Left off, it generates its
   * own — a field cannot collide with the same field in another form, and nobody has to invent a
   * unique word per call site the way `settingsCurrentPassword` had to.
   */
  id?: string
}>()

const generatedId = useId()
const fieldId = computed<string>(() => props.id ?? generatedId)

const invalid = computed<true | undefined>(() =>
  props.field.state.meta.errors.length > 0 ? true : undefined,
)

/**
 * Only the first. Zod collects *every* failing check and keeps them in declaration order, so the
 * schemas are written in the order a member should read them — and this shows the first of them.
 * Nothing unwraps the issues: `FieldError` reads `.message` off them already.
 */
const shown = computed<Array<{ message: string | undefined }>>(
  () => props.field.state.meta.errors.slice(0, 1) as Array<{ message: string | undefined }>,
)

/** Only referenced while there is an error to read, or a screen reader announces an empty node. */
const describedBy = computed<string | undefined>(() =>
  invalid.value === true ? `${fieldId.value}-error` : undefined,
)
</script>

<template>
  <Field :data-invalid="invalid">
    <FieldLabel :for="fieldId" :optional="optional" :class="labelHidden ? 'sr-only' : undefined">
      {{ label }}
    </FieldLabel>
    <component
      :is="multiline ? Textarea : Input"
      :id="fieldId"
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
    <FieldError :id="`${fieldId}-error`" :errors="shown" />
  </Field>
</template>

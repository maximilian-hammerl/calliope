<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  class?: HTMLAttributes['class']
  /**
   * Says the field may be left blank. Patched in rather than written at each call site so the
   * word is the same everywhere — and marked on the *optional* fields, never the required ones,
   * because the problem it solves is members typing filler into fields they believe they must
   * answer. Silence therefore means required, which works because that is the rare case.
   */
  optional?: boolean
}>()
</script>

<template>
  <Label
    data-slot="field-label"
    :class="
      cn(
        'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50',
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4',
        'has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10',
        props.class,
      )
    "
  >
    <slot />
    <!-- Quieter than the label it follows: this appears many times in a long form, and it is
         reassurance rather than instruction. -->
    <span v-if="optional" class="text-[11.5px] font-normal text-ink-6">optional</span>
  </Label>
</template>

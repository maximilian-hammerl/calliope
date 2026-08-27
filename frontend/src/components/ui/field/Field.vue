<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { FieldVariants } from '.'
import { cn } from '@/lib/utils'
import { fieldVariants } from '.'

const props = defineProps<{
  class?: HTMLAttributes['class']
  orientation?: FieldVariants['orientation']
}>()
</script>

<template>
  <!--
    shadcn gives this a `group` role. Every Field in this app wraps exactly one labelled control,
    and a group is for a *set* of them — so it announced a group with no accessible name. Naming it
    from the FieldLabel would be worse: a screen reader would read the same words twice, once for
    the group and once for the input the label is already `for`. `data-slot` is what selectors use.
  -->
  <div
    data-slot="field"
    :data-orientation="orientation"
    :class="cn(fieldVariants({ orientation }), props.class)"
  >
    <slot />
  </div>
</template>

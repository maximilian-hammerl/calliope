<script setup lang="ts">
import type { AccordionTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { AccordionHeader, AccordionTrigger, injectCollapsibleRootContext, useId } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<AccordionTriggerProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')

/**
 * Patched: the trigger rendered `aria-controls=""`, an IDREF pointing at nothing.
 *
 * `CollapsibleRoot` starts `contentId` empty and `CollapsibleContent` fills it in as it renders —
 * but the trigger renders first, and a *shut* section renders no content at all, so a collapsed
 * filter never got one. Claiming the id here, before the trigger paints, gives both sides the
 * same one: the content assigns with `||=` and so keeps it. Same fix as `DialogContent`'s
 * `contentId`, and the same cause.
 */
const collapsible = injectCollapsibleRootContext()
collapsible.contentId ||= useId(undefined, 'reka-collapsible-content')
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      data-slot="accordion-trigger"
      v-bind="delegatedProps"
      :class="
        cn(
          'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&[data-state=closed]>svg:nth-of-type(2)]:hidden [&[data-state=open]>svg:nth-of-type(1)]:hidden',
          props.class,
        )
      "
    >
      <slot />
      <!-- Patched: shadcn rotates one ChevronDown, where the design system's icon table gives
           a disclosure ChevronRight shut and ChevronDown open. Both are decorative — the
           trigger's own `aria-expanded` already says which way it points. -->
      <slot name="icon">
        <ChevronRight
          class="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5"
          aria-hidden="true"
        />
        <ChevronDown
          class="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5"
          aria-hidden="true"
        />
      </slot>
    </AccordionTrigger>
  </AccordionHeader>
</template>

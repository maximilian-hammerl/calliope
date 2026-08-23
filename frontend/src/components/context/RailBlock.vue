<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

/**
 * One block of the left rail. Collapsible where the rail exists as a rail, plain where it does
 * not: in the mobile sheet the blocks are simply stacked, because a sheet the member opened on
 * purpose is not the thing that was distracting them.
 *
 * Closed to start, and the choice is not remembered — the rail is reference material a member
 * reaches for, not a workspace to arrange.
 *
 * One accordion per block rather than one holding all three, so several can stand open at once
 * without the views having to wrap them. Only the rail's sizing is set on the trigger; the
 * disclosure chevrons come from the patched component.
 */
defineProps<{ label: string; collapsible?: boolean }>()
</script>

<template>
  <Accordion v-if="collapsible" type="single" collapsible as="div">
    <AccordionItem :value="label" class="border-b-0">
      <!-- The chevron comes from the patched trigger; only the rail's own sizing is set here,
           and `flex-row-reverse` puts it in front of the label. -->
      <AccordionTrigger
        class="flex-row-reverse items-center justify-end gap-[5px] py-0 text-[12.5px] font-semibold text-ink-4 hover:text-ink-2 hover:no-underline [&_svg]:size-[13px] [&_svg]:translate-y-0"
      >
        {{ label }}
      </AccordionTrigger>
      <AccordionContent class="pt-2.5 pb-0 text-[12.5px]">
        <slot />
      </AccordionContent>
    </AccordionItem>
  </Accordion>

  <div v-else>
    <div class="mb-2.5 text-[12.5px] font-semibold text-ink-4">{{ label }}</div>
    <slot />
  </div>
</template>

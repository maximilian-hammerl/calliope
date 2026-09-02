<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

/**
 * One block of either rail. Collapsible where the rail exists as a rail, plain where it does
 * not: in the mobile sheet the blocks are simply stacked, because a sheet the member opened on
 * purpose is not the thing that was distracting them.
 *
 * Closed to start, and the choice is not remembered — the rail is reference material a member
 * reaches for, not a workspace to arrange. `openStart` is the exception, for a block that is
 * navigation rather than reference: closed, it hides the only way between a group's threads and
 * pages.
 *
 * One accordion per block rather than one holding all three, so several can stand open at once
 * without the views having to wrap them. Only the rail's sizing is set on the trigger; the
 * disclosure chevrons come from the patched component.
 *
 * `meta` is the one number a closed block may still show — „3 offen" beside Nächste Schritte,
 * which is what says whether opening it is worth it.
 */
defineProps<{
  label: string
  collapsible?: boolean
  meta?: string
  openStart?: boolean
}>()
</script>

<template>
  <Accordion
    v-if="collapsible"
    type="single"
    collapsible
    as="div"
    :default-value="openStart ? label : undefined"
  >
    <AccordionItem :value="label" class="border-b-0">
      <!-- The chevron comes from the patched trigger; only the rail's own sizing is set here,
           and `flex-row-reverse` puts it in front of the label. Label and meta are one flex
           item, or the reversal would render the count first. -->
      <AccordionTrigger
        class="flex-row-reverse items-center justify-end gap-[5px] py-0 text-[12.5px] font-semibold text-ink-4 hover:text-ink-2 hover:no-underline [&_svg]:size-[13px] [&_svg]:translate-y-0"
      >
        <span class="flex items-baseline gap-2">
          {{ label }}
          <span v-if="meta" class="text-[11.5px] font-normal text-ink-5">{{ meta }}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent class="pt-2.5 pb-0 text-[12.5px]">
        <slot />
      </AccordionContent>
    </AccordionItem>
  </Accordion>

  <div v-else>
    <div class="mb-2.5 flex items-baseline gap-2">
      <span class="text-[12.5px] font-semibold text-ink-4">{{ label }}</span>
      <span v-if="meta" class="text-[11.5px] text-ink-5">{{ meta }}</span>
    </div>
    <slot />
  </div>
</template>

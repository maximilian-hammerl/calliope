<script setup lang="ts">
/**
 * One filter: its label, and the options behind a disclosure. Open to begin with — a filter
 * nobody finds is the mistake discovery already made once — and collapsible so a member who is
 * not filtering can have the space back, which is worth most on a phone.
 *
 * **Both `FilterStrip` and the story vocabularies render through this**, because they did not
 * before: the label ended up in the heading serif on one and the UI sans on the other, and
 * nothing but a screenshot would have said so.
 *
 * A hidden label renders no disclosure at all. The two strips that use one are the view
 * switchers — „Karussell | Meine Ideen | Ideen entdecken" — which are navigation rather than
 * filters, and a collapsible one would have nothing visible to click.
 */
import { computed, inject, useId } from 'vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FILTER_STRIP_GROUP } from './filterStripGroup'

const props = defineProps<{
  label: string
  /** Draw the label for screen readers only, and with it the disclosure. */
  hideLabel?: boolean
  /**
   * What this filter is doing, shown beside the label — „3 gewählt" for a vocabulary, „aktiv"
   * for a strip that has been moved off its default. Absent when the filter narrows nothing.
   *
   * A shut section has nothing else to say that it is still narrowing the list, and a filter
   * that hides while it filters is how somebody concludes the board is empty.
   */
  chosen?: string
  /**
   * Start shut. Only for a section long enough that opening it costs the page — the tropes are
   * thirty-one options and four rows, which pushed the search field and the list off the screen.
   * A filter nobody finds is the worse failure, so this is the exception rather than the default.
   */
  initiallyShut?: boolean
}>()

/**
 * Per instance rather than from the label: two strips with the same word collided on the one
 * screen that shows both — the chats dialog's „Favoriten" over the groups list's.
 */
const labelId = useId()

const inGroup = inject(FILTER_STRIP_GROUP, false)

/**
 * Inside a `FilterStrips` both cells dissolve into that grid, so every filter on the page shares
 * one label column.
 *
 * The columns are explicit rather than left to auto-flow, because the grid holds more than these
 * pairs: the reset button is a child of it too, and a strip with a hidden label contributes one
 * cell instead of two. Any of those shifts the cursor, and from there every label lands in the
 * options column and every set of options under the label above it.
 */
const layout = computed<string>(() =>
  inGroup
    ? // Descendant, not child: the accordion root holds an item that also disappears, so the
      // header and the content are grandchildren of the element these are written on.
      'md:contents md:[&_h3]:col-start-1 md:[&_h3]:self-start ' +
      'md:[&_[data-slot=accordion-content]]:col-start-2 ' +
      'md:[&_[data-slot=accordion-content]]:self-start'
    : 'md:grid md:grid-cols-[max-content_1fr] md:items-start md:gap-x-4',
)

/**
 * The strip's own label: quiet sans, not the heading face. Two things override it — reka wraps
 * every trigger in an `h3`, which the base layer sets in Newsreader, and shadcn's
 * `text-sm font-medium` wins the class merge.
 */
const TRIGGER =
  'flex-row-reverse justify-end gap-1.5 py-2 font-sans text-[12.5px] font-normal ' +
  'text-ink-5 hover:no-underline md:py-0 md:pt-[3px]'
</script>

<template>
  <div v-if="hideLabel" :class="inGroup ? 'md:col-span-2' : ''">
    <span :id="labelId" class="sr-only">{{ label }}</span>
    <slot :label-id="labelId" />
  </div>

  <Accordion
    v-else
    type="single"
    collapsible
    as="div"
    :default-value="initiallyShut ? undefined : 'open'"
    :class="['flex flex-col', layout]"
  >
    <AccordionItem value="open" class="contents border-b-0">
      <AccordionTrigger :class="TRIGGER">
        <span class="flex items-baseline gap-2">
          <span :id="labelId">{{ label }}</span>
          <!-- Darker than the label: it is the one sign that a shut section is still narrowing. -->
          <span v-if="chosen !== undefined" class="text-ink-2">{{ chosen }}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent class="pt-1 pb-2 md:pt-0">
        <slot :label-id="labelId" />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>

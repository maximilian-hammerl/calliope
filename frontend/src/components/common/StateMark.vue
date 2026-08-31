<script setup lang="ts">
/**
 * A glyph where a word chip would go, for a state a row states about itself. The chrome lives here
 * rather than in each mark: the size, the `mark` variant and — the part worth forgetting — the
 * accessible name, since these are the only icons in the interface that are not `aria-hidden`.
 *
 * `title` sits on the badge rather than the `<svg>`, where it is not a tooltip: SVG reads a
 * `<title>` child instead. Hover is desktop-only, so `aria-label` is what carries a phone.
 *
 * **`interactive` makes it open on a tap**, which is the phone's answer to that hover: beta
 * testers clicked these marks with no expectation of what would happen, which is what people do
 * with an unlabelled glyph. The popover answers the question the click is asking, in the word the
 * mark already carries — a mark needing a sentence would be the wrong mark.
 *
 * It is opt-in because half the marks sit inside something that is already one target: a search
 * result is a link and a chat row is a button, and a button inside either is invalid HTML that
 * the browser unnests. Forgetting the flag there costs a tooltip; a default of on would cost a
 * broken row.
 */
import type { Component } from 'vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

defineProps<{ icon: Component; label: string; interactive?: boolean }>()

// Reka's `Popover` renders no element of its own, so a class from the row would evaporate rather
// than fall through. The rows space these with `ml-3`.
defineOptions({ inheritAttrs: false })
</script>

<template>
  <CalliopeBadge
    v-if="!interactive"
    variant="mark"
    :title="label"
    :aria-label="label"
    role="img"
    class="shrink-0"
    v-bind="$attrs"
  >
    <component :is="icon" :size="13" :stroke-width="1.5" aria-hidden="true" />
  </CalliopeBadge>

  <Popover v-else>
    <PopoverTrigger as-child>
      <!-- No box of its own: the rows space these with `ml-3`, so padding here would widen the
           mark and a negative margin would eat that margin — which it did, leaving two marks
           touching. The hit area is an `::after`, which is outside the flow entirely.

           **It is 37×33, and the phone rule is 44.** That is a breach, not an exception — the
           design system states the rule without one, and the radio and the checkbox meet it
           through a `min-h-11` label wrapping box and text together. A mark has no such wrapper,
           and 44px here would space the rows by the target rather than by the type. Open: either
           the marks stop being buttons, or the rows are laid out to afford one. -->
      <button
        type="button"
        class="relative inline-flex cursor-pointer rounded-sm align-bottom after:absolute after:-inset-1.5 after:content-['']"
        :title="label"
        :aria-label="label"
        v-bind="$attrs"
      >
        <CalliopeBadge variant="mark" class="shrink-0">
          <component :is="icon" :size="13" :stroke-width="1.5" aria-hidden="true" />
        </CalliopeBadge>
      </button>
    </PopoverTrigger>

    <!-- Sized to its word rather than the default 18rem: this says what the glyph means and
         nothing more, so a fixed width would be a box mostly of air. Only the width is
         overridden — the generated `max-w` is reka's available width, which is what keeps the
         box on screen when a mark sits near the edge on a phone. -->
    <PopoverContent class="w-auto px-3 py-2 text-note text-ink-2">
      {{ label }}
    </PopoverContent>
  </Popover>
</template>

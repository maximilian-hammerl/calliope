<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

/**
 * What to expect after we mail a link, in one place: a tester found an empty inbox and had no
 * way to tell a slow delivery from a broken feature.
 *
 * Six surfaces say a link is on its way, and the sentence has to be the same at all of them —
 * which is why it lives here rather than being written six times. The validity is deliberately
 * vague: the exact lifetime is a backend constant the frontend cannot read, and a number that
 * drifted from it would be worse than none.
 *
 * It names the E-Mail rather than saying "das": under the deletion notice, "das kann ein paar
 * Minuten dauern" read as the deletion taking minutes. "Nachricht" is not available — that is
 * what chat messages are called.
 */
const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <p :class="cn('text-note text-ink-5', props.class)">
    Die E-Mail kann ein paar Minuten brauchen. Kommt nichts an, sieh auch im Spam-Ordner nach. Links
    gelten nur kurze Zeit.
  </p>
</template>

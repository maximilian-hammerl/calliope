<script setup lang="ts">
/**
 * Clears every filter on the page back to what it opens with — not only the vocabularies, which
 * is what it did while it lived inside them: the strips beside it kept whatever they were set to
 * and the list stayed narrowed after a member had asked for it not to be.
 *
 * The state belongs to the view, so the view decides what "cleared" means and says whether
 * anything is set; this owns the wording and the placement, which were the parts worth sharing.
 */
import { Button } from '@/components/ui/button'

defineProps<{ active: boolean }>()

defineEmits<{ reset: [] }>()
</script>

<template>
  <!--
    Only once something is set: a control that does nothing is one more thing to read past.
    Placed in the options column explicitly, or it takes whichever cell is free and moves as
    sections open and shut.
  -->
  <div v-if="active" class="pt-3 md:col-start-2">
    <Button variant="outline" size="sm" @click="$emit('reset')">Filter zurücksetzen</Button>
  </div>
</template>

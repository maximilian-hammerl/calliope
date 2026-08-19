<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
defineProps<{ side: 'left' | 'right'; label: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <!-- Both rails collapse to the identical 34px strip, and the strip is the affordance to
       reopen. The chevron points where the rail will go. -->
  <button
    type="button"
    class="w-[34px] flex-none flex-col items-center gap-[14px] bg-paper-edge pt-4 text-ink-label"
    :class="side === 'left' ? 'border-r border-line-3' : 'border-l border-line-3'"
    :title="`${label} einblenden`"
    @click="$emit('click')"
  >
    <ChevronRight v-if="side === 'left'" :size="14" :stroke-width="1.5" />
    <ChevronLeft v-else :size="14" :stroke-width="1.5" />
    <span
      class="font-mono text-[10.5px] font-semibold tracking-[0.14em] uppercase [writing-mode:vertical-rl]"
    >
      {{ label }}
    </span>
  </button>
</template>

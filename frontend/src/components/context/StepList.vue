<script setup lang="ts">
import PanelCard from '@/components/PanelCard.vue'

// Placeholder: "Nächste Schritte" has no backend yet, so these are fixed examples and
// nothing can be ticked. Kept because the rail's shape is part of the accepted design.
const PLACEHOLDER_STEPS = [
  { text: 'Keshs Motiv festlegen', author: 'Bob' },
  { text: 'Kapitel 2 anlegen', author: 'Alice' },
] as const
</script>

<template>
  <div>
    <div class="mb-[10px] flex items-baseline gap-2">
      <span class="text-[12.5px] font-semibold text-ink-4">Nächste Schritte</span>
      <span class="text-[11.5px] text-ink-5">2 offen</span>
    </div>

    <div class="flex flex-col gap-[6px]">
      <PanelCard v-for="step in PLACEHOLDER_STEPS" :key="step.text">
        <div class="flex items-start gap-2">
          <span class="text-ink-6">☐</span>
          <span class="flex-1">
            {{ step.text }}
            <br />
            <span class="text-[11.5px] text-ink-6">von {{ step.author }}</span>
          </span>
        </div>
      </PanelCard>
    </div>

    <button
      type="button"
      disabled
      title="Noch nicht verfügbar"
      class="mt-[9px] rounded-lg border border-line-5 bg-paper-3 px-[10px] py-[5px] text-[12.5px] font-medium text-oak-deep disabled:opacity-50"
    >
      ＋ Schritt
    </button>
  </div>
</template>

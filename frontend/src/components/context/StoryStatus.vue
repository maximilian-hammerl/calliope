<script setup lang="ts">
// Placeholder: status, genre and perspective are not columns on writing_group, so every
// value here is invented. The card exists because the design asks for it.
const PLACEHOLDER_FIELDS = [
  { label: 'Status', value: 'Wird geschrieben', strong: true },
  { label: 'Genre', value: 'Noch nicht gesetzt', strong: false },
  { label: 'Perspektive', value: 'Noch nicht gesetzt', strong: false },
] as const
</script>

<template>
  <div>
    <div class="mb-[10px] text-[12.5px] font-semibold text-ink-4">Story-Status</div>
    <div class="text-[12.5px] leading-[1.95] text-ink-4">
      <div v-for="field in PLACEHOLDER_FIELDS" :key="field.label">
        <span class="text-ink-6">{{ field.label }}:&nbsp;</span>
        <span :class="field.strong ? 'font-medium' : ''">{{ field.value }}</span>
      </div>
    </div>
  </div>
</template>

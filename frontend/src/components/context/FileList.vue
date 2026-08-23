<script setup lang="ts">
// Placeholder: there is no file storage yet. File types are mono text, never an icon.
const PLACEHOLDER_FILES = [
  { name: 'stadtkarte.png', type: 'PNG' },
  { name: 'zeitleiste.md', type: 'MD' },
] as const
</script>

<template>
  <div>
    <div class="flex flex-col gap-1.5 text-[12.5px] text-ink-4">
      <div v-for="file in PLACEHOLDER_FILES" :key="file.name" class="flex items-baseline gap-2">
        <span class="font-mono text-[10.5px] text-ink-6">{{ file.type }}</span>
        <span class="truncate">{{ file.name }}</span>
      </div>
    </div>
  </div>
</template>

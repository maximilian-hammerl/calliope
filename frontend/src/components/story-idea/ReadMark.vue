<script setup lang="ts">
/**
 * `BookCheck`, not `BookOpenCheck`: an open book reads as *being* read, and its page curves plus
 * the check are dense at 13px.
 */
import { BookCheck } from '@lucide/vue'
import StateMark from '@/components/common/StateMark.vue'
</script>

<template>
  <StateMark :icon="BookCheck" label="Gelesen" />
</template>

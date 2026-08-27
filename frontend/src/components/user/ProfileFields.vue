<script setup lang="ts">
/** Only the fields answered: a label over nothing reads as the page being broken. */
import { computed } from 'vue'
import type { ProfileFieldKey } from '@/lib/profile/profileFields'
import { answeredFields } from '@/lib/profile/profileFields'

const props = defineProps<{
  profile: Partial<Record<ProfileFieldKey, string | null>>
}>()

const answered = computed(() => answeredFields(props.profile))
</script>

<template>
  <dl v-if="answered.length > 0" class="mt-8 flex flex-col">
    <div
      v-for="field in answered"
      :key="field.key"
      class="max-w-[60ch] border-t border-line-3 py-5"
    >
      <dt class="text-[12.5px] font-semibold text-ink-3">{{ field.label }}</dt>
      <!-- As typed: some of these answers are written as a list of lines. -->
      <dd class="mt-1 text-note whitespace-pre-wrap text-ink-2">{{ field.value }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CalliopeBadge from '@/components/CalliopeBadge.vue'
import { countLabel } from '@/lib/formatTime'

const props = defineProps<{
  title: string
  visibility: 'private' | 'public'
  threadCount?: number
}>()

const visibilityLabel = computed<string>(() =>
  props.visibility === 'private' ? 'Privat' : 'Öffentlich',
)
</script>

<template>
  <div class="px-[18px] pt-5 md:px-10">
    <div class="flex flex-wrap items-baseline gap-3">
      <!-- A group title is 25px Newsreader regular, never bold. -->
      <h1 class="text-[25px] leading-[1.2] text-ink-1">{{ title }}</h1>
      <CalliopeBadge>{{ visibilityLabel }}</CalliopeBadge>
      <span v-if="threadCount !== undefined" class="text-[11.5px] whitespace-nowrap text-ink-5">
        {{ countLabel(threadCount, 'Thread', 'Threads') }}
      </span>
    </div>
  </div>
</template>

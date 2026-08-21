<script setup lang="ts">
import type { ListStoryIdeas200ResultsItem } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import { IDEA_STATUS_LABELS, LANGUAGE_LABELS } from '@/lib/format/storyIdea'
import { READER_STATE_LABELS } from '@/lib/format/storyIdea'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

defineProps<{ idea: ListStoryIdeas200ResultsItem }>()
</script>

<template>
  <div class="py-[26px]">
    <div class="text-[20px] leading-[1.3]">
      <RouterLink
        :to="{ name: 'storyIdea', params: { ideaId: idea.id } }"
        class="text-ink-1 underline-offset-[6px] hover:underline"
      >
        {{ idea.title }}
      </RouterLink>
      <!-- Open is the board's resting state and says nothing; the others are worth a mark. -->
      <CalliopeBadge v-if="idea.status !== 'open'" class="ml-3">
        {{ IDEA_STATUS_LABELS[idea.status] }}
      </CalliopeBadge>
      <CalliopeBadge v-if="idea.readerState !== null" class="ml-3">
        {{ READER_STATE_LABELS[idea.readerState] }}
      </CalliopeBadge>
      <CalliopeBadge v-if="idea.language !== 'german'" class="ml-3">
        {{ LANGUAGE_LABELS[idea.language] }}
      </CalliopeBadge>
    </div>

    <p v-if="idea.subtitle" class="mt-[4px] max-w-[60ch] text-[13.5px] leading-[1.5] text-ink-3">
      {{ idea.subtitle }}
    </p>

    <p class="mt-[6px] line-clamp-3 max-w-[60ch] text-[13px] leading-[1.6] text-ink-4">
      {{ idea.idea }}
    </p>

    <div class="mt-[6px] text-[12.5px] leading-[1.95] text-ink-5">
      von
      <RouterLink
        :to="{ name: 'member', params: { userId: idea.createdBy } }"
        class="underline-offset-[6px] hover:underline"
      >
        {{ idea.createdByUsername }}
      </RouterLink>
      · {{ formatActivityTime(idea.createdAt) }}
    </div>
  </div>
</template>

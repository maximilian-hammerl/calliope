<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed } from 'vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { countLabel } from '@/lib/format/formatTime'

const props = defineProps<{
  title: string
  visibility: 'private' | 'public'
  threadCount?: number
  // Given only where the header is not already the group's own page: the way back from a
  // thread. On the group page the title is the page's own heading and links nowhere.
  groupId?: string
}>()

const visibilityLabel = computed<string>(() =>
  props.visibility === 'private' ? 'Privat' : 'Öffentlich',
)
</script>

<template>
  <div class="px-[18px] pt-5 md:px-10">
    <!-- The way back. The rail used to list every group; now the overview is where one
         switches, so every group page needs a door to it. -->
    <div class="reading-column">
      <RouterLink
        :to="{ name: 'groups' }"
        class="inline-flex min-h-11 items-center gap-[3px] text-[12.5px] text-ink-5 hover:text-oak-deep md:min-h-0"
      >
        <ChevronLeft :size="14" :stroke-width="1.5" />
        Meine Gruppen
      </RouterLink>
    </div>

    <div class="reading-column flex flex-wrap items-baseline gap-3">
      <!-- A group title is 25px Newsreader regular, never bold. -->
      <h1 class="text-[25px] leading-[1.2] text-ink-1">
        <RouterLink
          v-if="groupId !== undefined"
          :to="{ name: 'group', params: { groupId } }"
          class="underline-offset-[6px] hover:underline"
        >
          {{ title }}
        </RouterLink>
        <template v-else>{{ title }}</template>
      </h1>
      <CalliopeBadge>{{ visibilityLabel }}</CalliopeBadge>
      <span v-if="threadCount !== undefined" class="text-[11.5px] whitespace-nowrap text-ink-5">
        {{ countLabel(threadCount, 'Thread', 'Threads') }}
      </span>
    </div>
  </div>
</template>

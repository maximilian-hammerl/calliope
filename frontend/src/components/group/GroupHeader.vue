<script setup lang="ts">
import { computed } from 'vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

const props = defineProps<{
  title: string
  visibility: 'private' | 'public'
  subtitle?: string | null
  // Given only where the header is not already the group's own page: the way back from a
  // thread. On the group page the title is the page's own heading and links nowhere.
  groupId?: string
}>()

const visibilityLabel = computed<string>(() =>
  props.visibility === 'private' ? 'Privat' : 'Öffentlich',
)
</script>

<template>
  <div class="px-gutter pt-5 md:px-10">
    <div class="reading-column">
      <!-- A group title is 25px Newsreader regular, never bold. The badge sits inside the
           heading rather than beside it: as a flex sibling it dropped to a third line
           whenever the title wrapped to two, with room to spare on the second. -->
      <h1 class="text-h1 text-ink-1">
        <RouterLink
          v-if="groupId !== undefined"
          :to="{ name: 'group', params: { groupId } }"
          class="underline-offset-[6px] hover:underline"
        >
          {{ title }}
        </RouterLink>
        <template v-else>{{ title }}</template>
        <CalliopeBadge class="ml-3">{{ visibilityLabel }}</CalliopeBadge>
      </h1>
    </div>

    <p v-if="subtitle" class="reading-column mt-1 text-note text-ink-3">
      {{ subtitle }}
    </p>
  </div>
</template>

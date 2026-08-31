<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { VISIBILITY_ICONS, VISIBILITY_LABELS } from '@/lib/format/group'

const props = defineProps<{
  title: string
  visibility: 'private' | 'public'
  subtitle?: string | null
  // Given only where the header is not already the group's own page: the way back from a
  // thread. On the group page the title is the page's own heading and links nowhere.
  groupId?: string
}>()

/**
 * The word *and* the mark: on the group's own page this is the subject, and it is where a member
 * meets the word the lock in a list stands for. The word alone was here for a while, which left
 * the two never appearing together — so nothing said they were the same fact, and testers clicked
 * the lock in a list to find out what it was.
 */
const visibilityLabel = computed<string>(() => VISIBILITY_LABELS[props.visibility])

const visibilityIcon = computed<Component>(() => VISIBILITY_ICONS[props.visibility])
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
        <CalliopeBadge class="ml-3 inline-flex items-center gap-1.5">
          <!-- Decorative: the word beside it is the accessible name already. -->
          <component :is="visibilityIcon" :size="13" :stroke-width="1.5" aria-hidden="true" />
          {{ visibilityLabel }}
        </CalliopeBadge>
      </h1>
    </div>

    <p v-if="subtitle" class="reading-column mt-1 text-note text-ink-3">
      {{ subtitle }}
    </p>
  </div>
</template>

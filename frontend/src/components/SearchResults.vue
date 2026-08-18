<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Search200 } from '@/api/models'
import { countLabel } from '@/lib/formatTime'
import { cn } from '@/lib/utils'
import CalliopeBadge from '@/components/CalliopeBadge.vue'

const props = defineProps<{
  results: Search200 | undefined
  isSearching: boolean
  termIsLongEnough: boolean
  minimumLength: number
  class?: string
}>()

/**
 * A section is left out entirely when it found nothing, rather than shown empty — three
 * headings over three "keine Treffer" lines is noise around the one section that matched.
 */
const sections = computed(() =>
  [
    { key: 'groups', heading: 'Gruppen', section: props.results?.groups },
    { key: 'threads', heading: 'Threads', section: props.results?.threads },
    { key: 'users', heading: 'Mitglieder', section: props.results?.users },
  ].filter((entry) => (entry.section?.results.length ?? 0) > 0),
)

const foundNothing = computed<boolean>(
  () => props.results !== undefined && !props.isSearching && sections.value.length === 0,
)

/** How many were found beyond the few shown, so an imprecise search says so. */
function remaining(shown: number, total: number): number {
  return Math.max(0, total - shown)
}

function groupTarget(id: string): RouteLocationRaw {
  return { name: 'group', params: { groupId: id } }
}

function threadTarget(groupId: string, threadId: string): RouteLocationRaw {
  return { name: 'thread', params: { groupId, threadId } }
}
</script>

<template>
  <div :class="cn('flex flex-col', props.class)" data-slot="search-results">
    <p v-if="!termIsLongEnough" class="px-[14px] py-[11px] text-[12.5px] text-ink-5">
      Gib mindestens {{ minimumLength }} Zeichen ein.
    </p>

    <p v-else-if="isSearching" class="px-[14px] py-[11px] text-[12.5px] text-ink-5">
      Wird gesucht …
    </p>

    <p v-else-if="foundNothing" class="px-[14px] py-[11px] text-[12.5px] text-ink-5">
      Nichts gefunden.
    </p>

    <template v-else>
      <div
        v-for="entry in sections"
        :key="entry.key"
        class="border-t border-line-2 first:border-t-0"
      >
        <div class="px-[14px] pt-[10px] pb-[6px] text-[11.5px] font-semibold text-ink-5">
          {{ entry.heading }}
        </div>

        <!-- Groups and threads lead somewhere; a member does not yet, so it is not a link. -->
        <template v-if="entry.key === 'groups'">
          <RouterLink
            v-for="group in results?.groups.results"
            :key="group.id"
            :to="groupTarget(group.id)"
            class="flex min-h-[38px] items-center gap-2 px-[14px] py-[7px] text-[13px] text-ink-2 hover:bg-paper-2"
          >
            <span class="truncate">{{ group.title }}</span>
            <CalliopeBadge>
              {{ group.visibility === 'private' ? 'Privat' : 'Öffentlich' }}
            </CalliopeBadge>
          </RouterLink>
        </template>

        <template v-else-if="entry.key === 'threads'">
          <RouterLink
            v-for="thread in results?.threads.results"
            :key="thread.id"
            :to="threadTarget(thread.writingGroupId, thread.id)"
            class="flex min-h-[38px] flex-col justify-center px-[14px] py-[7px] hover:bg-paper-2"
          >
            <span class="truncate text-[13px] text-ink-2">{{ thread.title }}</span>
            <!-- A result that can come from anywhere says where it came from. -->
            <span class="truncate text-[11.5px] text-ink-6">{{ thread.writingGroupTitle }}</span>
          </RouterLink>
        </template>

        <template v-else>
          <div
            v-for="user in results?.users.results"
            :key="user.id"
            class="flex min-h-[38px] items-center px-[14px] py-[7px] text-[13px] text-ink-2"
          >
            {{ user.username }}
          </div>
        </template>

        <p
          v-if="
            entry.section && remaining(entry.section.results.length, entry.section.totalResults) > 0
          "
          class="px-[14px] pt-[2px] pb-[9px] text-[11.5px] text-ink-6"
        >
          {{
            countLabel(
              remaining(entry.section.results.length, entry.section.totalResults),
              'weiterer Treffer',
              'weitere Treffer',
            )
          }}
        </p>
      </div>
    </template>
  </div>
</template>

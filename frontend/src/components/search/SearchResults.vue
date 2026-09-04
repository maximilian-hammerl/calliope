<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Search200 } from '@/api/models'
import { pluralize } from '@/lib/format/formatText'
import { leafRoute } from '@/lib/folder/treeScope'
import type { WriteScope } from '@/lib/folder/treeScope'
import { cn } from '@/lib/utils'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'
import ForumPermissionMark from '@/components/forum/ForumPermissionMark.vue'
import { MEMBERSHIP_LABELS } from '@/lib/format/group'
import VisibilityMark from '@/components/group/VisibilityMark.vue'
import StatusMark from '@/components/story-idea/StatusMark.vue'
import ReadMark from '@/components/story-idea/ReadMark.vue'
import { useGetCurrentUser } from '@/api/auth/auth'
import { platformRoleLabel } from '@/lib/format/platformRole'
import { useIsOperator } from '@/composables/useIsOperator'

const { data: userData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data.id : undefined,
)

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
    { key: 'threads', heading: 'Themen', section: props.results?.threads },
    // Directly after its counterpart rather than in a block of its own: ‚Themen‘ above
    // ‚Themen im Forum‘ is what says the first means a group, without spending a word on it.
    // Unqualified where nothing sits beside it, since a section with no results is left out.
    { key: 'forumThreads', heading: 'Themen im Forum', section: props.results?.forumThreads },
    { key: 'pages', heading: 'Seiten', section: props.results?.pages },
    { key: 'forumPages', heading: 'Seiten im Forum', section: props.results?.forumPages },
    { key: 'storyIdeas', heading: 'Storyideen', section: props.results?.storyIdeas },
    { key: 'users', heading: 'Mitglieder', section: props.results?.users },
  ].filter((entry) => (entry.section?.results.length ?? 0) > 0),
)

/** Null for a group the reader has not joined, which takes no chip — see `MEMBERSHIP_LABELS`. */
function membershipLabel(status: string | null): string | undefined {
  return status === 'joined' || status === 'invited' ? MEMBERSHIP_LABELS[status] : undefined
}

const foundNothing = computed<boolean>(
  () => props.results !== undefined && !props.isSearching && sections.value.length === 0,
)

/** How many were found beyond the few shown, so an imprecise search says so. */
function remaining(shown: number, total: number): number {
  return Math.max(0, total - shown)
}

/** Only an operator is shown what members may do, as in the tree and the rail. */
const isOperator = useIsOperator()

function groupTarget(id: string): RouteLocationRaw {
  return { name: 'group', params: { groupId: id } }
}

/**
 * The tree's own function, so a result row and a row of the forum's tree cannot come to disagree
 * about where a thread lives. A group result carries its scope; the forum's section implies one.
 */
function leafTarget(scope: WriteScope, kind: 'thread' | 'page', id: string): RouteLocationRaw {
  return leafRoute(scope, { kind, id })
}
</script>

<template>
  <div :class="cn('flex flex-col', props.class)" data-slot="search-results">
    <p v-if="!termIsLongEnough" class="px-3.5 py-[11px] text-[12.5px] text-ink-5">
      Gib mindestens {{ minimumLength }} Zeichen ein.
    </p>

    <p v-else-if="isSearching" class="px-3.5 py-[11px] text-[12.5px] text-ink-5">Wird gesucht …</p>

    <p v-else-if="foundNothing" class="px-3.5 py-[11px] text-[12.5px] text-ink-5">
      Nichts gefunden.
    </p>

    <template v-else>
      <div
        v-for="entry in sections"
        :key="entry.key"
        class="border-t border-line-2 first:border-t-0"
      >
        <div class="px-3.5 pt-2.5 pb-1.5 text-[11.5px] font-semibold text-ink-5">
          {{ entry.heading }}
        </div>

        <!-- Every kind of result leads somewhere; a member to their profile. -->
        <template v-if="entry.key === 'groups'">
          <RouterLink
            v-for="group in results?.groups.results"
            :key="group.id"
            :to="groupTarget(group.id)"
            class="flex min-h-[38px] items-center gap-2 px-3.5 py-[7px] text-[13px] text-ink-2 hover:bg-paper-2"
          >
            <span class="truncate">{{ group.title }}</span>
            <VisibilityMark :visibility="group.visibility" />
            <!-- Search reaches past the groups you belong to, and nothing else on the row says
                 which side of that line a result is on. -->
            <CalliopeBadge v-if="membershipLabel(group.status)" variant="tag">
              {{ membershipLabel(group.status) }}
            </CalliopeBadge>
            <FavouriteMark v-if="group.isFavourite" />
          </RouterLink>
        </template>

        <template v-else-if="entry.key === 'threads'">
          <RouterLink
            v-for="thread in results?.threads.results"
            :key="thread.id"
            :to="leafTarget({ kind: 'group', groupId: thread.writingGroupId }, 'thread', thread.id)"
            class="flex min-h-[38px] flex-col justify-center px-3.5 py-[7px] hover:bg-paper-2"
          >
            <span class="flex items-center gap-2 text-[13px] text-ink-2">
              <span class="truncate">{{ thread.title }}</span>
              <FavouriteMark v-if="thread.isFavourite" />
            </span>
            <!-- A result that can come from anywhere says where it came from. -->
            <span class="truncate text-[11.5px] text-ink-6">{{ thread.writingGroupTitle }}</span>
          </RouterLink>
        </template>

        <!-- One line, where a group's row has two: the heading has already said where this is. -->
        <template v-else-if="entry.key === 'forumThreads'">
          <RouterLink
            v-for="thread in results?.forumThreads.results"
            :key="thread.id"
            :to="leafTarget({ kind: 'forum' }, 'thread', thread.id)"
            class="flex min-h-[38px] flex-col justify-center px-3.5 py-[7px] hover:bg-paper-2"
          >
            <span class="flex items-center gap-2 text-[13px] text-ink-2">
              <span class="truncate">{{ thread.title }}</span>
              <FavouriteMark v-if="thread.isFavourite" />
              <!-- An operator's search reaches hidden rows, so a row has to say when it is one. -->
              <ForumPermissionMark
                v-if="isOperator"
                :permission="thread.effectiveMemberPermission"
              />
            </span>
          </RouterLink>
        </template>

        <!-- A page can match on its prose, but the row shows a title like every other kind's. -->
        <template v-else-if="entry.key === 'pages'">
          <RouterLink
            v-for="page in results?.pages.results"
            :key="page.id"
            :to="leafTarget({ kind: 'group', groupId: page.writingGroupId }, 'page', page.id)"
            class="flex min-h-[38px] flex-col justify-center px-3.5 py-[7px] hover:bg-paper-2"
          >
            <span class="flex items-center gap-2 text-[13px] text-ink-2">
              <span class="truncate">{{ page.title }}</span>
              <FavouriteMark v-if="page.isFavourite" />
            </span>
            <span class="truncate text-[11.5px] text-ink-6">{{ page.writingGroupTitle }}</span>
          </RouterLink>
        </template>

        <template v-else-if="entry.key === 'forumPages'">
          <RouterLink
            v-for="page in results?.forumPages.results"
            :key="page.id"
            :to="leafTarget({ kind: 'forum' }, 'page', page.id)"
            class="flex min-h-[38px] flex-col justify-center px-3.5 py-[7px] hover:bg-paper-2"
          >
            <span class="flex items-center gap-2 text-[13px] text-ink-2">
              <span class="truncate">{{ page.title }}</span>
              <FavouriteMark v-if="page.isFavourite" />
              <ForumPermissionMark v-if="isOperator" :permission="page.effectiveMemberPermission" />
            </span>
          </RouterLink>
        </template>

        <template v-else-if="entry.key === 'storyIdeas'">
          <RouterLink
            v-for="idea in results?.storyIdeas.results"
            :key="idea.id"
            :to="{ name: 'storyIdea', params: { ideaId: idea.id } }"
            class="flex min-h-[38px] items-center gap-2 px-3.5 py-[7px] text-[13px] text-ink-2 hover:bg-paper-2"
          >
            <span class="truncate">{{ idea.title }}</span>
            <!-- The idea's own state, always shown, as everywhere else. „Von dir" stays
                 one-sided: whose idea it is is a fact about the reader, not about the idea. -->
            <StatusMark :status="idea.status" />
            <CalliopeBadge v-if="idea.createdBy === currentUserId">Von dir</CalliopeBadge>
            <ReadMark v-if="idea.isRead" />
            <FavouriteMark v-if="idea.isFavourite" />
          </RouterLink>
        </template>

        <template v-else>
          <RouterLink
            v-for="user in results?.users.results"
            :key="user.id"
            :to="{ name: 'member', params: { userId: user.id } }"
            class="flex min-h-[38px] items-center gap-2 px-3.5 py-[7px] text-[13px] text-ink-2 hover:bg-paper-2"
          >
            <span class="truncate">{{ user.username }}</span>
            <span
              v-if="platformRoleLabel(user.platformRole)"
              class="shrink-0 text-[12px] whitespace-nowrap text-ink-5"
            >
              {{ platformRoleLabel(user.platformRole) }}
            </span>
          </RouterLink>
        </template>

        <p
          v-if="
            entry.section && remaining(entry.section.results.length, entry.section.totalResults) > 0
          "
          class="px-3.5 pt-0.5 pb-[9px] text-[11.5px] text-ink-6"
        >
          {{
            pluralize(
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

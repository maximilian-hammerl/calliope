<script setup lang="ts">
import { computed } from 'vue'
import { Flag, Pencil, Trash2 } from '@lucide/vue'
import { formatActivityTime } from '@/lib/format/formatTime'
import { Button } from '@/components/ui/button'
import FavouriteToggle from '@/components/favourite/FavouriteToggle.vue'
import { pluralize } from '@/lib/format/formatText'

const props = defineProps<{
  title: string
  postCount?: number
  lastActivityAt?: string
  /** Whoever started the thread, or an administrator: the rule `mayModify` gives content. */
  mayModify?: boolean
  /** The thread itself, so the reader's own favourite has somewhere to hang. */
  threadId?: string
  isFavourite?: boolean
}>()

defineEmits<{ rename: []; delete: []; report: []; favouriteChanged: [] }>()

// Numbers always carry a noun: a bare badge number was tested and misread.
const meta = computed<string>(() =>
  [
    props.postCount === undefined ? undefined : pluralize(props.postCount, 'Beitrag', 'Beiträge'),
    props.lastActivityAt === undefined
      ? undefined
      : `zuletzt ${formatActivityTime(props.lastActivityAt)}`,
  ]
    .filter((part) => part !== undefined)
    .join(' · '),
)
</script>

<template>
  <!-- The post filter the design system specifies is now under this header, beside the order
       toggle and page strip it belongs with. It carries one of its two options: Favoriten, since
       favouriting a post exists. Mit Anmerkungen joins it with #38. -->
  <div class="mb-7 flex flex-wrap items-start gap-x-4 gap-y-2">
    <!-- Full width on a phone so the actions wrap under it: sharing the row squeezed
         "1 Beitrag · zuletzt vor 2 Minuten" onto three lines at 375px. -->
    <div class="w-full min-w-0 md:w-auto md:flex-1">
      <h2 class="mb-[5px] text-h2 text-ink-1">{{ title }}</h2>
      <div v-if="meta" class="text-[12.5px] leading-[1.3] text-ink-5">{{ meta }}</div>
    </div>

    <!-- On the thread's own page, as the group's actions are on the group's: the tab strip is
         for switching threads, not for acting on one. -->
    <div class="flex shrink-0 items-center gap-2">
      <!-- Outside the mayModify group, like Melden: keeping a thread is the reader's business
           whether or not they may change it. -->
      <FavouriteToggle
        v-if="props.threadId"
        target-type="writing_thread"
        :target-id="props.threadId"
        :is-favourite="props.isFavourite ?? false"
        @changed="$emit('favouriteChanged')"
      />

      <!-- Outside the mayModify group: reporting is what somebody who may *not* change it does.
           Quiet like its neighbours — an act on the thread the page is about. -->
      <Button variant="outline" size="sm" @click="$emit('report')">
        <Flag :stroke-width="1.5" aria-hidden="true" />
        Melden
      </Button>
    </div>

    <div v-if="props.mayModify" class="flex shrink-0 items-center gap-2">
      <Button variant="outline" size="sm" @click="$emit('rename')">
        <Pencil :stroke-width="1.5" />
        Umbenennen
      </Button>
      <Button variant="outline" size="sm" @click="$emit('delete')">
        <Trash2 :stroke-width="1.5" />
        Löschen
      </Button>
    </div>
  </div>
</template>

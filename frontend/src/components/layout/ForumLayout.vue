<script setup lang="ts">
/**
 * The frame the forum's pages share: one rail holding its tree. One and not two, because the
 * forum has only its structure to say something about.
 *
 * Its own page *is* that tree, so the rail is left off there — declared at the route, as the
 * group does it.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronLeft, PanelRight } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import RailLabel from '@/components/layout/RailLabel.vue'
import RailToggle from '@/components/layout/RailToggle.vue'
import ContextSheet from '@/components/layout/ContextSheet.vue'
import RailBlock from '@/components/context/RailBlock.vue'
import ForumRail from '@/components/context/ForumRail.vue'

const route = useRoute()

const showsContentRail = computed<boolean>(() => route.meta.listsForumContents !== true)

const leftOpen = ref<boolean>(true)

/** Matches the `lg` breakpoint, so the rail's contents mount in exactly one place. */
const railFits = useMediaQuery('(min-width: 1024px)')
const sheetOpen = ref<boolean>(false)

const railSlack = computed<Record<string, string>>(() => ({
  '--rail-slack-left':
    railFits.value && !leftOpen.value
      ? 'calc(var(--container-rail-left) - var(--container-rail-collapsed))'
      : '0px',
  '--rail-slack-right': '0px',
}))
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 items-stretch" :style="railSlack">
    <template v-if="railFits && showsContentRail">
      <aside
        v-if="leftOpen"
        class="w-rail-left flex-none flex-col gap-5 overflow-y-auto border-r border-line-3 bg-paper-2 px-3.5 py-4 lg:flex"
      >
        <div class="flex items-center">
          <RailLabel>Im Forum</RailLabel>
          <button
            type="button"
            class="ml-auto flex size-6 items-center justify-center rounded-md border border-line-4 text-ink-label"
            aria-label="Im Forum einklappen"
            @click="leftOpen = false"
          >
            <ChevronLeft :size="14" :stroke-width="1.5" />
          </button>
        </div>

        <RailBlock label="Inhalt" collapsible open-start>
          <ForumRail />
        </RailBlock>
      </aside>
      <RailToggle v-else side="left" label="Im Forum" @click="leftOpen = true" />
    </template>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Below `lg` the rail is a sheet, and this is the only way to it. -->
      <button
        v-if="!railFits && showsContentRail"
        type="button"
        class="flex min-h-11 flex-none items-center gap-2 border-b border-line-3 bg-paper-2 px-gutter text-left font-mono text-[10.5px] font-semibold tracking-[0.14em] text-ink-label uppercase"
        @click="sheetOpen = true"
      >
        <PanelRight :size="14" :stroke-width="1.5" />
        Im Forum
      </button>

      <RouterView />
    </div>

    <ContextSheet
      v-if="!railFits && showsContentRail"
      v-model:open="sheetOpen"
      label="Im Forum"
      description="Die Ordner des Forums, und die Themen und Seiten darin."
    >
      <RailBlock label="Inhalt">
        <ForumRail />
      </RailBlock>
    </ContextSheet>
  </div>
</template>

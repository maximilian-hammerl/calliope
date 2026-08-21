<script setup lang="ts">
import { ChevronLeft, ChevronRight, PanelRight } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import type { GetCurrentUser200 } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import TopBar from '@/components/layout/TopBar.vue'
import RailLabel from '@/components/layout/RailLabel.vue'
import RailToggle from '@/components/layout/RailToggle.vue'
import ContextSheet from '@/components/layout/ContextSheet.vue'
import BottomBar from '@/components/layout/BottomBar.vue'

const props = defineProps<{ activeGroupId?: string }>()
defineSlots<{
  default: () => unknown
  /** What the member does: next steps, the story's status. */
  rail?: () => unknown
  /**
   * What the member looks up while writing: the story's own facts, who is here.
   * `collapsible` is true only where the rail is a rail — in the sheet the blocks are stacked.
   */
  infoRail?: (props: { collapsible: boolean }) => unknown
}>()

const { data: userData } = useGetCurrentUser()
const user = computed<GetCurrentUser200 | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data : undefined,
)

// Collapsing both rails plus the composer is the reading mode; there is no separate mode.
const leftOpen = ref<boolean>(true)
const rightOpen = ref<boolean>(true)
const hasRail = computed<boolean>(() => props.activeGroupId !== undefined)

/**
 * Matches the `lg` breakpoint the rail is shown at. A media query rather than CSS, because the
 * rail content has to render in exactly one place — hiding a second copy with `hidden` would
 * still mount it.
 */
const railFits = useMediaQuery('(min-width: 1024px)')
const sheetOpen = ref<boolean>(false)
</script>

<template>
  <div class="flex h-svh flex-col bg-paper-1">
    <TopBar v-if="user" :user="user" />

    <div class="flex min-h-0 flex-1 items-stretch">
      <template v-if="hasRail && $slots.infoRail && railFits">
        <aside
          v-if="leftOpen"
          class="w-[262px] flex-none flex-col gap-5 overflow-y-auto border-r border-line-3 bg-paper-2 px-[14px] py-4 lg:flex"
        >
          <div class="flex items-center">
            <RailLabel>Über die Gruppe</RailLabel>
            <button
              type="button"
              class="ml-auto flex size-6 items-center justify-center rounded-md border border-line-4 text-ink-label"
              aria-label="Über die Gruppe einklappen"
              @click="leftOpen = false"
            >
              <ChevronLeft :size="14" :stroke-width="1.5" />
            </button>
          </div>
          <slot name="infoRail" :collapsible="true" />
        </aside>
        <RailToggle v-else side="left" label="Über die Gruppe" @click="leftOpen = true" />
      </template>

      <main class="flex min-w-0 flex-1 flex-col">
        <!-- Below `lg` the rail is a sheet, and this is the only way to it. Without it the
             story status, the next steps and the files have no route on a phone or tablet. -->
        <button
          v-if="hasRail && $slots.rail && !railFits"
          type="button"
          class="flex min-h-11 flex-none items-center gap-2 border-b border-line-3 bg-paper-2 px-[18px] text-left font-mono text-[10.5px] font-semibold tracking-[0.14em] text-ink-label uppercase"
          @click="sheetOpen = true"
        >
          <PanelRight :size="14" :stroke-width="1.5" />
          Gruppen-Kontext
        </button>

        <slot />
      </main>

      <template v-if="hasRail && $slots.rail">
        <aside
          v-if="railFits && rightOpen"
          class="w-[262px] flex-none flex-col gap-5 overflow-y-auto border-l border-line-3 bg-paper-2 px-[14px] py-4 lg:flex"
        >
          <div class="flex items-center">
            <RailLabel>Gruppen-Kontext</RailLabel>
            <button
              type="button"
              class="ml-auto rounded-md border border-line-4 px-[6px] text-[13px] leading-[1.1] text-ink-label"
              aria-label="Gruppen-Kontext einklappen"
              @click="rightOpen = false"
            >
              <ChevronRight :size="14" :stroke-width="1.5" />
            </button>
          </div>
          <slot name="rail" />
        </aside>
        <RailToggle
          v-else-if="railFits"
          side="right"
          label="Gruppen-Kontext"
          @click="rightOpen = true"
        />

        <ContextSheet v-else v-model:open="sheetOpen">
          <slot name="rail" />
          <slot name="infoRail" :collapsible="false" />
        </ContextSheet>
      </template>
    </div>

    <BottomBar />
  </div>
</template>

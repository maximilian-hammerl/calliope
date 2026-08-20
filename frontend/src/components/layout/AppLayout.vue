<script setup lang="ts">
import { ChevronLeft, ChevronRight, PanelRight } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useListGroups } from '@/api/groups/groups'
import type { GetCurrentUser200, ListGroups200ResultsItem } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import TopBar from '@/components/layout/TopBar.vue'
import GroupList from '@/components/group/GroupList.vue'
import RailLabel from '@/components/layout/RailLabel.vue'
import RailToggle from '@/components/layout/RailToggle.vue'
import ContextSheet from '@/components/layout/ContextSheet.vue'
import BottomBar from '@/components/layout/BottomBar.vue'

const props = defineProps<{ activeGroupId?: string }>()
defineEmits<{ createGroup: [] }>()
defineSlots<{ default: () => unknown; rail?: () => unknown }>()

const { data: userData } = useGetCurrentUser()
const user = computed<GetCurrentUser200 | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data : undefined,
)

// The rail lists every group the member belongs to, so it is the same query on every page and
// vue-query serves it from cache after the first load.
const { data: groupsData } = useListGroups({ limit: 100, sortAttribute: 'title', sortOrder: 'asc' })
const groups = computed<ListGroups200ResultsItem[]>(() =>
  groupsData.value?.status === 200 ? groupsData.value.data.results : [],
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
      <aside
        v-if="leftOpen"
        class="hidden w-[216px] flex-none flex-col gap-[6px] border-r border-line-3 bg-paper-2 px-[11px] py-4 md:flex"
      >
        <div class="flex items-center px-[5px] pb-[9px]">
          <RailLabel>Meine Gruppen</RailLabel>
          <button
            type="button"
            class="ml-auto rounded-md border border-line-4 px-[6px] text-[13px] leading-[1.1] text-ink-label"
            aria-label="Gruppen einklappen"
            @click="leftOpen = false"
          >
            <ChevronLeft :size="14" :stroke-width="1.5" />
          </button>
        </div>
        <GroupList :groups="groups" :active-id="activeGroupId" @create="$emit('createGroup')" />
      </aside>
      <RailToggle
        v-else
        side="left"
        label="Gruppen"
        class="hidden md:flex"
        @click="leftOpen = true"
      />

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
        </ContextSheet>
      </template>
    </div>

    <BottomBar />
  </div>
</template>

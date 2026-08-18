<script setup lang="ts">
import { computed, ref } from 'vue'
import { useListGroups } from '@/api/groups/groups'
import type { GetCurrentUser200, ListGroups200ResultsItem } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import TopBar from '@/components/TopBar.vue'
import GroupList from '@/components/GroupList.vue'
import RailLabel from '@/components/RailLabel.vue'
import RailToggle from '@/components/RailToggle.vue'

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
            ‹
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
        <slot />
      </main>

      <template v-if="hasRail && $slots.rail">
        <aside
          v-if="rightOpen"
          class="hidden w-[262px] flex-none flex-col gap-5 overflow-y-auto border-l border-line-3 bg-paper-2 px-[14px] py-4 lg:flex"
        >
          <div class="flex items-center">
            <RailLabel>Gruppen-Kontext</RailLabel>
            <button
              type="button"
              class="ml-auto rounded-md border border-line-4 px-[6px] text-[13px] leading-[1.1] text-ink-label"
              aria-label="Gruppen-Kontext einklappen"
              @click="rightOpen = false"
            >
              ›
            </button>
          </div>
          <slot name="rail" />
        </aside>
        <RailToggle
          v-else
          side="right"
          label="Gruppen-Kontext"
          class="hidden lg:flex"
          @click="rightOpen = true"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Everything a group's pages share: the group itself, who is in it, what the reader may do, and
 * both rails. The group page, a thread and a page are its children, so all three read one query
 * rather than running their own — and the rails are written once rather than copied three times.
 *
 * The component is *reused* when only `:groupId` changes, so nothing here may read the parameter
 * at mount: `groupId` is a computed and every query takes it as one.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronLeft, ChevronRight, PanelRight } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { getGetGroupQueryKey, getListGroupsQueryKey, useGetGroup } from '@/api/groups/groups'
import { useListMemberships } from '@/api/memberships/memberships'
import type { GetGroup200, ListMemberships200ResultsItem } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { provideGroupContext } from '@/composables/useGroupContext'
import { useSteps } from '@/composables/useSteps'
import RailLabel from '@/components/layout/RailLabel.vue'
import RailToggle from '@/components/layout/RailToggle.vue'
import ContextSheet from '@/components/layout/ContextSheet.vue'
import RailBlock from '@/components/context/RailBlock.vue'
import StepList from '@/components/context/StepList.vue'
import StoryStatus from '@/components/context/StoryStatus.vue'
import StoryDetails from '@/components/context/StoryDetails.vue'
import FileList from '@/components/context/FileList.vue'
import MemberList from '@/components/context/MemberList.vue'
import FolderRail from '@/components/context/FolderRail.vue'

const route = useRoute()
const groupId = computed<string>(() => String(route.params.groupId))

const { data: groupData, isPending, isError } = useGetGroup(groupId)
const group = computed<GetGroup200 | undefined>(() =>
  groupData.value?.status === 200 ? groupData.value.data : undefined,
)

const { data: membershipsData } = useListMemberships(groupId)
const memberships = computed<ListMemberships200ResultsItem[]>(() =>
  membershipsData.value?.status === 200 ? membershipsData.value.data.results : [],
)

// Only a joined membership carries authority: somebody invited as an administrator has not
// accepted yet, and an invitation may be looked at but not written into.
const role = computed<GetGroup200['role']>(() =>
  group.value?.status === 'joined' ? group.value.role : null,
)
const mayWrite = computed<boolean>(() => role.value === 'writer' || role.value === 'administrator')
const mayAdminister = computed<boolean>(() => role.value === 'administrator')

async function refreshGroup(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId.value) })
  await queryClient.invalidateQueries(listOnlyFilter(getListGroupsQueryKey()))
}

provideGroupContext({
  groupId,
  group,
  memberships,
  mayWrite,
  mayAdminister,
  isPending: computed<boolean>(() => isPending.value),
  isError: computed<boolean>(() => isError.value),
  refreshGroup,
})

// Served from the block's own query: the label says how many are open while the block is shut.
const { open: openSteps } = useSteps(groupId)

/**
 * The group page is itself the list of the group's contents, so the rail's tree would be the
 * same tree twice on that one page. Declared at the route rather than guessed from its name.
 */
const showsContentRail = computed<boolean>(() => route.meta.listsGroupContents !== true)

// Collapsing both rails plus the composer is the reading mode; there is no separate mode. The
// state now outlives a navigation, which is the point: it is undone by leaving the group.
const leftOpen = ref<boolean>(true)
const rightOpen = ref<boolean>(true)

/**
 * Matches the `lg` breakpoint the rails are shown at. A media query rather than CSS, because the
 * rail content has to render in exactly one place — hiding a second copy with `hidden` would
 * still mount it.
 */
const railFits = useMediaQuery('(min-width: 1024px)')
const sheetOpen = ref<boolean>(false)

/** What a rail gave up by collapsing to its strip, or nothing while it is still open. */
function slack(collapsed: boolean, rail: string): string {
  return collapsed ? `calc(var(${rail}) - var(--container-rail-collapsed))` : '0px'
}

/**
 * Handed to `.reading-column`, which takes it back so the page body does not slide sideways.
 * Zero wherever a rail is not a rail: below `lg`.
 */
const railSlack = computed<Record<string, string>>(() => ({
  '--rail-slack-left': slack(railFits.value && !leftOpen.value, '--container-rail-left'),
  '--rail-slack-right': slack(railFits.value && !rightOpen.value, '--container-rail-right'),
}))
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 items-stretch" :style="railSlack">
    <template v-if="railFits">
      <aside
        v-if="leftOpen"
        class="w-rail-left flex-none flex-col gap-5 overflow-y-auto border-r border-line-3 bg-paper-2 px-3.5 py-4 lg:flex"
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

        <!-- What the member looks up while writing. -->
        <RailBlock v-if="showsContentRail" label="Inhalt" collapsible open-start>
          <FolderRail :group-id="groupId" />
        </RailBlock>
        <RailBlock label="Die Geschichte" collapsible>
          <StoryDetails v-if="group" :group="group" />
        </RailBlock>
        <RailBlock label="Dateien & Bilder" collapsible>
          <FileList />
        </RailBlock>
        <RailBlock label="Mitglieder" collapsible>
          <MemberList :memberships="memberships" />
        </RailBlock>
      </aside>
      <RailToggle v-else side="left" label="Über die Gruppe" @click="leftOpen = true" />
    </template>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Below `lg` both rails are one sheet, and this is the only way to it. Without it the
           story status, the next steps and the files have no route on a phone or tablet. -->
      <button
        v-if="!railFits"
        type="button"
        class="flex min-h-11 flex-none items-center gap-2 border-b border-line-3 bg-paper-2 px-gutter text-left font-mono text-[10.5px] font-semibold tracking-[0.14em] text-ink-label uppercase"
        @click="sheetOpen = true"
      >
        <PanelRight :size="14" :stroke-width="1.5" />
        Gruppen-Kontext
      </button>

      <RouterView />
    </div>

    <template v-if="railFits">
      <aside
        v-if="rightOpen"
        class="w-rail-right flex-none flex-col gap-5 overflow-y-auto border-l border-line-3 bg-paper-2 px-3.5 py-4 lg:flex"
      >
        <div class="flex items-center">
          <RailLabel>Gruppen-Kontext</RailLabel>
          <button
            type="button"
            class="ml-auto rounded-md border border-line-4 px-1.5 text-[13px] leading-[1.1] text-ink-label"
            aria-label="Gruppen-Kontext einklappen"
            @click="rightOpen = false"
          >
            <ChevronRight :size="14" :stroke-width="1.5" />
          </button>
        </div>

        <!-- What the member does. -->
        <RailBlock label="Nächste Schritte" :meta="`${openSteps.length} offen`" collapsible>
          <StepList :group-id="groupId" :may-write="mayWrite" :may-administer="mayAdminister" />
        </RailBlock>
        <RailBlock label="Story-Status" collapsible>
          <StoryStatus v-if="group" :group="group" :may-edit="mayAdminister" />
        </RailBlock>
      </aside>
      <RailToggle v-else side="right" label="Gruppen-Kontext" @click="rightOpen = true" />
    </template>

    <!-- One sheet holding both rails' blocks, stacked rather than collapsible. -->
    <ContextSheet v-else v-model:open="sheetOpen">
      <RailBlock label="Nächste Schritte" :meta="`${openSteps.length} offen`">
        <StepList :group-id="groupId" :may-write="mayWrite" :may-administer="mayAdminister" />
      </RailBlock>
      <RailBlock label="Story-Status">
        <StoryStatus v-if="group" :group="group" :may-edit="mayAdminister" />
      </RailBlock>
      <RailBlock v-if="showsContentRail" label="Inhalt">
        <FolderRail :group-id="groupId" />
      </RailBlock>
      <RailBlock label="Die Geschichte">
        <StoryDetails v-if="group" :group="group" />
      </RailBlock>
      <RailBlock label="Dateien & Bilder">
        <FileList />
      </RailBlock>
      <RailBlock label="Mitglieder">
        <MemberList :memberships="memberships" />
      </RailBlock>
    </ContextSheet>
  </div>
</template>

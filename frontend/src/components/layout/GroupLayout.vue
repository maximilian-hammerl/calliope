<script setup lang="ts">
/**
 * Everything a group's pages share: the group itself, who is in it, what the reader may do, and
 * both rails. The group page, a thread and a page are its children, so all three read one query
 * rather than running their own — and the rails are written once rather than copied three times.
 *
 * The component is *reused* when only `:groupId` changes, so nothing here may read the parameter
 * at mount: `groupId` is a computed and every query takes it as one.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getGetGroupQueryKey, getListGroupsQueryKey, useGetGroup } from '@/api/groups/groups'
import { useListMemberships } from '@/api/memberships/memberships'
import type { GetGroup200, ListMemberships200ResultsItem } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { provideGroupContext } from '@/composables/useGroupContext'
import { useSteps } from '@/composables/useSteps'
import AppLayout from '@/components/layout/AppLayout.vue'
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
</script>

<template>
  <AppLayout :active-group-id="groupId">
    <RouterView />

    <!-- What the member does. -->
    <template #rail="{ collapsible }">
      <RailBlock
        label="Nächste Schritte"
        :meta="`${openSteps.length} offen`"
        :collapsible="collapsible"
      >
        <StepList :group-id="groupId" :may-write="mayWrite" :may-administer="mayAdminister" />
      </RailBlock>
      <RailBlock label="Story-Status" :collapsible="collapsible">
        <StoryStatus v-if="group" :group="group" :may-edit="mayAdminister" />
      </RailBlock>
    </template>

    <!-- What the member looks up while writing. -->
    <template #infoRail="{ collapsible }">
      <!-- First and open: this is the navigation between a group's threads and pages, so it is
           not something the member should have to open before they can move. -->
      <RailBlock v-if="showsContentRail" label="Inhalt" :collapsible="collapsible" open-start>
        <FolderRail :group-id="groupId" />
      </RailBlock>
      <RailBlock label="Die Geschichte" :collapsible="collapsible">
        <StoryDetails v-if="group" :group="group" />
      </RailBlock>
      <RailBlock label="Dateien & Bilder" :collapsible="collapsible">
        <FileList />
      </RailBlock>
      <RailBlock label="Mitglieder" :collapsible="collapsible">
        <MemberList :memberships="memberships" />
      </RailBlock>
    </template>
  </AppLayout>
</template>

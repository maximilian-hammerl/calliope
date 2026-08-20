<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useGetGroup } from '@/api/groups/groups'
import { useGetCurrentUser } from '@/api/auth/auth'
import { useListThreads } from '@/api/threads/threads'
import { useListMemberships } from '@/api/memberships/memberships'
import type {
  GetGroup200,
  ListMemberships200ResultsItem,
  ListThreads200ResultsItem,
} from '@/api/models'
import { PencilIcon } from '@lucide/vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import CreateThreadDialog from '@/components/thread/CreateThreadDialog.vue'
import EditGroupDialog from '@/components/group/EditGroupDialog.vue'
import GroupHeader from '@/components/group/GroupHeader.vue'
import GroupMembers from '@/components/group/GroupMembers.vue'
import ThreadTabs from '@/components/thread/ThreadTabs.vue'
import StepList from '@/components/context/StepList.vue'
import StoryStatus from '@/components/context/StoryStatus.vue'
import StoryDetails from '@/components/context/StoryDetails.vue'
import FileList from '@/components/context/FileList.vue'
import MemberList from '@/components/context/MemberList.vue'
import { Button } from '@/components/ui/button'
import GroupInvitation from '@/components/group/GroupInvitation.vue'

const route = useRoute()
const groupId = computed<string>(() => String(route.params.groupId))

const { data: currentUserData } = useGetCurrentUser()

const { data: groupData, isPending, isError } = useGetGroup(groupId)
const group = computed<GetGroup200 | undefined>(() =>
  groupData.value?.status === 200 ? groupData.value.data : undefined,
)

const { data: threadsData } = useListThreads(groupId, {
  limit: 100,
  sortAttribute: 'lastActivityAt',
  sortOrder: 'desc',
})
const threads = computed<ListThreads200ResultsItem[]>(() =>
  threadsData.value?.status === 200 ? threadsData.value.data.results : [],
)
const { data: membershipsData } = useListMemberships(groupId, { limit: 100 })
const memberships = computed<ListMemberships200ResultsItem[]>(() =>
  membershipsData.value?.status === 200 ? membershipsData.value.data.results : [],
)

/**
 * Straight off the group, which reports the reader's own standing. Only a joined membership
 * carries authority: somebody invited as an administrator has not accepted yet.
 */
const isInvited = computed<boolean>(() => group.value?.status === 'invited')
const role = computed<GetGroup200['role']>(() =>
  group.value?.status === 'joined' ? group.value.role : null,
)
// Readers may read and comment; writing is for writers and administrators.
const mayWrite = computed<boolean>(() => role.value === 'writer' || role.value === 'administrator')
const mayAdminister = computed<boolean>(() => role.value === 'administrator')

/** The reader's own row, for who invited them and when. */
const ownMembership = computed<ListMemberships200ResultsItem | undefined>(() => {
  const userId = currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined
  return memberships.value.find((membership) => membership.userId === userId)
})

const creatingThread = ref<boolean>(false)
const editingGroup = ref<boolean>(false)
</script>

<template>
  <AppLayout :active-group-id="groupId">
    <template v-if="group">
      <GroupHeader :title="group.title" :visibility="group.visibility" :subtitle="group.subtitle" />

      <!-- No thread is open here, so no tab is active; the strip is how one is chosen. -->
      <ThreadTabs
        :group-id="groupId"
        :threads="threads"
        :may-write="mayWrite"
        @create="creatingThread = true"
      />

      <div class="flex-1 overflow-auto px-[18px] pt-7 pb-8 md:px-10">
        <div class="reading-column">
          <!-- Above the group's own text: what to do about the invitation comes before
               reading further into a group you have not joined. -->
          <GroupInvitation
            v-if="isInvited && group.role"
            class="mb-7"
            :group-id="groupId"
            :role="group.role"
            :own="ownMembership"
          />

          <p v-if="group.blurb" class="max-w-[60ch] text-[13.5px] leading-[1.7] text-ink-4">
            {{ group.blurb }}
          </p>

          <p v-if="threads.length === 0" class="mt-7 text-[13.5px] leading-[1.7] text-ink-4">
            Noch keine Threads in dieser Gruppe.
            <template v-if="mayWrite">Leg den ersten an.</template>
          </p>
          <p v-else class="mt-7 text-[13.5px] leading-[1.7] text-ink-4">
            Wähle oben einen Thread, um weiterzulesen.
          </p>

          <!-- Only here, not in GroupHeader: that header also renders on the thread page,
               where editing the group would sit beside the writing and pull attention. -->
          <Button
            v-if="mayAdminister"
            variant="outline"
            size="sm"
            class="mt-7"
            @click="editingGroup = true"
          >
            <PencilIcon :stroke-width="1.5" />
            Gruppe bearbeiten
          </Button>

          <GroupMembers
            :group-id="groupId"
            :memberships="memberships"
            :may-administer="mayAdminister"
          />
        </div>
      </div>
    </template>

    <div v-else-if="isPending" class="px-[18px] py-5 text-[12.5px] text-ink-5 md:px-10">
      <div class="reading-column">Gruppe wird geladen …</div>
    </div>

    <div v-else-if="isError" class="reading-column px-[18px] py-5 md:px-10">
      <p class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4">
        Diese Gruppe gibt es nicht, oder sie ist privat und du gehörst nicht dazu.
      </p>
      <Button variant="outline" size="sm" class="mt-5" @click="$router.push({ name: 'groups' })">
        Zu meinen Gruppen
      </Button>
    </div>

    <!-- What the member does. -->
    <template #rail>
      <StepList />
      <StoryStatus v-if="group" :group="group" :may-edit="mayAdminister" />
    </template>

    <!-- What the member looks up while writing. -->
    <template #infoRail>
      <StoryDetails v-if="group" :group="group" />
      <FileList />
      <MemberList :memberships="memberships" />
    </template>
  </AppLayout>

  <CreateThreadDialog v-model:open="creatingThread" :group-id="groupId" />
  <EditGroupDialog v-if="group" v-model:open="editingGroup" :group="group" />
</template>

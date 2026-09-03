<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStartGroupConversation } from '@/api/groups/groups'
import { getListChatsQueryKey } from '@/api/chats/chats'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { ApiError } from '@/lib/api/apiFetch'
import { openChatDialog } from '@/lib/chat/openChatDialog'
import { paragraphs } from '@/lib/format/formatText'
import { useGetCurrentUser } from '@/api/auth/auth'
import type { ListMemberships200ResultsItem } from '@/api/models'
import { useGroupContext } from '@/composables/useGroupContext'
import { Flag, MessageCircle, Pencil } from '@lucide/vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import FavouriteToggle from '@/components/favourite/FavouriteToggle.vue'
import GroupDialog from '@/components/group/GroupDialog.vue'
import FolderTree from '@/components/folder/FolderTree.vue'
import GroupHeader from '@/components/group/GroupHeader.vue'
import GroupMembers from '@/components/group/GroupMembers.vue'
import { Button } from '@/components/ui/button'
import GroupInvitation from '@/components/group/GroupInvitation.vue'

const { groupId, group, memberships, mayWrite, mayAdminister, isPending, isError, refreshGroup } =
  useGroupContext()

const { data: currentUserData } = useGetCurrentUser()

/** As the paragraphs its author typed, like a story idea's synopsis. A post is a document. */
const synopsis = computed<string[]>(() => paragraphs(group.value?.synopsis ?? ''))

const currentUserId = computed<string | undefined>(() =>
  currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined,
)

const isInvited = computed<boolean>(() => group.value?.status === 'invited')

/** The reader's own row, for who invited them and when. */
const ownMembership = computed<ListMemberships200ResultsItem | undefined>(() => {
  const userId = currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined
  return memberships.value.find((membership) => membership.userId === userId)
})

const router = useRouter()

function goToGroups() {
  void router.push({ name: 'myGroups' })
}

/** A private group answers 404 to a non-member, so staying here would show an error. */
function leaveGroupPage() {
  void router.push({ name: 'myGroups' })
}

const reportingGroup = ref<boolean>(false)
const editingGroup = ref<boolean>(false)

/** A visitor: somebody reading a public group they are in no relation to. */
const isVisitor = computed<boolean>(() => group.value !== undefined && group.value.status === null)

const { mutateAsync: startConversation, isPending: startingConversation } =
  useStartGroupConversation()
const conversationError = ref<string | undefined>(undefined)

/** Creates the chat with every administrator invited, then opens the messages dialog on it. */
async function askIntoGroup() {
  conversationError.value = undefined
  try {
    const created = await startConversation({ groupId: groupId.value })
    if (created.status !== 201) {
      return
    }
    await queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))
    openChatDialog(created.data.id)
  } catch (error) {
    // The ungoverned-group hole seen from outside: there is nobody to ask.
    conversationError.value =
      error instanceof ApiError && error.status === 409
        ? 'In dieser Gruppe kann gerade niemand einladen.'
        : 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
  }
}
</script>

<template>
  <template v-if="group">
    <GroupHeader :title="group.title" :visibility="group.visibility" :subtitle="group.subtitle" />

    <div class="flex-1 overflow-auto px-gutter pt-7 pb-8 md:px-10">
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

        <div v-if="group.synopsis" class="flex max-w-[60ch] flex-col gap-[0.9em]">
          <p v-for="(paragraph, index) in synopsis" :key="index" class="text-body text-ink-4">
            {{ paragraph }}
          </p>
        </div>

        <!-- Only here, not in GroupHeader: that header also renders on the thread page,
             where editing the group would sit beside the writing and pull attention. -->
        <Button
          v-if="mayAdminister"
          variant="outline"
          size="sm"
          class="mt-7"
          @click="editingGroup = true"
        >
          <Pencil :stroke-width="1.5" />
          Gruppe bearbeiten
        </Button>

        <!-- The visitor's one action, in the administrator's slot — the two never meet.
             It asks the people, not the system: a chat with the administrators, no
             join-request machinery. -->
        <Button
          v-else-if="isVisitor"
          size="sm"
          class="mt-7"
          :disabled="startingConversation"
          @click="askIntoGroup"
        >
          <MessageCircle :stroke-width="1.5" />
          Chat beginnen
        </Button>

        <!-- Beside the quiet actions rather than the group's own: keeping a group is the
             reader's business, not something the page is asking them to do. Offered to members
             and visitors alike, since favouriting one's own group is allowed. -->
        <FavouriteToggle
          v-if="group"
          target-type="writing_group"
          :target-id="group.id"
          :is-favourite="group.isFavourite"
          class="mt-7 ml-2"
          @changed="refreshGroup"
        />

        <!-- After the group's own action rather than beside it: reporting a group is rare and
             should not sit level with the thing everybody came to do. **Placement** is what does
             that job — the level is Quiet like its neighbours, because a level says what an act
             is on and this one is on the group. -->
        <Button variant="outline" size="sm" class="mt-7 ml-2" @click="reportingGroup = true">
          <Flag :stroke-width="1.5" aria-hidden="true" />
          Melden
        </Button>

        <p v-if="conversationError" class="mt-3 text-[12.5px] text-destructive" role="alert">
          {{ conversationError }}
        </p>

        <!-- The group's structure, and the only place it is changed: the rails elsewhere read
             the same tree without actions. Above the members, because what the group writes
             comes before who is in it. -->
        <FolderTree
          v-if="group"
          class="mt-10"
          :group-id="groupId"
          :may-write="mayWrite"
          :may-administer="mayAdminister"
          :current-user-id="currentUserId"
        />

        <GroupMembers
          :group-id="groupId"
          :memberships="memberships"
          :may-administer="mayAdminister"
          @left="leaveGroupPage"
        />
      </div>
    </div>
  </template>

  <div v-else-if="isPending" class="px-gutter py-5 text-[12.5px] text-ink-5 md:px-10">
    <div class="reading-column">Gruppe wird geladen …</div>
  </div>

  <div v-else-if="isError" class="px-gutter py-5 md:px-10">
    <div class="reading-column">
      <p class="max-w-[46ch] text-body text-ink-4">
        Diese Gruppe gibt es nicht, oder sie ist privat und du gehörst nicht dazu.
      </p>
      <Button variant="outline" size="sm" class="mt-5" @click="goToGroups">
        Zu meinen Gruppen
      </Button>
    </div>
  </div>

  <ReportDialog
    v-if="group"
    v-model:open="reportingGroup"
    target-type="writing_group"
    :target-id="group.id"
    :subject="group.title"
  />

  <GroupDialog v-if="group" v-model:open="editingGroup" :group="group" />
</template>

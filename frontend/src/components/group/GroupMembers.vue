<script setup lang="ts">
import { computed, ref } from 'vue'
import { PlusIcon } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getListMembershipsQueryKey, useRemoveMember } from '@/api/memberships/memberships'
import { useGetCurrentUser } from '@/api/auth/auth'
import type { ListMemberships200ResultsItem } from '@/api/models'
import { countLabel, formatActivityTime } from '@/lib/format/formatTime'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import InviteMemberDialog from '@/components/group/InviteMemberDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  groupId: string
  memberships: ListMemberships200ResultsItem[]
  mayAdminister: boolean
}>()

const queryClient = useQueryClient()

// Grammatical gender follows the person, which nothing here knows, so the role names stay
// neutral rather than guessing between Autor and Autorin.
const ROLE_LABELS: Record<string, string> = {
  administrator: 'Admin',
  writer: 'Schreibt',
  reader: 'Liest',
}

const { data: currentUserData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined,
)

/**
 * Joined first, then invited, each alphabetically. Whoever has accepted is who the group
 * actually is; the invitations are a pending state below it.
 */
const sortedMemberships = computed<ListMemberships200ResultsItem[]>(() =>
  [...props.memberships].sort((one, other) => {
    if (one.status !== other.status) {
      return one.status === 'joined' ? -1 : 1
    }
    return one.username.localeCompare(other.username, 'de')
  }),
)

const joinedCount = computed<number>(
  () => props.memberships.filter((membership) => membership.status === 'joined').length,
)

const memberIds = computed<string[]>(() => props.memberships.map((membership) => membership.userId))

/**
 * The date of the state the row is actually in: when an invitation was sent, or when a member
 * joined. Once somebody is in the group, when they were asked stopped mattering.
 */
function membershipDate(membership: ListMemberships200ResultsItem): string | undefined {
  if (membership.status === 'invited') {
    if (membership.invitedAt === null) {
      return undefined
    }
    // Who did the inviting matters while it is still an invitation: an administrator looking
    // at a pending row wants to know whether it was theirs to chase.
    const invitedBy =
      membership.invitedByUsername === null ? '' : ` von ${membership.invitedByUsername}`
    return `eingeladen ${formatActivityTime(membership.invitedAt)}${invitedBy}`
  }

  return membership.joinedAt === null
    ? undefined
    : `beigetreten ${formatActivityTime(membership.joinedAt)}`
}

const inviting = ref<boolean>(false)
const removalError = ref<string | undefined>(undefined)
/** Which row is mid-removal, so only that button reports it. */
const removingUserId = ref<string | undefined>(undefined)

const { mutateAsync: removeMember } = useRemoveMember()

async function remove(membership: ListMemberships200ResultsItem) {
  removalError.value = undefined
  removingUserId.value = membership.userId

  try {
    await removeMember({ groupId: props.groupId, userId: membership.userId })
    await queryClient.invalidateQueries({
      queryKey: listKeyPrefix(getListMembershipsQueryKey(props.groupId)),
    })
  } catch {
    removalError.value = `${membership.username} konnte nicht entfernt werden. Versuche es noch einmal.`
  } finally {
    removingUserId.value = undefined
  }
}
</script>

<template>
  <section class="mt-9">
    <div class="flex flex-wrap items-baseline gap-3 border-b border-line-3 pb-[10px]">
      <h2 class="text-[15px] leading-[1.3] font-semibold text-ink-2">Mitglieder</h2>
      <span class="text-[11.5px] text-ink-5">
        {{ countLabel(joinedCount, 'Mitglied', 'Mitglieder') }}
      </span>
      <Button
        v-if="mayAdminister"
        variant="outline"
        size="sm"
        class="ml-auto"
        @click="inviting = true"
      >
        <PlusIcon :stroke-width="1.5" />
        Mitglied einladen
      </Button>
    </div>

    <Alert v-if="removalError" variant="destructive" role="alert" class="mt-4">
      <AlertDescription>{{ removalError }}</AlertDescription>
    </Alert>

    <ul>
      <li
        v-for="membership in sortedMemberships"
        :key="membership.userId"
        class="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-3 py-2"
      >
        <Avatar class="size-7 shrink-0">
          <AvatarFallback class="bg-paper-4 text-[11.5px] font-semibold text-[#5c4a2d]">
            {{ membership.username.trim().charAt(0).toUpperCase() }}
          </AvatarFallback>
        </Avatar>

        <div class="flex min-w-0 flex-col">
          <div class="flex flex-wrap items-baseline gap-x-3">
            <span class="min-w-0 truncate text-[13.5px] text-ink-2">{{ membership.username }}</span>
            <span class="text-[12px] whitespace-nowrap text-ink-5">
              {{ ROLE_LABELS[membership.role] ?? membership.role }}
              <template v-if="membership.status === 'invited'">· eingeladen</template>
            </span>
          </div>
          <span v-if="membershipDate(membership)" class="text-[11.5px] text-ink-6">
            {{ membershipDate(membership) }}
          </span>
        </div>

        <!-- Leaving is the member's own act and lives elsewhere, so the viewer's own row
             carries no remove control even for an administrator. -->
        <Button
          v-if="mayAdminister && membership.userId !== currentUserId"
          variant="ghost"
          size="sm"
          class="ml-auto shrink-0 text-ink-5"
          :disabled="removingUserId === membership.userId"
          @click="remove(membership)"
        >
          {{ membership.status === 'invited' ? 'Einladung zurückziehen' : 'Entfernen' }}
        </Button>
      </li>
    </ul>
  </section>

  <InviteMemberDialog v-model:open="inviting" :group-id="groupId" :member-ids="memberIds" />
</template>

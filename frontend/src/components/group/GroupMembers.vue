<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListMembershipsQueryKey,
  useRemoveMember,
  useUpdateMembership,
} from '@/api/memberships/memberships'
import { getGetGroupQueryKey } from '@/api/groups/groups'
import { useGetCurrentUser } from '@/api/auth/auth'
import type { ListMemberships200ResultsItem, UpdateMembershipBodyRole } from '@/api/models'
import { useOwnMembership } from '@/composables/useOwnMembership'
import { formatActivityTime } from '@/lib/format/formatTime'
import { pluralize } from '@/lib/format/formatText'
import InviteMemberDialog from '@/components/group/InviteMemberDialog.vue'
import LastAdministratorDialog from '@/components/group/LastAdministratorDialog.vue'
import LeaveGroupDialog from '@/components/group/LeaveGroupDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const ROLES = (Object.keys(ROLE_LABELS) as UpdateMembershipBodyRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value] as string,
}))

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
const { mutateAsync: updateMembership } = useUpdateMembership()

const roleError = ref<string | undefined>(undefined)
/** Which row is mid-change, so only that select is disabled. */
const savingRoleFor = ref<string | undefined>(undefined)

const joinedAdministrators = computed<number>(
  () =>
    props.memberships.filter(
      (membership) => membership.status === 'joined' && membership.role === 'administrator',
    ).length,
)

/**
 * Only giving up one's own administration can leave a group ungoverned: an administrator
 * demoting somebody else is still one themselves. Nothing refuses it — see
 * `LastAdministratorDialog`.
 */
function wouldLeaveNobodyAdministering(
  membership: ListMemberships200ResultsItem,
  role: UpdateMembershipBodyRole,
): boolean {
  return (
    membership.userId === currentUserId.value &&
    membership.status === 'joined' &&
    membership.role === 'administrator' &&
    role !== 'administrator' &&
    joinedAdministrators.value === 1
  )
}

const pendingRoleChange = ref<
  { membership: ListMemberships200ResultsItem; role: UpdateMembershipBodyRole } | undefined
>(undefined)

async function applyRole(
  membership: ListMemberships200ResultsItem,
  role: UpdateMembershipBodyRole,
) {
  roleError.value = undefined
  savingRoleFor.value = membership.userId

  try {
    await updateMembership({ groupId: props.groupId, userId: membership.userId, data: { role } })
    await queryClient.invalidateQueries({
      queryKey: getListMembershipsQueryKey(props.groupId),
    })
    // Losing one's own administration changes what the whole page may offer.
    if (membership.userId === currentUserId.value) {
      await queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(props.groupId) })
    }
  } catch {
    roleError.value = `Die Rolle von ${membership.username} konnte nicht geändert werden. Versuche es noch einmal.`
  } finally {
    savingRoleFor.value = undefined
    pendingRoleChange.value = undefined
  }
}

const { leave, isBusy, error: leaveError } = useOwnMembership(() => props.groupId)
const emit = defineEmits<{ left: [] }>()

/** What leaving costs, which is only irreversible for the last member. */
const leavingDeletesTheGroup = computed<boolean>(() => props.memberships.length === 1)
const leavingLeavesNobodyAdministering = computed<boolean>(() => {
  const own = props.memberships.find((membership) => membership.userId === currentUserId.value)
  return (
    own?.status === 'joined' &&
    own.role === 'administrator' &&
    joinedAdministrators.value === 1 &&
    props.memberships.length > 1
  )
})

const askingToLeave = ref<boolean>(false)

function askToLeave() {
  askingToLeave.value = true
}

async function confirmLeave() {
  if (await leave()) {
    askingToLeave.value = false
    emit('left')
  }
}

function changeRole(membership: ListMemberships200ResultsItem, role: UpdateMembershipBodyRole) {
  if (role === membership.role) {
    return
  }
  if (wouldLeaveNobodyAdministering(membership, role)) {
    pendingRoleChange.value = { membership, role }
    return
  }
  void applyRole(membership, role)
}

async function remove(membership: ListMemberships200ResultsItem) {
  removalError.value = undefined
  removingUserId.value = membership.userId

  try {
    await removeMember({ groupId: props.groupId, userId: membership.userId })
    await queryClient.invalidateQueries({
      queryKey: getListMembershipsQueryKey(props.groupId),
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
    <div class="flex flex-wrap items-baseline gap-3 border-b border-line-3 pb-2.5">
      <h2 class="text-[15px] leading-[1.3] font-semibold text-ink-2">Mitglieder</h2>
      <span class="text-[11.5px] text-ink-5">
        {{ pluralize(joinedCount, 'Mitglied', 'Mitglieder') }}
      </span>
      <Button
        v-if="mayAdminister"
        variant="outline"
        size="sm"
        class="ml-auto"
        @click="inviting = true"
      >
        <Plus :stroke-width="1.5" />
        Mitglied einladen
      </Button>
    </div>

    <Alert
      v-if="removalError ?? roleError ?? leaveError"
      variant="destructive"
      role="alert"
      class="mt-4"
    >
      <AlertDescription>{{ removalError ?? roleError ?? leaveError }}</AlertDescription>
    </Alert>

    <ul>
      <li
        v-for="membership in sortedMemberships"
        :key="membership.userId"
        class="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-3 py-2"
      >
        <!-- The avatar and both lines are inside the link: the row already reads as one
             tappable block, and a 20px name inside it did not. -->
        <RouterLink
          :to="{ name: 'member', params: { userId: membership.userId } }"
          class="group flex min-h-11 min-w-0 items-center gap-3"
        >
          <UserAvatar :username="membership.username" :avatar-url="membership.avatarUrl" />

          <span class="flex min-w-0 flex-col">
            <span class="flex flex-wrap items-baseline gap-x-3">
              <span
                class="min-w-0 truncate text-[13.5px] text-ink-2 underline-offset-[6px] group-hover:underline"
              >
                {{ membership.username }}
              </span>
              <span class="text-[12px] whitespace-nowrap text-ink-5">
                <template v-if="!mayAdminister">
                  {{ ROLE_LABELS[membership.role] ?? membership.role }}
                </template>
                <template v-if="membership.status === 'invited'">
                  <template v-if="!mayAdminister">· </template>eingeladen
                </template>
              </span>
            </span>
            <span v-if="membershipDate(membership)" class="text-[11.5px] text-ink-6">
              {{ membershipDate(membership) }}
            </span>
          </span>
        </RouterLink>

        <!-- Whoever cannot administer still leaves from their own row: it is the one row on
             this page that is about the reader. -->
        <Button
          v-if="!mayAdminister && membership.userId === currentUserId"
          variant="ghost"
          size="sm"
          class="ml-auto shrink-0 text-ink-5"
          :disabled="isBusy"
          @click="askToLeave"
        >
          Gruppe verlassen
        </Button>

        <!-- One trailing block, so the selects line up in a column: the action beside them runs
             from "Entfernen" to "Einladung zurückziehen", and left to itself that dragged every
             select to a different place. -->
        <div v-if="mayAdminister" class="ml-auto flex shrink-0 items-center gap-2">
          <!-- Outside the link on purpose: a select nested in one is neither valid markup nor
               reachable by keyboard. -->
          <Select
            :model-value="membership.role"
            :disabled="savingRoleFor === membership.userId"
            @update:model-value="
              (value) => changeRole(membership, value as UpdateMembershipBodyRole)
            "
          >
            <SelectTrigger
              class="w-[104px] text-[12px] md:h-8"
              :aria-label="`Rolle von ${membership.username}`"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="role in ROLES" :key="role.value" :value="role.value">
                {{ role.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- The width is the longest action's, so the column holds whichever action a row
               carries. -->
          <div class="flex w-[178px] justify-end">
            <Button
              v-if="membership.userId === currentUserId"
              variant="ghost"
              size="sm"
              class="text-ink-5"
              :disabled="isBusy"
              @click="askToLeave"
            >
              Gruppe verlassen
            </Button>
            <Button
              v-else
              variant="ghost"
              size="sm"
              class="text-ink-5"
              :disabled="removingUserId === membership.userId"
              @click="remove(membership)"
            >
              {{ membership.status === 'invited' ? 'Einladung zurückziehen' : 'Entfernen' }}
            </Button>
          </div>
        </div>
      </li>
    </ul>
  </section>

  <InviteMemberDialog v-model:open="inviting" :group-id="groupId" :member-ids="memberIds" />

  <LeaveGroupDialog
    v-model:open="askingToLeave"
    :pending="isBusy"
    :deletes-the-group="leavingDeletesTheGroup"
    :leaves-nobody-administering="leavingLeavesNobodyAdministering"
    @confirmed="confirmLeave"
  />

  <LastAdministratorDialog
    :open="pendingRoleChange !== undefined"
    :pending="savingRoleFor !== undefined"
    @update:open="(value) => !value && (pendingRoleChange = undefined)"
    @confirmed="
      pendingRoleChange && applyRole(pendingRoleChange.membership, pendingRoleChange.role)
    "
  />
</template>

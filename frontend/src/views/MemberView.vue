<script setup lang="ts">
/** Thin on purpose: the fields that answer "would this person suit me" come next. */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getGetUserQueryKey, useGetUser, useLiftUserBan } from '@/api/users/users'
import { useGetCurrentUser } from '@/api/auth/auth'
import { useUnblockMember } from '@/api/blocks/blocks'
import { GetCurrentUser200PlatformRole } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import type { GetUser200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { formatJoinedDate } from '@/lib/format/formatTime'
import AppLayout from '@/components/layout/AppLayout.vue'
import BanMemberDialog from '@/components/user/BanMemberDialog.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import BlockMemberDialog from '@/components/user/BlockMemberDialog.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const route = useRoute()
const userId = computed<string>(() => String(route.params.userId))

const { data, isPending, error } = useGetUser(userId)

const member = computed<GetUser200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)

// From `error`, not `data`: the mutator throws on any non-2xx, so no status reaches `data`.
const notFound = computed<boolean>(
  () => error.value instanceof ApiError && error.value.status === 404,
)

/** Nobody blocks themselves, so their own profile shows no such button. */
const { data: currentUserData } = useGetCurrentUser()
const isOwnProfile = computed<boolean>(
  () => currentUserData.value?.status === 200 && currentUserData.value.data.id === userId.value,
)

/**
 * Operator-only, and never on one's own profile — the API refuses to ban an account holding a
 * platform role anyway, which is what stops an operator banning themselves or another.
 */
const mayModerate = computed<boolean>(() => {
  if (currentUserData.value?.status !== 200) {
    return false
  }
  const role = currentUserData.value.data.platformRole
  return (
    role === GetCurrentUser200PlatformRole.moderator ||
    role === GetCurrentUser200PlatformRole.administrator
  )
})

const banning = ref<boolean>(false)
const banError = ref<string | undefined>(undefined)
const { mutateAsync: liftBan, isPending: liftingBan } = useLiftUserBan()

async function liftTheBan() {
  banError.value = undefined
  try {
    await liftBan({ userId: userId.value })
  } catch {
    banError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }
  await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId.value) })
}

const reporting = ref<boolean>(false)
const blocking = ref<boolean>(false)
const blockError = ref<string | undefined>(undefined)

const { mutateAsync: unblock, isPending: unblocking } = useUnblockMember()

async function allowContactAgain() {
  blockError.value = undefined
  try {
    await unblock({ userId: userId.value })
  } catch {
    blockError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }
  await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId.value) })
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <div v-if="isPending" class="flex items-center gap-2 text-note text-ink-5">
        <Spinner />
        Einen Moment.
      </div>

      <template v-else-if="member">
        <!-- Wraps below `sm`: "Blockierung aufheben" is wide enough that on a 375px screen it
             squeezed the name into an ellipsis, which is the one thing this page must show. -->
        <div class="flex flex-wrap items-center gap-4">
          <UserAvatar :username="member.username" size="lg" />

          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="truncate text-h1">{{ member.username }}</h1>
            <p class="text-[12px] text-ink-6">
              Dabei seit {{ formatJoinedDate(member.createdAt) }}
            </p>
          </div>

          <div v-if="!isOwnProfile" class="w-full sm:ml-auto sm:w-auto">
            <Button
              v-if="member.isBlocked"
              variant="outline"
              size="sm"
              :disabled="unblocking"
              @click="allowContactAgain"
            >
              Blockierung aufheben
            </Button>
            <!-- Ghost, not destructive: the destructive weight belongs on the confirmation,
                 where the consequences are spelled out. -->
            <Button v-else variant="outline" size="sm" @click="blocking = true">
              Blockieren
            </Button>
            <Button variant="ghost" size="sm" @click="reporting = true">Melden</Button>
          </div>

          <!-- Its own group, after the member-facing one: blocking is what any member may do
               to another, banning is the platform acting. `isBanned` is only sent to an
               operator, so this is absent for everybody else even before the check. -->
          <div v-if="mayModerate && !isOwnProfile" class="w-full sm:w-auto">
            <Button
              v-if="member.isBanned"
              variant="outline"
              size="sm"
              :disabled="liftingBan"
              @click="liftTheBan"
            >
              Sperre aufheben
            </Button>
            <Button v-else variant="outline" size="sm" @click="banning = true">
              Konto sperren
            </Button>
          </div>
        </div>

        <p v-if="blockError" class="mt-3 text-[12.5px] text-destructive" role="alert">
          {{ blockError }}
        </p>

        <p v-if="banError" class="mt-3 text-[12.5px] text-destructive" role="alert">
          {{ banError }}
        </p>

        <!-- Said plainly on the page, not only inside the dialog: an operator looking at this
             profile has to be able to see the account's state without opening anything. -->
        <p v-if="member.isBanned" class="mt-3 text-[12.5px] text-ink-5">
          Dieses Konto ist gesperrt.
        </p>

        <p v-if="member.isBlocked" class="mt-4 border-l-2 border-line-4 pl-3 text-row text-ink-5">
          Du hast {{ member.username }} blockiert. Ihr könnt euch nicht einladen.
        </p>

        <!-- Said outright rather than left as blank space: an empty page reads as an error. -->
        <p class="mt-8 max-w-[60ch] border-t border-line-3 pt-6 text-note text-ink-5">
          {{ member.username }} hat noch nichts über sich erzählt. Steckbriefe für Mitglieder —
          Genres, woran jemand schreibt, was jemand sucht — kommen noch.
        </p>
      </template>

      <template v-else-if="notFound">
        <h1 class="text-h1">Kein Mitglied gefunden</h1>
        <p class="mt-5 text-note text-ink-5">
          Dieses Konto gibt es nicht mehr, oder der Link stimmt nicht.
        </p>
      </template>

      <template v-else>
        <h1 class="text-h1">Das hat nicht geklappt</h1>
        <p class="mt-5 text-note text-ink-5">
          Wir konnten dieses Mitglied gerade nicht laden. Versuche es später noch einmal.
        </p>
      </template>
    </div>

    <BlockMemberDialog
      v-if="member"
      v-model:open="blocking"
      :user-id="member.id"
      :username="member.username"
    />

    <ReportDialog
      v-if="member"
      v-model:open="reporting"
      target-type="user"
      :target-id="member.id"
      :subject="member.username"
    />

    <BanMemberDialog
      v-if="member && mayModerate"
      v-model:open="banning"
      :user-id="member.id"
      :username="member.username"
    />
  </AppLayout>
</template>

<script setup lang="ts">
/**
 * Where a member sees who is signed in as them, and ends it. The device and the address are
 * what make a row recognisable — a list of identical rows would answer nothing.
 *
 * No password is asked for, unlike the other sections here: this is the defensive act, and
 * demanding a password blocks exactly the case it exists for.
 */
import { computed, ref } from 'vue'
import {
  getListSessionsQueryKey,
  useListSessions,
  useRevokeOtherSessions,
  useRevokeSession,
} from '@/api/auth/auth'
import type { ListSessions200ResultsItem } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { formatActivityTime } from '@/lib/format/formatTime'
import { pluralize } from '@/lib/format/formatText'
import { sessionDevice } from '@/lib/format/sessionDevice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const { data, isPending } = useListSessions()

const sessions = computed<ListSessions200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const others = computed<number>(() => sessions.value.filter((one) => !one.current).length)

const { mutateAsync: revokeSession } = useRevokeSession()
const { mutateAsync: revokeOthers, isPending: endingOthers } = useRevokeOtherSessions()

/** Per row, so one slow request does not disable every other button in the list. */
const pendingId = ref<string | undefined>(undefined)
const error = ref<string | undefined>(undefined)

const refresh = () => queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() })

async function end(sessionId: string) {
  error.value = undefined
  pendingId.value = sessionId
  try {
    await revokeSession({ sessionId })
    await refresh()
  } catch {
    error.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
  } finally {
    pendingId.value = undefined
  }
}

async function endEverywhereElse() {
  error.value = undefined
  try {
    await revokeOthers()
    await refresh()
  } catch {
    error.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-note text-ink-4">
      Wo du angemeldet bist. Eine Anmeldung endet nach 24 Stunden ohne Nutzung von selbst.
    </p>

    <Alert v-if="error" variant="destructive" role="alert">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div v-if="isPending" class="flex items-center gap-2 text-[13px] text-ink-5">
      <Spinner />
      Einen Moment.
    </div>

    <template v-else>
      <p class="text-row text-ink-5">
        <template v-if="others === 0">Du bist nur hier angemeldet.</template>
        <template v-else>
          Neben dieser gibt es {{ pluralize(others, 'weitere Anmeldung', 'weitere Anmeldungen') }}.
        </template>
      </p>

      <ul class="flex flex-col">
        <li
          v-for="(session, index) in sessions"
          :key="session.id"
          class="flex flex-wrap items-center gap-3 py-3"
          :class="index > 0 ? 'border-t border-line-2' : ''"
        >
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-[13.5px] text-ink-2">
              {{ sessionDevice(session) }}
              <span v-if="session.current" class="text-ink-5">· diese Anmeldung</span>
            </span>
            <span class="text-[12px] text-ink-6">
              <template v-if="session.ipAddress">{{ session.ipAddress }} · </template>
              zuletzt genutzt {{ formatActivityTime(session.lastUsedAt) }}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            class="ml-auto"
            :disabled="pendingId === session.id"
            @click="end(session.id)"
          >
            {{ session.current ? 'Hier abmelden' : 'Abmelden' }}
          </Button>
        </li>
      </ul>

      <div v-if="others > 0">
        <Button variant="outline" size="sm" :disabled="endingOthers" @click="endEverywhereElse">
          Überall sonst abmelden
        </Button>
      </div>
    </template>
  </div>
</template>

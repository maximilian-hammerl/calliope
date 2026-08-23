<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import { useGetCurrentUser } from '@/api/auth/auth'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Button } from '@/components/ui/button'

/**
 * What the member sees while the API cannot be reached — during a deploy, a restart, or an
 * outage. `App.vue` renders it only while that is true, so it may assume it is.
 *
 * It chooses its own size: a strip along the bottom when there is an app behind it to keep
 * reading, and the whole screen when there is not, because a notice floating over an empty
 * page reads as a broken page.
 *
 * It is also what brings the app back. By the time it appears nothing else is retrying —
 * every query has exhausted its attempts and stopped — so without the probe below the member
 * would sit on a dead page until they reloaded.
 */
const queryClient = useQueryClient()

// Only to tell the two sizes apart. The query is shared, so this reads what the app already
// asked for rather than asking again.
const { data: userData } = useGetCurrentUser()
const hasSession = computed<boolean>(() => userData.value?.status === 200)

/**
 * The same ladder the chat stream uses, for the same reason: a deploy is over in seconds, and
 * past the end of it a longer outage settles to about two attempts a minute.
 */
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000] as const
const MAX_RETRY_DELAY_MS = 30_000

const attempt = ref<number>(0)
const isProbing = ref<boolean>(false)
const secondsLeft = ref<number>(0)

let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer(): void {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

/**
 * A plain fetch rather than a generated client call: this only asks whether anything is
 * listening, it needs no session, and it must not disturb the query cache while everything in
 * it is sitting in an error state.
 */
async function reachable(): Promise<boolean> {
  try {
    return (await fetch('/api/health')).ok
  } catch {
    return false
  }
}

async function probe(): Promise<void> {
  if (isProbing.value) {
    return
  }

  isProbing.value = true
  const isBack = await reachable()
  isProbing.value = false

  if (!isBack) {
    scheduleProbe()
    return
  }

  // Everything gave up when it ran out of attempts, so coming back has to be said out loud.
  // The refetches this triggers are what clear `backendReachable` and remove this component.
  attempt.value = 0
  await queryClient.invalidateQueries()
}

function scheduleProbe(): void {
  clearTimer()

  const delay = RETRY_DELAYS_MS[attempt.value] ?? MAX_RETRY_DELAY_MS
  attempt.value += 1
  secondsLeft.value = Math.ceil(delay / 1000)

  timer = setTimeout(() => {
    timer = undefined
    void probe()
  }, delay)
}

/** So the wait never looks like nothing is happening. */
useIntervalFn(() => {
  if (secondsLeft.value > 0) {
    secondsLeft.value -= 1
  }
}, 1000)

function retryNow(): void {
  clearTimer()
  attempt.value = 0
  secondsLeft.value = 0
  void probe()
}

const status = computed<string>(() =>
  isProbing.value
    ? 'Wird versucht …'
    : `Nächster Versuch in ${Math.max(secondsLeft.value, 1)} Sekunden`,
)

scheduleProbe()

onScopeDispose(clearTimer)
</script>

<template>
  <!-- Nothing usable behind it: the whole screen, calm and centred, so the page does not look
       broken while it waits. -->
  <div
    v-if="!hasSession"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-paper-1 px-6 text-center"
    role="status"
    aria-live="polite"
  >
    <CalliopeLogo :size="34" wordmark />

    <div>
      <h1 class="text-h1 text-ink-1">Keine Verbindung</h1>
      <p class="mt-2 max-w-[46ch] text-body text-ink-4">
        Der Server antwortet gerade nicht. Wahrscheinlich läuft ein Update — das dauert meist nur
        ein paar Sekunden.
      </p>
    </div>

    <div class="flex flex-col items-center gap-3">
      <Button variant="outline" size="sm" :disabled="isProbing" @click="retryNow">
        Erneut versuchen
      </Button>
      <span class="text-[12px] text-ink-5">{{ status }}</span>
    </div>
  </div>

  <!-- There is an app behind it, so it stays out of the way and lets the member keep reading.
       Solid paper with a hairline, never a shadow, and never over the top bar. -->
  <div
    v-else
    class="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-4 bg-paper-0 px-gutter py-2.5 md:px-10"
    role="status"
    aria-live="polite"
  >
    <span class="text-[13px] leading-[1.5] text-ink-2">
      Keine Verbindung zum Server. Was du siehst, ist möglicherweise nicht aktuell.
    </span>
    <span class="text-[12px] text-ink-5">{{ status }}</span>
    <Button variant="outline" size="sm" class="ml-auto" :disabled="isProbing" @click="retryNow">
      Erneut versuchen
    </Button>
  </div>
</template>

<script setup lang="ts">
/**
 * What the member sees while the API is refusing their requests for asking too often. `App.vue`
 * renders it only while that is true, beside `ConnectionLost`, because the same thing is true of
 * both: every request is failing, so no single control can explain it.
 *
 * **It does not probe.** `ConnectionLost` brings the app back by retrying, which is exactly what
 * caused this state — so this one counts down and waits, and the first request after the window
 * clears it through `queryClient`'s `onSuccess`.
 *
 * It chooses its own size for the reason `ConnectionLost` does, and that is also the fix for the
 * navigation: a limited member who reloads has no session answer, so `AppLayout` renders no bars
 * and the page has no way off it. Covering the screen says what happened instead of leaving them
 * on a shell that looks broken.
 */
import { computed, onScopeDispose, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import { useGetCurrentUser } from '@/api/auth/auth'
import { rateLimitedUntil } from '@/lib/api/queryClient'
import type { RateLimitScope } from '@/lib/api/queryClient'
import { rateLimitWait } from '@/lib/format/rateLimit'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Button } from '@/components/ui/button'

const queryClient = useQueryClient()

// Shared with the app rather than asked again: while this is up, another request is the last
// thing wanted.
const { data: userData } = useGetCurrentUser()
const hasSession = computed<boolean>(() => userData.value?.status === 200)

const now = ref<number>(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 1000)

/**
 * Reads win when both budgets are spent: an interface that cannot load anything is the bigger
 * story, and it is the one whose message is true either way.
 */
const scope = computed<RateLimitScope | undefined>(() =>
  rateLimitedUntil.value.read !== undefined
    ? 'read'
    : rateLimitedUntil.value.write !== undefined
      ? 'write'
      : undefined,
)

const secondsLeft = computed<number>(() => {
  const until = scope.value === undefined ? undefined : rateLimitedUntil.value[scope.value]
  return until === undefined ? 0 : Math.max(0, Math.ceil((until - now.value) / 1000))
})

const wait = computed<string | undefined>(() => rateLimitWait(secondsLeft.value))

const canRetry = computed<boolean>(() => secondsLeft.value === 0)

/**
 * Only reads take the screen. A spent write budget leaves a page that reads perfectly, so covering
 * it would hide the thing that still works.
 */
const takesTheScreen = computed<boolean>(() => scope.value === 'read' && !hasSession.value)

/**
 * Offered only once the window has passed, so the one control here cannot be used to spend the
 * budget it is waiting for.
 */
async function retryNow(): Promise<void> {
  rateLimitedUntil.value = {}
  await queryClient.invalidateQueries()
}

onScopeDispose(() => {
  rateLimitedUntil.value = {}
})
</script>

<template>
  <!-- Nothing usable behind it: a limited member who reloaded has no navigation at all. -->
  <div
    v-if="takesTheScreen"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-paper-1 px-6 text-center"
    role="status"
    aria-live="polite"
  >
    <CalliopeLogo :size="34" wordmark />

    <div>
      <h1 class="text-h1 text-ink-1">Kurze Pause</h1>
      <p class="mt-2 max-w-[46ch] text-body text-ink-4">
        Es kamen zu viele Anfragen von deinem Anschluss, deshalb antwortet der Server gerade nicht.
        <template v-if="wait">Du kannst es {{ wait }} wieder versuchen.</template>
      </p>
    </div>

    <Button variant="outline" size="sm" :disabled="!canRetry" @click="retryNow">
      Erneut versuchen
    </Button>
  </div>

  <!-- There is an app behind it, so it stays out of the way. Solid paper with a hairline, never a
       shadow, matching the connection notice it sits in place of. -->
  <div
    v-else
    class="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-4 bg-paper-0 px-gutter py-2.5 md:px-10"
    role="status"
    aria-live="polite"
  >
    <span class="text-[13px] leading-[1.5] text-ink-2">
      <template v-if="scope === 'write'">
        Zu viele Änderungen. Du kannst weiterlesen, aber gerade nichts speichern.
      </template>
      <template v-else>Zu viele Anfragen. Der Server antwortet dir gerade nicht.</template>
    </span>
    <span v-if="wait" class="text-[12px] text-ink-5">Wieder möglich {{ wait }}</span>
    <Button variant="outline" size="sm" class="ml-auto" :disabled="!canRetry" @click="retryNow">
      Erneut versuchen
    </Button>
  </div>
</template>

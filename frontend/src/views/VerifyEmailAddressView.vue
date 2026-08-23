<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVerifyEmailAddress } from '@/api/auth/auth'
import { ApiError } from '@/lib/api/apiFetch'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const router = useRouter()

const token = new URLSearchParams(window.location.search).get('token') ?? undefined

/**
 * Unlike a password reset there is nothing to fill in, so the link is spent on arrival and
 * the page only reports what happened. A link with no token is as unusable as a spent one.
 */
const status = ref<'verifying' | 'done' | 'expired'>(token === undefined ? 'expired' : 'verifying')

const { mutateAsync: verify } = useVerifyEmailAddress()

onMounted(async () => {
  if (token === undefined) {
    return
  }

  try {
    await verify({ data: { token } })
  } catch (error) {
    // 410 is the one answer for spent, expired and unknown alike; anything else is a fault,
    // but the member can do the same thing about either.
    status.value = 'expired'
    if (!(error instanceof ApiError)) {
      throw error
    }
    return
  }

  status.value = 'done'
})

/**
 * The cached session still says unconfirmed, so it has to go before navigating or the guard
 * would send them straight back to the wall. Home then resolves by itself: into the app with
 * a session, to the sign-in page without one.
 */
async function continueToApp() {
  forgetCurrentUser()
  await router.push({ name: 'home' })
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">
          {{ status === 'done' ? 'E-Mail-Adresse bestätigt' : 'E-Mail-Adresse bestätigen' }}
        </h1>
      </div>

      <div v-if="status === 'verifying'" class="mt-6 flex items-center gap-2 text-note text-ink-5">
        <Spinner />
        Einen Moment, wir prüfen deinen Link.
      </div>

      <template v-else-if="status === 'done'">
        <p class="mt-5 text-note text-ink-5">
          Deine E-Mail-Adresse ist bestätigt. Du kannst jetzt loslegen.
        </p>

        <Button class="mt-7 w-full" @click="continueToApp">Weiter</Button>
      </template>

      <template v-else>
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Dieser Link lässt sich nicht mehr verwenden. Links gelten nur kurze Zeit und nur ein
            einziges Mal.
          </p>
          <p>Melde dich an, um dir einen neuen schicken zu lassen.</p>
        </div>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>
    </div>
  </main>
</template>

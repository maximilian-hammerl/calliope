<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useConfirmEmailAddressChange } from '@/api/auth/auth'
import { ApiError } from '@/lib/api/apiFetch'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const token = new URLSearchParams(window.location.search).get('token') ?? undefined

const status = ref<'confirming' | 'done' | 'in_use' | 'expired'>(
  token === undefined ? 'expired' : 'confirming',
)

const { mutateAsync: confirm } = useConfirmEmailAddressChange()

onMounted(async () => {
  if (token === undefined) {
    return
  }

  try {
    await confirm({ data: { token } })
  } catch (error) {
    // Somebody may have registered the address while the link sat in an inbox.
    status.value = error instanceof ApiError && error.status === 409 ? 'in_use' : 'expired'
    return
  }

  // Confirming ended every session, this browser's included.
  forgetCurrentUser()
  status.value = 'done'
})

const HEADINGS = {
  confirming: 'E-Mail-Adresse ändern',
  done: 'E-Mail-Adresse geändert',
  in_use: 'Adresse nicht mehr frei',
  expired: 'E-Mail-Adresse ändern',
} as const
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">{{ HEADINGS[status] }}</h1>
      </div>

      <div v-if="status === 'confirming'" class="mt-6 flex items-center gap-2 text-note text-ink-5">
        <Spinner />
        Einen Moment, wir prüfen deinen Link.
      </div>

      <template v-else-if="status === 'done'">
        <p class="mt-5 text-note text-ink-5">
          Dein Konto gehört jetzt zu deiner neuen E-Mail-Adresse. Du wurdest auf allen Geräten
          abgemeldet und meldest dich ab jetzt damit an.
        </p>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>

      <template v-else-if="status === 'in_use'">
        <p class="mt-5 text-note text-ink-5">
          Diese E-Mail-Adresse gehört inzwischen zu einem anderen Konto. Deine bisherige Adresse
          bleibt unverändert — fordere die Änderung in den Einstellungen noch einmal an, mit einer
          anderen Adresse.
        </p>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>

      <template v-else>
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Dieser Link lässt sich nicht mehr verwenden. Links gelten nur kurze Zeit, nur ein
            einziges Mal, und ein Abbruch macht sie ungültig.
          </p>
          <p>Deine E-Mail-Adresse ist unverändert geblieben.</p>
        </div>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>
    </div>
  </main>
</template>

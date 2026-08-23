<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCancelEmailAddressChange } from '@/api/auth/auth'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const token = new URLSearchParams(window.location.search).get('token') ?? undefined

const status = ref<'cancelling' | 'done' | 'expired'>(
  token === undefined ? 'expired' : 'cancelling',
)

const { mutateAsync: cancel } = useCancelEmailAddressChange()

onMounted(async () => {
  if (token === undefined) {
    return
  }

  try {
    await cancel({ data: { token } })
  } catch {
    status.value = 'expired'
    return
  }

  status.value = 'done'
})
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">
          {{ status === 'done' ? 'Änderung abgebrochen' : 'Änderung abbrechen' }}
        </h1>
      </div>

      <div v-if="status === 'cancelling'" class="mt-6 flex items-center gap-2 text-note text-ink-5">
        <Spinner />
        Einen Moment, wir brechen die Änderung ab.
      </div>

      <template v-else-if="status === 'done'">
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>Deine E-Mail-Adresse bleibt unverändert. Der Link zur neuen Adresse ist ungültig.</p>
          <!-- Somebody asked for this change knowing the password, so the password is the
               thing that needs attention now. -->
          <p>
            Hast du die Änderung nicht selbst angefordert, ändere jetzt dein Passwort: wer sie
            angefordert hat, kannte es.
          </p>
        </div>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'forgotPassword' }">Passwort zurücksetzen</RouterLink>
        </Button>
      </template>

      <template v-else>
        <p class="mt-5 text-note text-ink-5">
          Es gibt nichts mehr abzubrechen. Entweder wurde die Änderung bereits abgebrochen, sie ist
          abgelaufen, oder sie wurde inzwischen bestätigt.
        </p>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>
    </div>
  </main>
</template>

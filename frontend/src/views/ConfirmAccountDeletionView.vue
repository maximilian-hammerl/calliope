<script setup lang="ts">
import { ref } from 'vue'
import { useConfirmAccountDeletion } from '@/api/auth/auth'
import { forgetCurrentUser } from '@/lib/auth/session'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const token = new URLSearchParams(window.location.search).get('token') ?? undefined

/**
 * Deleting waits for a click, where confirming an address change happens on mount: this is
 * the last step and cannot be undone, and a mail client that prefetches links would
 * otherwise delete the account before anybody read the page.
 */
const status = ref<'asking' | 'deleting' | 'done' | 'expired'>(
  token === undefined ? 'expired' : 'asking',
)

const { mutateAsync: confirm } = useConfirmAccountDeletion()

async function deleteAccount() {
  if (token === undefined) {
    return
  }

  status.value = 'deleting'

  try {
    await confirm({ data: { token } })
  } catch {
    status.value = 'expired'
    return
  }

  // The account is gone, and with it every session — this browser's included.
  forgetCurrentUser()
  status.value = 'done'
}

const HEADINGS = {
  asking: 'Konto endgültig löschen?',
  deleting: 'Konto wird gelöscht',
  done: 'Konto gelöscht',
  expired: 'Konto löschen',
} as const
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <CalliopeLogo :size="40" wordmark class="mb-1" />
        <h1 class="text-h1">{{ HEADINGS[status] }}</h1>
      </div>

      <template v-if="status === 'asking'">
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Danach ist dein Konto weg, und wir können es nicht zurückholen. Was du in Gruppen
            geschrieben hast, bleibt dort stehen, aber ohne deinen Namen.
          </p>
          <p>Willst du dein Konto behalten, schließ dieses Fenster einfach.</p>
        </div>

        <Button variant="destructive" class="mt-7 w-full" @click="deleteAccount">
          Konto endgültig löschen
        </Button>
      </template>

      <div
        v-else-if="status === 'deleting'"
        class="mt-6 flex items-center gap-2 text-note text-ink-5"
      >
        <Spinner />
        Einen Moment.
      </div>

      <template v-else-if="status === 'done'">
        <p class="mt-5 text-note text-ink-5">
          Dein Konto ist gelöscht, und du bist überall abgemeldet. Wenn du irgendwann zurückwillst,
          kannst du dich jederzeit neu anmelden.
        </p>

        <Button as-child variant="outline" class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Startseite</RouterLink>
        </Button>
      </template>

      <template v-else>
        <div class="mt-5 flex flex-col gap-3 text-note text-ink-5">
          <p>
            Dieser Link lässt sich nicht mehr verwenden. Links gelten nur kurze Zeit und nur ein
            einziges Mal.
          </p>
          <p>Dein Konto ist unverändert. Fordere in den Einstellungen einen neuen Link an.</p>
        </div>

        <Button as-child class="mt-7 w-full">
          <RouterLink :to="{ name: 'login' }">Zur Anmeldung</RouterLink>
        </Button>
      </template>
    </div>
  </main>
</template>

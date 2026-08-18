<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUser } from '@/api/auth/auth'
import { ApiError } from '@/lib/apiFetch'
import { forgetCurrentUser } from '@/lib/session'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const route = useRoute()
const router = useRouter()

const login = ref<string>('')
const password = ref<string>('')

const { mutateAsync: signIn, isPending, error } = useLoginUser()

/**
 * Wrong credentials are an expected answer rather than a fault, so they read as a plain
 * statement. Anything else says what happened without guessing at a cause.
 */
const errorMessage = computed<string | undefined>(() => {
  if (!error.value) {
    return undefined
  }
  if (error.value instanceof ApiError) {
    if (error.value.status === 401) {
      return 'Benutzername, E-Mail-Adresse oder Passwort ist nicht korrekt.'
    }
    if (error.value.status === 429) {
      return 'Zu viele Anmeldeversuche. Versuche es in einigen Minuten noch einmal.'
    }
  }
  return 'Die Anmeldung ist gerade nicht möglich. Versuche es später noch einmal.'
})

async function submit() {
  try {
    await signIn({ data: { login: login.value, password: password.value } })
  } catch {
    // The message is rendered from `error`; the rejection itself needs no further handling.
    return
  }

  // The guard reads the session from the cache, so the signed-out answer has to be dropped
  // before navigating or it would send us straight back here.
  forgetCurrentUser()

  const redirect = route.query.redirect
  await router.push(typeof redirect === 'string' ? redirect : { name: 'home' })
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-12">
    <div class="w-full max-w-[380px]">
      <div class="flex flex-col gap-2">
        <span
          class="font-serif text-[16px] leading-none font-semibold tracking-[0.01em] text-[#3a3229]"
        >
          Calliope
        </span>
        <h1 class="text-[25px] leading-[1.2]">Anmelden</h1>
        <p class="text-[13.5px] leading-[1.5] text-ink-5">Melde dich an, um weiterzuschreiben.</p>
      </div>

      <form class="mt-7 flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="errorMessage" variant="destructive" role="alert">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field>
            <FieldLabel for="login">Benutzername oder E-Mail-Adresse</FieldLabel>
            <Input
              id="login"
              class="h-11 md:h-9"
              v-model="login"
              name="login"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
            />
          </Field>

          <Field>
            <FieldLabel for="password">Passwort</FieldLabel>
            <Input
              id="password"
              class="h-11 md:h-9"
              v-model="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </Field>
        </FieldGroup>

        <Button type="submit" class="h-11 md:h-9" :disabled="isPending">
          <Spinner v-if="isPending" data-icon="inline-start" />
          Anmelden
        </Button>
      </form>

      <p class="mt-6 text-[13px] leading-[1.5] text-ink-5">
        Noch kein Konto?
        <RouterLink :to="{ name: 'register' }" class="text-oak-deep underline underline-offset-2">
          Konto erstellen
        </RouterLink>
      </p>
    </div>
  </main>
</template>

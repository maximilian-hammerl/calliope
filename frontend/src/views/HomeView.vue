<script setup lang="ts">
/**
 * Where signing in and registering land. What belongs here is not decided yet, so it says so
 * rather than showing an empty page — and it goes through `AppLayout`, or a phone would lose
 * the bottom bar on the one route everybody arrives on.
 */
import { APP_NAME } from '@/lib/branding'
import AppLayout from '@/components/layout/AppLayout.vue'
import { Button } from '@/components/ui/button'
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <h1 class="mb-2 text-[25px] leading-[1.2] text-ink-1">Willkommen bei {{ APP_NAME }}</h1>
        <p class="mb-6 max-w-[60ch] text-[13.5px] leading-[1.7] text-ink-4">
          Ein Ort für private Schreibgruppen: ihr denkt euch eine Geschichte aus und schreibt sie
          gemeinsam, Beitrag für Beitrag.
        </p>

        <div class="max-w-[60ch] border-t border-line-3 pt-6">
          <p class="text-[13.5px] leading-[1.7] text-ink-4">
            Diese Seite ist noch in Arbeit. Was hier einmal steht, ist offen — bis dahin fängt alles
            bei deinen Gruppen an: dort liest du weiter, schreibst weiter und gründest neue.
          </p>

          <Button variant="outline" size="sm" class="mt-5" as-child>
            <RouterLink :to="{ name: 'groups' }">Zu meinen Gruppen</RouterLink>
          </Button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

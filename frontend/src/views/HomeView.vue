<script setup lang="ts">
/**
 * Where signing in and registering land. What belongs here is not decided yet, so it says so
 * rather than showing an empty page — and it goes through `AppLayout`, or a phone would lose
 * the bottom bar on the one route everybody arrives on.
 */
import { APP_NAME } from '@/lib/branding'
import AppLayout from '@/components/layout/AppLayout.vue'
import EnvironmentNotice from '@/components/common/EnvironmentNotice.vue'
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <h1 class="mb-2 text-h1 text-ink-1">Willkommen bei {{ APP_NAME }}</h1>

      <EnvironmentNotice class="mb-6 max-w-[60ch]" />
      <p class="mb-6 max-w-[60ch] text-body text-ink-4">
        Ein Ort für private Schreibgruppen: ihr denkt euch eine Geschichte aus und schreibt sie
        gemeinsam, Beitrag für Beitrag. Und wer noch Mitschreibende sucht, stellt seine Idee als
        Storyidee vor.
      </p>

      <div class="max-w-[60ch] border-t border-line-3 pt-6">
        <p class="text-body text-ink-4">
          Diese Seite ist noch in Arbeit. Was hier einmal steht, ist offen — bis dahin fängt alles
          in der Navigation an: bei deinen Gruppen liest und schreibst du weiter, bei den Storyideen
          findest du Leute für eine neue Geschichte.
        </p>
      </div>
    </div>
  </AppLayout>
</template>

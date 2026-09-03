<script setup lang="ts">
/**
 * The only chrome the signed-out pages have: `AppLayout` renders no `TopBar` without a session,
 * so the wordmark here is both what identifies the site and the way off a legal page — which was
 * otherwise a dead end, its only links being the two in this footer.
 *
 * Signed in the legal pages are in the account menu instead; see `AppLayout`.
 */
import { RouterLink } from 'vue-router'
import CalliopeLogo from '@/components/common/CalliopeLogo.vue'
import { APP_NAME } from '@/lib/branding'

const LINKS = [
  { name: 'imprint', label: 'Impressum' },
  { name: 'privacyPolicy', label: 'Datenschutzerklärung' },
] as const
</script>

<template>
  <footer
    class="flex flex-none flex-wrap items-center gap-x-6 gap-y-2 border-t border-line-3 px-gutter py-3 md:px-10"
  >
    <RouterLink
      :to="{ name: 'home' }"
      class="flex min-h-11 items-center md:min-h-0"
      :aria-label="`${APP_NAME}, zur Startseite`"
    >
      <CalliopeLogo :size="18" wordmark />
    </RouterLink>

    <nav aria-label="Rechtliches">
      <ul class="flex flex-wrap gap-x-5 gap-y-1">
        <li v-for="link in LINKS" :key="link.name">
          <RouterLink
            :to="{ name: link.name }"
            class="text-note text-ink-5 underline-offset-2 hover:text-oak-deep hover:underline"
          >
            {{ link.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </footer>
</template>

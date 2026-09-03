<script setup lang="ts">
/**
 * Reaches the legal pages from the signed-out pages, which had no furniture to hang them on.
 * Signed in they are in the account menu; see `AppLayout`. One list, so #87 is a line.
 */
import { RouterLink } from 'vue-router'

const LINKS = [{ name: 'imprint', label: 'Impressum' }] as const
</script>

<template>
  <footer class="flex-none border-t border-line-3 px-gutter py-3 md:px-10">
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

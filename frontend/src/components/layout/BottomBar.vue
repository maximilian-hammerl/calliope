<script setup lang="ts">
/**
 * Primary navigation on a phone, where the design system moves it off the top bar. Two
 * destinations for now; Forum and Partner join them when they exist.
 */
import { useRoute } from 'vue-router'
import { BookOpen, Users } from '@lucide/vue'

const route = useRoute()

const DESTINATIONS = [
  { name: 'groups', label: 'Gruppen', icon: BookOpen, matches: ['group', 'thread', 'discover'] },
  { name: 'members', label: 'Mitglieder', icon: Users, matches: ['member'] },
] as const

function isActive(destination: (typeof DESTINATIONS)[number]): boolean {
  const current = String(route.name)
  return current === destination.name || destination.matches.some((m) => current === m)
}
</script>

<template>
  <nav
    class="flex flex-none border-t border-line-3 bg-paper-0 md:hidden"
    aria-label="Hauptnavigation"
  >
    <RouterLink
      v-for="destination in DESTINATIONS"
      :key="destination.name"
      :to="{ name: destination.name }"
      class="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[3px] border-t-2 text-[11.5px] leading-[1.2]"
      :class="
        isActive(destination)
          ? 'border-oak font-semibold text-ink-1'
          : 'border-transparent text-ink-5'
      "
    >
      <component :is="destination.icon" :size="18" :stroke-width="1.5" />
      {{ destination.label }}
    </RouterLink>
  </nav>
</template>

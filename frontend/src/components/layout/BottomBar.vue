<script setup lang="ts">
/**
 * Primary navigation on a phone, where the design system moves it off the top bar. Forum and
 * Partner join the two destinations when those exist.
 */
import { useRoute } from 'vue-router'
import { DESTINATIONS, isCurrent } from '@/lib/navigation/destinations'

const route = useRoute()
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
        isCurrent(destination, route.name)
          ? 'border-oak font-semibold text-ink-1'
          : 'border-transparent text-ink-5'
      "
    >
      <component :is="destination.icon" :size="18" :stroke-width="1.5" />
      {{ destination.label }}
    </RouterLink>
  </nav>
</template>

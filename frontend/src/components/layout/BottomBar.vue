<script setup lang="ts">
/**
 * Primary navigation on a phone. A destination with pages opens a menu — the same structure
 * the top bar shows — rising above the bar (`viewport: false` renders each menu in place, so
 * it can be positioned upward; the shared viewport only drops downward, off-screen here).
 */
import { useRoute } from 'vue-router'
import { DESTINATIONS, isCurrent } from '@/lib/navigation/destinations'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'

const route = useRoute()
</script>

<template>
  <NavigationMenu
    :viewport="false"
    class="flex max-w-none flex-none border-t border-line-3 bg-paper-0 md:hidden"
    aria-label="Hauptnavigation"
  >
    <NavigationMenuList class="w-full gap-0">
      <NavigationMenuItem
        v-for="destination in DESTINATIONS"
        :key="destination.label"
        class="relative flex-1"
      >
        <NavigationMenuLink as-child>
          <RouterLink
            :to="{ name: destination.name }"
            class="flex min-h-[56px] w-full flex-col items-center justify-center gap-[3px] border-t-2 text-[11.5px] leading-[1.2]"
            :class="
              isCurrent(destination, route.name)
                ? 'border-oak font-semibold text-ink-1'
                : 'border-transparent text-ink-5'
            "
          >
            <component :is="destination.icon" :size="18" :stroke-width="1.5" />
            {{ destination.label }}
          </RouterLink>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>

import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'

/**
 * The appearance a member chose, remembered between visits. Three states, because "follow the
 * system" is a choice of its own and not the absence of one. `useColorMode` keeps the two apart:
 * `store` is what was chosen, `auto` included, and `state` is what that resolves to.
 *
 * Module-level rather than per-caller: the class lives on one element, so two callers reading
 * different values would be a bug rather than a feature.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark'

const mode = useColorMode({
  storageKey: 'calliope-appearance',
  // The class is VueUse's job; the browser chrome is not — their docs are explicit that it
  // handles the attribute and no styling, so the meta is set alongside the default handler.
  onChanged(resolved, applyClass) {
    applyClass(resolved)
    // Read after the class lands, so the tint comes from the palette rather than a copy of it.
    const tint = getComputedStyle(document.documentElement).getPropertyValue('--chrome').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tint)
  },
})

export function useTheme() {
  return {
    /** Writable: assigning persists and applies. Holds the *choice*, `auto` included. */
    choice: mode.store,
    /** The resolved appearance, which is what the logo picks its cut from. */
    isDark: computed<boolean>(() => mode.state.value === 'dark'),
  }
}

import { cva } from 'class-variance-authority'

export { default as NavigationMenu } from './NavigationMenu.vue'
export { default as NavigationMenuContent } from './NavigationMenuContent.vue'
export { default as NavigationMenuIndicator } from './NavigationMenuIndicator.vue'
export { default as NavigationMenuItem } from './NavigationMenuItem.vue'
export { default as NavigationMenuLink } from './NavigationMenuLink.vue'
export { default as NavigationMenuList } from './NavigationMenuList.vue'
export { default as NavigationMenuTrigger } from './NavigationMenuTrigger.vue'
export { default as NavigationMenuViewport } from './NavigationMenuViewport.vue'

export const navigationMenuTriggerStyle = cva(
  // Patched: navigation never takes a fill (the design system marks position with a 2px rule,
  // drawn by the caller), and hover darkens the text instead. min-h keeps phone targets 44px.
  'group inline-flex min-h-11 w-max items-center justify-center px-1 text-[13.5px] leading-[1.2] whitespace-nowrap text-ink-5 hover:text-ink-1 focus-visible:ring-ring/50 outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-ink-1 focus-visible:ring-3 md:min-h-0',
)

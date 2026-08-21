<script setup lang="ts">
import type { ComponentPublicInstance, Ref } from 'vue'
import type { WithClassAsProps } from './interface'
import { cn } from '@/lib/utils'
import { useCarousel } from './useCarousel'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<WithClassAsProps>()

const { carouselRef, orientation } = useCarousel()

// A function ref, because a string ref does not count as a use of the binding under
// noUnusedLocals and a bound one is auto-unwrapped in the template. The cast undoes the
// injection state's unwrapped type: at run time this is still embla's own ref.
function setViewport(element: Element | ComponentPublicInstance | null) {
  ;(carouselRef as unknown as Ref<unknown>).value = element
}
</script>

<template>
  <div :ref="setViewport" data-slot="carousel-content" class="overflow-hidden">
    <div
      :class="
        cn(
          'flex',
          // Embla asks the page to declare this and shadcn's copy leaves it out: without it a
          // phone's own panning competes with the drag and the gesture is lost half the time.
          orientation === 'horizontal'
            ? '-ml-4 touch-pan-y touch-pinch-zoom'
            : '-mt-4 flex-col touch-pan-x touch-pinch-zoom',
          props.class,
        )
      "
      v-bind="$attrs"
    >
      <slot />
    </div>
  </div>
</template>

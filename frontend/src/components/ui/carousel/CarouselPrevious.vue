<script setup lang="ts">
import type { WithClassAsProps } from './interface'
import type { ButtonVariants } from '@/components/ui/button'
import { ArrowLeft } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCarousel } from './useCarousel'

const props = withDefaults(
  defineProps<
    {
      variant?: ButtonVariants['variant']
      size?: ButtonVariants['size']
    } & WithClassAsProps
  >(),
  {
    variant: 'outline',
    size: 'icon',
  },
)

const { orientation, canScrollPrev, scrollPrev } = useCarousel()
</script>

<template>
  <Button
    data-slot="carousel-previous"
    :disabled="!canScrollPrev"
    :class="
      cn(
        'absolute size-11 rounded-full md:size-8',
        orientation === 'horizontal'
          ? 'top-1/2 -left-12 -translate-y-1/2'
          : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
        props.class,
      )
    "
    :variant="variant"
    :size="size"
    @click="scrollPrev"
  >
    <slot>
      <ArrowLeft :stroke-width="1.5" />
      <span class="sr-only">Zurück</span>
    </slot>
  </Button>
</template>

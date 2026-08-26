<script setup lang="ts">
import type { PaginationPrevProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '@/components/ui/button'
import { ChevronLeft } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationPrev, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(
  defineProps<
    PaginationPrevProps & {
      size?: ButtonVariants['size']
      class?: HTMLAttributes['class']
    }
  >(),
  {
    size: 'default',
  },
)

const delegatedProps = reactiveOmit(props, 'class', 'size')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationPrev
    data-slot="pagination-previous"
    :aria-label="'Vorherige Seite'"
    :class="
      cn(
        buttonVariants({ variant: 'ghost', size }),
        'min-h-11 gap-1 px-2.5 md:min-h-9',
        props.class,
      )
    "
    v-bind="forwarded"
  >
    <slot>
      <ChevronLeft :size="14" :stroke-width="1.5" aria-hidden="true" />
      <span>Zurück</span>
    </slot>
  </PaginationPrev>
</template>

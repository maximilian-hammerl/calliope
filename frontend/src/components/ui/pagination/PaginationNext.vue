<script setup lang="ts">
import type { PaginationNextProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '@/components/ui/button'
import { ChevronRight } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationNext, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(
  defineProps<
    PaginationNextProps & {
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
  <PaginationNext
    data-slot="pagination-next"
    :aria-label="'Nächste Seite'"
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
      <span>Weiter</span>
      <ChevronRight :size="14" :stroke-width="1.5" aria-hidden="true" />
    </slot>
  </PaginationNext>
</template>

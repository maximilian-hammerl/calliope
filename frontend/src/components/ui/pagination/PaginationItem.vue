<script setup lang="ts">
import type { PaginationListItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationListItem } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<
  PaginationListItemProps & {
    class?: HTMLAttributes['class']
    isActive?: boolean
  }
>()

const delegatedProps = reactiveOmit(props, 'class', 'isActive')
</script>

<template>
  <PaginationListItem
    data-slot="pagination-item"
    v-bind="delegatedProps"
    :class="
      cn(
        'flex min-h-11 min-w-11 items-center justify-center border-b-2 px-2 text-[13px] md:min-h-9 md:min-w-9',
        isActive
          ? 'border-oak font-medium text-ink-1'
          : 'border-transparent text-ink-5 hover:text-oak-deep',
        props.class,
      )
    "
  >
    <slot />
  </PaginationListItem>
</template>

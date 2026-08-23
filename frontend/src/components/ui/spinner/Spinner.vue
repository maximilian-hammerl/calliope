<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Loader2Icon } from '@lucide/vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <!-- 14px, not shadcn's 16: an icon is sized to the text beside it, and a spinner sits beside
       13–13.5px in every use — in a button next to 14px icons, or next to "Einen Moment." A call
       site may still override, as the composer does at 12px. -->
  <Loader2Icon
    role="status"
    aria-label="Wird geladen"
    :class="cn('size-3.5 animate-spin', props.class)"
  />
</template>

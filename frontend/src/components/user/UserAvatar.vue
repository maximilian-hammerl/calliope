<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { userInitial } from '@/lib/format/formatUser'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const props = withDefaults(
  defineProps<{ username: string; size?: 'sm' | 'lg'; class?: HTMLAttributes['class'] }>(),
  { size: 'sm' },
)

const box = computed<string>(() => (props.size === 'lg' ? 'size-12' : 'size-7'))
const type = computed<string>(() => (props.size === 'lg' ? 'text-[17px]' : 'text-[11.5px]'))
</script>

<template>
  <Avatar :class="cn(box, 'shrink-0', props.class)">
    <AvatarFallback :class="type">
      {{ userInitial(username) }}
    </AvatarFallback>
  </Avatar>
</template>

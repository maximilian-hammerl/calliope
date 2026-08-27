<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { userInitial } from '@/lib/format/formatUser'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * A picture, or the initial. The fallback is a sibling rather than a `v-else` because reka swaps
 * to it when the source *fails to load*, so a missing file shows a letter, not a broken frame.
 */
const props = withDefaults(
  defineProps<{
    username: string
    avatarUrl?: string | null
    size?: 'sm' | 'lg'
    class?: HTMLAttributes['class']
  }>(),
  { avatarUrl: null, size: 'sm' },
)

const box = computed<string>(() => (props.size === 'lg' ? 'size-12' : 'size-7'))
const type = computed<string>(() => (props.size === 'lg' ? 'text-[17px]' : 'text-[11.5px]'))
</script>

<template>
  <Avatar :class="cn(box, 'shrink-0', props.class)">
    <!-- Empty alt: the name is already beside every avatar in this interface, and repeating it
         makes a screen reader say it twice. -->
    <AvatarImage v-if="avatarUrl" :src="avatarUrl" alt="" />
    <AvatarFallback :class="type">
      {{ userInitial(username) }}
    </AvatarFallback>
  </Avatar>
</template>

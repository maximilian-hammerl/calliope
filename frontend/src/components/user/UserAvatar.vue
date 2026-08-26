<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { userInitial } from '@/lib/format/formatUser'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * A member's picture, or their initial where there is none — which is most of them.
 *
 * `AvatarImage` yields to `AvatarFallback` when the source is absent *or* fails to load, so a
 * file that has gone missing shows the initial rather than a broken image. That is the whole
 * reason the fallback is a sibling rather than a `v-else`.
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

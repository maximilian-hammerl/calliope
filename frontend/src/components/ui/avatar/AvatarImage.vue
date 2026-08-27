<script setup lang="ts">
import type { AvatarImageProps } from 'reka-ui'
import { AvatarImage } from 'reka-ui'

const props = defineProps<AvatarImageProps>()
</script>

<template>
  <!-- `object-cover`, which shadcn leaves off: without it a portrait photograph is *stretched* into
       the square rather than cropped to it. The upload centre-crops the same way, so a preview of a
       chosen file now shows what will actually be stored. -->
  <AvatarImage data-slot="avatar-image" v-bind="props" class="aspect-square size-full object-cover">
    <slot />
  </AvatarImage>
</template>

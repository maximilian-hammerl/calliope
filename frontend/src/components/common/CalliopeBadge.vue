<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'label' | 'tag' }>(), { variant: 'label' })
</script>

<template>
  <!-- Two shapes only: an uppercase mono label for a group's privacy, and a sentence-case
       tag for a post's state. Never filled, so colour never signals anything. -->
  <span
    v-if="variant === 'label'"
    class="inline-block rounded-sm border border-line-4 px-[7px] py-1 font-mono text-[10.5px] leading-none font-semibold tracking-[0.12em] whitespace-nowrap text-ink-5 uppercase"
  >
    <slot />
  </span>
  <span
    v-else
    class="inline-block rounded-sm border border-line-5 px-1.5 py-0.5 text-[11.5px] leading-[1.6] whitespace-nowrap text-ink-5"
  >
    <slot />
  </span>
</template>

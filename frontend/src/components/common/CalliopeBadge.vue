<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'label' | 'tag' | 'mark' }>(), { variant: 'label' })
</script>

<template>
  <!-- Three shapes: an uppercase mono label for a group's privacy, a sentence-case tag for a
       post's state, and a `mark` holding an icon instead of a word — same chrome, padded for a
       glyph so it stands 21px like the other two rather than beside them at 14. `align-bottom`
       because a box holding no text has its baseline at its own bottom edge, which left it sitting
       2px above the text badges beside it. Never filled, so colour never signals anything. -->
  <span
    v-if="variant === 'label'"
    class="inline-block rounded-sm border border-line-4 px-[7px] py-1 font-mono text-[10.5px] leading-none font-semibold tracking-[0.12em] whitespace-nowrap text-ink-5 uppercase"
  >
    <slot />
  </span>
  <span
    v-else-if="variant === 'tag'"
    class="inline-block rounded-sm border border-line-5 px-1.5 py-0.5 text-[11.5px] leading-[1.6] whitespace-nowrap text-ink-5"
  >
    <slot />
  </span>
  <span
    v-else
    class="inline-flex items-center rounded-sm border border-line-4 px-[5px] py-[3px] align-bottom text-ink-5"
  >
    <slot />
  </span>
</template>

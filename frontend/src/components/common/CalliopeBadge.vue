<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'label' | 'tag' | 'mark' }>(), { variant: 'label' })
</script>

<template>
  <!-- Three shapes, all standing the same 21px so a row of them reads as one thing: an
       uppercase mono `label` for a one-word state, a sentence-case `tag` for a phrase that has
       to be *read* rather than recognised, and a `mark` holding an icon instead of a word —
       padded for a glyph so it does not sit beside the other two at 14. The tag keeps a real
       line-height where the label uses `leading-none`: uppercase mono has no descenders and
       sentence case does, so its height comes out of the padding instead. `align-bottom` on the
       mark because a box holding no text has its baseline at its own bottom edge, which left it
       sitting 2px above the text badges beside it. Never filled, so colour never signals
       anything. -->
  <span
    v-if="variant === 'label'"
    class="inline-block rounded-sm border border-line-4 px-[7px] py-1 font-mono text-[10.5px] leading-none font-semibold tracking-[0.12em] whitespace-nowrap text-ink-5 uppercase"
  >
    <slot />
  </span>
  <span
    v-else-if="variant === 'tag'"
    class="inline-block rounded-sm border border-line-5 px-1.5 py-[2px] text-[11.5px] leading-[1.3] whitespace-nowrap text-ink-5"
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

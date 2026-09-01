<script setup lang="ts">
import { APP_NAME } from '@/lib/branding'
import { computed } from 'vue'
import markRegular from '@/assets/logo/calliope-c.svg'
import markSmall from '@/assets/logo/calliope-c-small.svg'
import markRegularInverse from '@/assets/logo/calliope-c-inverse.svg'
import markSmallInverse from '@/assets/logo/calliope-c-small-inverse.svg'
import { useTheme } from '@/composables/useTheme'

const props = withDefaults(defineProps<{ size?: number; wordmark?: boolean }>(), {
  size: 22,
  wordmark: false,
})

const { isDark } = useTheme()

/**
 * Two cuts of the same letter, both outlined from Newsreader itself: the regular one at
 * optical size 36, the small one at 8, where the typeface is drawn with sturdier strokes for
 * exactly this reason. The boundary is 32/33 with no gap and no overlap — below it the
 * regular cut's thin top and bottom drop out.
 *
 * Each cut is drawn twice rather than tinted: the dark one is cream, not the ink one recoloured.
 */
const mark = computed<string>(() => {
  const small = props.size <= 32
  if (isDark.value) {
    return small ? markSmallInverse : markRegularInverse
  }
  return small ? markSmall : markRegular
})

/** The lockup geometry the asset set specifies, stated once here rather than at each use. */
const gap = computed<number>(() => props.size * 0.45)
const wordmarkSize = computed<number>(() => props.size * 0.73)

/**
 * The letter's own baseline sits 57.14 down its 64-unit box, so the box extends below it by
 * the C's overshoot. Baseline alignment puts the box's *bottom* on the text baseline, which
 * would float the mark; this drops it by the difference so the two baselines meet.
 */
const baselineOffset = computed<number>(() => props.size * ((64 - 57.14) / 64))
</script>

<template>
  <span class="inline-flex items-baseline" :style="{ gap: `${gap}px` }">
    <!-- The mark is a path, so it needs no webfont and cannot reflow while one loads. -->
    <img
      :src="mark"
      :width="size"
      :height="size"
      alt="Calliope"
      :style="{
        width: `${size}px`,
        height: `${size}px`,
        marginBottom: `-${baselineOffset}px`,
      }"
    />
    <!-- The wordmark stays live text: it keeps its hinting at any size and is selectable. -->
    <span
      v-if="wordmark"
      class="font-serif leading-none font-semibold tracking-[0.01em] text-ink-1"
      :style="{ fontSize: `${wordmarkSize}px` }"
    >
      {{ APP_NAME }}
    </span>
  </span>
</template>

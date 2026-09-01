<script setup lang="ts">
/**
 * Two-sided, like `StatusMark`: a group is always private or public, so „öffentlich" is read
 * rather than inferred from a missing lock. That argument alone does not pick a side — it fits an
 * idea's open/closed just as well, which is why both are two-sided now. What decides it is in the
 * design system: whether the fact is the thing's own or the reader's, and what misreading costs.
 * The page heading keeps the word, which is what teaches the lock.
 *
 * Open question: the two glyphs are a shackle apart at 13px on the fact whose misreading costs
 * most. The design system records what else was tried and what feedback would settle it.
 */
import StateMark from '@/components/common/StateMark.vue'
import { VISIBILITY_ICONS, VISIBILITY_LABELS } from '@/lib/format/group'

const props = defineProps<{ visibility: 'private' | 'public'; interactive?: boolean }>()
</script>

<template>
  <StateMark
    :icon="VISIBILITY_ICONS[props.visibility]"
    :label="VISIBILITY_LABELS[props.visibility]"
    :interactive="props.interactive"
  />
</template>

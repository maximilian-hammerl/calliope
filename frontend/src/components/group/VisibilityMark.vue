<script setup lang="ts">
/**
 * Both states show a mark, unlike the three one-sided ones: a group is always one of two things, so
 * „öffentlich" should be read rather than inferred from a missing lock. The page heading keeps the
 * word, which is what teaches the lock.
 *
 * Open question: the two glyphs are a shackle apart at 13px on the fact whose misreading costs
 * most. The design system records what else was tried and what feedback would settle it.
 */
import { Lock, LockOpen } from '@lucide/vue'
import StateMark from '@/components/common/StateMark.vue'
import { VISIBILITY_LABELS } from '@/lib/format/group'

const props = defineProps<{ visibility: 'private' | 'public' }>()
</script>

<template>
  <StateMark
    :icon="props.visibility === 'private' ? Lock : LockOpen"
    :label="VISIBILITY_LABELS[props.visibility]"
  />
</template>

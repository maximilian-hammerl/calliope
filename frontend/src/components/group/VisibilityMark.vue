<script setup lang="ts">
/**
 * Both states show a mark, unlike „Favorit" and „Gelesen": a group is always one of two things, so
 * „öffentlich" should be read rather than inferred from a missing lock. The page heading keeps the
 * word, which is what teaches the lock.
 *
 * The two glyphs are a shackle apart at 13px and this is the mark whose misreading costs most, so
 * it ships to collect feedback — see the design system, which records what else was tried.
 */
import { computed } from 'vue'
import { Lock, LockOpen } from '@lucide/vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { VISIBILITY_LABELS } from '@/lib/format/group'

const props = defineProps<{ visibility: 'private' | 'public' }>()

const label = computed<string>(() => VISIBILITY_LABELS[props.visibility])
</script>

<template>
  <CalliopeBadge variant="mark" :title="label" :aria-label="label" role="img" class="shrink-0">
    <component
      :is="props.visibility === 'private' ? Lock : LockOpen"
      :size="13"
      :stroke-width="1.5"
      aria-hidden="true"
    />
  </CalliopeBadge>
</template>

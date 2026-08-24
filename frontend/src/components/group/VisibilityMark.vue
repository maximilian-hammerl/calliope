<script setup lang="ts">
/**
 * A group's visibility as a mark, for a row that is scanned rather than read. Unlike „Favorit",
 * „Gelesen" and „Geschlossen", **both states show one**: those three are a mark or nothing, because
 * their absence says nothing worth a chip, while a group is always one of two things and
 * „öffentlich" should be read rather than inferred from a missing lock.
 *
 * The page heading keeps the word — see `GroupHeader`. That is what teaches the lock: you meet
 * „Privat" on the group's own page, and it is also the screen somebody is on when they are about to
 * write, which is where a misread visibility would actually cost something.
 *
 * **Open question, pending member feedback.** The two glyphs differ only by where the shackle sits,
 * which is a fine distinction at 13px, and this is the fact whose misreading costs the most. Three
 * ways out were tried and are worse: filling either lock makes a solid body that stops reading as a
 * lock at all, and `Globe` for public claims the internet when „öffentlich" here means the
 * community. If members do report confusing the two, the fix is the word — see the design system.
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

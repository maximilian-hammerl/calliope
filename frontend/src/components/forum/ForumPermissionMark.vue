<script setup lang="ts">
/**
 * What members may do with this row, for the operators who decide it. `write` renders nothing.
 *
 * Without it an operator cannot tell a hidden folder from a public one, and could write an
 * announcement into one believing it was published.
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import StateMark from '@/components/common/StateMark.vue'
import { FORUM_PERMISSION_ICONS, FORUM_PERMISSION_LABELS } from '@/lib/format/forum'
import type { ForumPermission } from '@/lib/format/forum'

const props = defineProps<{ permission: ForumPermission }>()

const icon = computed<Component | undefined>(() => FORUM_PERMISSION_ICONS[props.permission])
const label = computed<string | undefined>(() => FORUM_PERMISSION_LABELS[props.permission])
</script>

<template>
  <StateMark v-if="icon !== undefined && label !== undefined" :icon="icon" :label="label" />
</template>

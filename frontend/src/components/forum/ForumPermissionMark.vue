<script setup lang="ts">
/**
 * What may be written here, for whoever is reading. `write` renders nothing.
 *
 * Shown to members as well as operators, unlike when it was an `Eye`: a member cannot otherwise
 * tell a read-only thread from a writable one without opening it and noticing the composer is
 * missing. An operator needs it for the other reason — without it a hidden folder looks like a
 * published one, and an announcement could go into it.
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import StateMark from '@/components/common/StateMark.vue'
import { forumPermissionMark } from '@/lib/format/forum'
import type { ForumPermission } from '@/lib/format/forum'

const props = defineProps<{ permission: ForumPermission; isOperator: boolean }>()

const mark = computed<{ icon: Component; label: string } | undefined>(() =>
  forumPermissionMark(props.permission, props.isOperator),
)
</script>

<template>
  <StateMark v-if="mark" :icon="mark.icon" :label="mark.label" />
</template>

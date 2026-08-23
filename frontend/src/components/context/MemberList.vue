<script setup lang="ts">
import type { ListMemberships200ResultsItem } from '@/api/models'

defineProps<{ memberships: ListMemberships200ResultsItem[] }>()

// Grammatical gender follows the person, which nothing here knows, so the role names stay
// neutral rather than guessing between Autor and Autorin.
const ROLE_LABELS: Record<string, string> = {
  administrator: 'Admin',
  writer: 'Schreibt',
  reader: 'Liest',
}
</script>

<!-- Pinned to the foot of the rail, but only where the rail exists: in the mobile sheet
     `sticky` covered the block above it, and its own opaque paper hid it completely. -->
<template>
  <div>
    <div class="text-rail text-ink-4">
      <div v-for="membership in memberships" :key="membership.userId">
        {{ membership.username }}
        <span class="text-ink-6">
          · {{ ROLE_LABELS[membership.role] ?? membership.role
          }}{{ membership.status === 'invited' ? ' · eingeladen' : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

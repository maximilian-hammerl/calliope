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

<template>
  <!-- Sticky to the bottom of the rail, on solid paper so text never overlaps text. -->
  <div class="sticky -bottom-4 mt-auto border-t border-line-3 bg-paper-2 pt-[14px]">
    <div class="mb-[10px] text-[12.5px] font-semibold text-ink-4">Mitglieder</div>
    <div class="text-[12.5px] leading-[1.95] text-ink-4">
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

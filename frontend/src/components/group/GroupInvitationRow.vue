<script setup lang="ts">
import { computed } from 'vue'
import type { ListGroups200ResultsItem } from '@/api/models'
import { useOwnMembership } from '@/composables/useOwnMembership'
import { formatActivityTime } from '@/lib/format/formatTime'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import GroupRow from '@/components/group/GroupRow.vue'

/**
 * A pending invitation in the Einladungen section. Answering it here rather than only on the
 * group's page: deciding about three invitations should not be three visits.
 */
const props = defineProps<{ group: ListGroups200ResultsItem }>()

const { accept, decline, isAccepting, isDeclining, isBusy, error } = useOwnMembership(
  () => props.group.id,
)

// Grammatical gender follows the person, which nothing here knows, so the offer is stated as
// what it lets you do rather than as a noun.
const ROLE_CLAUSE: Record<string, string> = {
  administrator: 'Du sollst die Gruppe verwalten.',
  writer: 'Du sollst mitschreiben.',
  reader: 'Du sollst mitlesen.',
}

const offer = computed<string | undefined>(() =>
  props.group.role === null ? undefined : ROLE_CLAUSE[props.group.role],
)
</script>

<template>
  <GroupRow :group="group">
    <!-- The date the list is now ordered by, so the order is visible rather than merely true. -->
    <template v-if="group.invitedAt" #meta>
      · eingeladen {{ formatActivityTime(group.invitedAt) }}
    </template>

    <template #actions>
      <Button size="sm" :disabled="isBusy" @click="accept">
        <Spinner v-if="isAccepting" />
        Beitreten
      </Button>
      <Button variant="outline" size="sm" :disabled="isBusy" @click="decline">
        <Spinner v-if="isDeclining" />
        Ablehnen
      </Button>
      <span v-if="offer" class="text-[12.5px] text-ink-5">{{ offer }}</span>
    </template>
  </GroupRow>

  <Alert v-if="error" variant="destructive" role="alert" class="mb-4">
    <AlertDescription>{{ error }}</AlertDescription>
  </Alert>
</template>

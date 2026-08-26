<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import type { ListMemberships200ResultsItem } from '@/api/models'
import { useOwnMembership } from '@/composables/useOwnMembership'
import { formatActivityTime } from '@/lib/format/formatTime'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * What a pending invitation looks like from the invited member's side, on the group's own
 * page. Until this existed the backend could accept one but nothing ever asked it to: the
 * notification led here and the page offered no way through.
 */
const props = defineProps<{
  groupId: string
  role: ListMemberships200ResultsItem['role']
  /** The reader's own membership row, for who invited them and when. */
  own?: ListMemberships200ResultsItem
}>()

const router = useRouter()

// The role reads as what it lets you do, which also keeps it neutral where a noun would
// force a guess at somebody's gender.
const ROLE_CLAUSE: Record<ListMemberships200ResultsItem['role'], string> = {
  administrator: 'Du verwaltest die Gruppe.',
  writer: 'Du schreibst mit.',
  reader: 'Du liest mit.',
}

const sentence = computed<string>(() => {
  const who = props.own?.invitedByUsername
  const when = props.own?.invitedAt
  const opening =
    who === null || who === undefined
      ? 'Du bist in diese Gruppe eingeladen'
      : `${who} hat dich in diese Gruppe eingeladen`
  const time = when === null || when === undefined ? '' : ` ${formatActivityTime(when)}`
  return `${opening}${time}. ${ROLE_CLAUSE[props.role]}`
})

const { accept, decline, isAccepting, isDeclining, isBusy, error } = useOwnMembership(
  toRef(props, 'groupId'),
)

async function onDecline() {
  if (!(await decline())) {
    return
  }
  // A declined private group stops being readable, so staying here would show the error page.
  void router.push({ name: 'myGroups' })
}
</script>

<template>
  <!-- Raised paper on the canvas with a hairline, no fill and no shadow: the same way a panel
       card is set apart, since this is a state of the page rather than a warning about it. -->
  <section class="border border-line-3 bg-paper-0 px-4 py-3.5">
    <p class="max-w-[60ch] text-body text-ink-2">{{ sentence }}</p>

    <Alert v-if="error" variant="destructive" role="alert" class="mt-3">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div class="mt-3.5 flex flex-wrap items-center gap-2">
      <Button size="sm" :disabled="isBusy" @click="accept">
        <Spinner v-if="isAccepting" />
        Beitreten
      </Button>
      <Button variant="outline" size="sm" :disabled="isBusy" @click="onDecline">
        <Spinner v-if="isDeclining" />
        Ablehnen
      </Button>
    </div>
  </section>
</template>

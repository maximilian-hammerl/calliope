<script setup lang="ts">
/**
 * One toggle for all five kinds, because favouriting is the same act whatever it names.
 *
 * Success is emitted, because what to refetch belongs to the caller; the failure is not, because it
 * is the same sentence everywhere and delegating it is how it went unshown.
 *
 * No level prop: this only sits on a thing's own page, which is always Quiet.
 */
import { computed } from 'vue'
import type { SetFavouriteTargetType } from '@/components/favourite/targetType'
import { favouriteToggle } from '@/lib/format/favourite'
import { useFavourite } from '@/composables/useFavourite'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  targetType: SetFavouriteTargetType
  targetId: string
  isFavourite: boolean
}>()

const emit = defineEmits<{ changed: [isFavourite: boolean] }>()

const { savingFavourite, favouriteError, changeFavourite } = useFavourite()

const toggle = computed(() => favouriteToggle(props.isFavourite))

async function change() {
  const { next } = toggle.value
  if (await changeFavourite(props.targetType, props.targetId, next)) {
    emit('changed', next)
  }
}
</script>

<template>
  <!-- One inline-flex box rather than the bare button, so a failure has somewhere to be said: in
       a row of buttons this stays a single flex item, and the message appears beside the control
       that produced it instead of relying on five callers to remember an error region. -->
  <span class="inline-flex items-center gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      :title="toggle.title"
      :disabled="savingFavourite"
      @click="change"
    >
      <!-- From `favouriteToggle`, so the three controls cannot show different glyphs for one act.
           Decorative — the label beside it already names the state. -->
      <component :is="toggle.icon" :stroke-width="1.5" aria-hidden="true" />
      {{ toggle.label }}
    </Button>

    <span v-if="favouriteError" class="text-[12.5px] text-destructive" role="alert">
      {{ favouriteError }}
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * One toggle for all five kinds, because favouriting is the same act whatever it names — the same
 * reason `ReportDialog` is one component for seven.
 *
 * A plain labelled button, not an icon: the design system has no mark for this and says words come
 * first, and the read toggle beside it on a story idea already looks exactly like this. The label
 * names the state it will put the thing in, so the two sit together without either explaining
 * itself.
 *
 * It emits rather than invalidating, because what has to be refetched belongs to the caller: a
 * list wants its own key, a detail page wants that one thing, and the carousel wants neither.
 *
 * It does **not** delegate the error the same way. A failure is the same sentence wherever it
 * happens, and leaving it to the caller is how it ended up produced and never shown at all.
 *
 * **It takes no level.** This only ever appears on a thing's own page — a group, a thread, an idea
 * — which is always the object the screen is about, and that is Quiet by the design system's rule.
 * The prop that used to allow otherwise was set to `ghost` at all three call sites and put a Plain
 * control at the head of a row of Quiet ones. A post row and the chat header are Plain because they
 * are row actions, and neither uses this component.
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
      {{ toggle.label }}
    </Button>

    <span v-if="favouriteError" class="text-[12.5px] text-destructive" role="alert">
      {{ favouriteError }}
    </span>
  </span>
</template>

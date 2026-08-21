<script setup lang="ts">
/**
 * Numbered pages for any list. Chosen over endless loading where the job is jumping to a known
 * place rather than reading through — which is what writers do with earlier posts while they
 * compose, and what somebody with many groups does looking for one of them.
 */
import { computed } from 'vue'

const props = defineProps<{ page: number; pageCount: number }>()
const emit = defineEmits<{ go: [page: number] }>()

/** A gap in the run of numbers, rendered as an ellipsis rather than a link. */
const GAP = 'gap' as const

/**
 * The current page with two neighbours, plus the first and last, so thirty pages still fit a
 * 375px screen. First and last are always reachable — "back to the beginning" is the jump a
 * long thread needs most.
 */
const entries = computed<Array<number | typeof GAP>>(() => {
  const { page, pageCount } = props
  const wanted = new Set<number>([1, pageCount, page - 1, page, page + 1])
  const pages = [...wanted].filter((one) => one >= 1 && one <= pageCount).sort((a, b) => a - b)

  return pages.flatMap((one, index) => {
    const previous = pages[index - 1]
    return previous !== undefined && one - previous > 1 ? [GAP, one] : [one]
  })
})
</script>

<template>
  <nav
    v-if="pageCount > 1"
    class="flex flex-wrap items-center gap-x-[2px] gap-y-1"
    aria-label="Seiten"
  >
    <button
      type="button"
      class="flex min-h-11 items-center px-2 text-[13px] text-ink-5 hover:text-oak-deep disabled:text-ink-6 disabled:hover:text-ink-6 md:min-h-9"
      :disabled="page === 1"
      aria-label="Vorherige Seite"
      @click="emit('go', page - 1)"
    >
      ← Zurück
    </button>

    <template v-for="(entry, index) in entries" :key="`${entry}-${index}`">
      <span v-if="entry === GAP" class="px-1 text-[13px] text-ink-6" aria-hidden="true">…</span>
      <!-- Position is the 2px oak underline, never a filled chip. -->
      <button
        v-else
        type="button"
        class="flex min-h-11 min-w-11 items-center justify-center border-b-2 px-2 text-[13px] md:min-h-9 md:min-w-9"
        :class="
          entry === page
            ? 'border-oak font-medium text-ink-1'
            : 'border-transparent text-ink-5 hover:text-oak-deep'
        "
        :aria-label="`Seite ${entry}`"
        :aria-current="entry === page ? 'page' : undefined"
        @click="emit('go', entry)"
      >
        {{ entry }}
      </button>
    </template>

    <button
      type="button"
      class="flex min-h-11 items-center px-2 text-[13px] text-ink-5 hover:text-oak-deep disabled:text-ink-6 disabled:hover:text-ink-6 md:min-h-9"
      :disabled="page === pageCount"
      aria-label="Nächste Seite"
      @click="emit('go', page + 1)"
    >
      Weiter →
    </button>
  </nav>
</template>

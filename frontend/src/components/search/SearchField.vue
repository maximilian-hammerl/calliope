<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, watch } from 'vue'
import { Search } from '@lucide/vue'
import { ComboboxAnchor, ComboboxContent, ComboboxInput, ComboboxRoot } from 'reka-ui'
import { useRoute } from 'vue-router'
import { cn } from '@/lib/utils'
import { useSearch } from '@/composables/useSearch'
import SearchResults from '@/components/search/SearchResults.vue'

/**
 * Built on reka's Combobox rather than a generated `ui/` component: this lives in the top bar
 * with grouped sections and counts, which is far enough from anything the generator produces
 * that owning it outright is simpler than bending one. Reka is what every `ui/` component
 * already stands on, so this is the same layer, not a new dependency.
 */
const props = defineProps<{ class?: HTMLAttributes['class'] }>()

const route = useRoute()

const term = ref<string>('')
const open = ref<boolean>(false)

const { results, isSearching, termIsLongEnough, minimumLength } = useSearch(term)

watch(term, (value) => {
  open.value = value.trim().length > 0
})

// Following a result navigates; leaving the popover open over the page you just asked for
// would be in the way.
watch(
  () => route.fullPath,
  () => {
    open.value = false
    term.value = ''
  },
)
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :ignore-filter="true"
    data-slot="search-field"
    :class="cn('relative', props.class)"
  >
    <ComboboxAnchor class="flex items-center gap-2">
      <Search
        :size="14"
        :stroke-width="1.5"
        class="pointer-events-none absolute left-[10px] text-ink-6"
      />
      <ComboboxInput
        v-model="term"
        aria-label="Suche"
        placeholder="Suche"
        class="h-11 w-full rounded-lg border border-input md:h-9 bg-transparent pr-3 pl-[30px] text-[13px] outline-none placeholder:text-ink-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        @keydown.escape="open = false"
      />
    </ComboboxAnchor>

    <!-- Aligned to the field's trailing edge and given collision padding: the field sits at
         the right of the bar, so a popover growing rightwards runs off the window. Reka
         positions this itself — an `absolute` of our own would fight it. -->
    <ComboboxContent
      position="popper"
      align="end"
      :side-offset="4"
      :collision-padding="12"
      class="z-50 max-h-[min(28rem,var(--reka-popper-available-height))] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto rounded-md border border-line-3 bg-paper-0 shadow-md"
    >
      <SearchResults
        :results="results"
        :is-searching="isSearching"
        :term-is-long-enough="termIsLongEnough"
        :minimum-length="minimumLength"
      />
    </ComboboxContent>
  </ComboboxRoot>
</template>

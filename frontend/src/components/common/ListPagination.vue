<script setup lang="ts">
/**
 * Numbered pages for any list. Chosen over endless loading where the job is jumping to a known
 * place rather than reading through — which is what writers do with earlier posts while they
 * compose, and what somebody with many groups does looking for one of them.
 *
 * A thin wrapper over reka's `Pagination` through `ui/pagination`, whose `siblingCount` and
 * `showEdges` are what used to be a hand-written run of page numbers here. The parts are patched
 * to the design system once, in `ui/`: the underline rather than a filled chip, the 44px target,
 * German copy and Lucide at 1.5 rather than „←" and „→".
 *
 * Its props are reka's own — `page`, `total`, `itemsPerPage` — so there is no second vocabulary
 * to translate between. `usePagedList` returns all three, which is what keeps them agreeing with
 * the `offset` the list was actually fetched with.
 */
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

const props = defineProps<{ page: number; total: number; itemsPerPage: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
</script>

<template>
  <!-- More items than fit one page, rather than a page count: the same question, without the
       division that reka is about to do anyway. -->
  <Pagination
    v-if="props.total > props.itemsPerPage"
    :page="props.page"
    :total="props.total"
    :items-per-page="props.itemsPerPage"
    :sibling-count="1"
    show-edges
    class="mx-0 w-auto justify-start"
    aria-label="Seiten"
    @update:page="emit('update:page', $event)"
  >
    <PaginationContent v-slot="{ items }" class="flex-wrap gap-x-0.5 gap-y-1">
      <PaginationPrevious />

      <template v-for="(item, index) in items">
        <PaginationItem
          v-if="item.type === 'page'"
          :key="item.value"
          :value="item.value"
          :is-active="item.value === props.page"
          :aria-label="`Seite ${item.value}`"
        >
          {{ item.value }}
        </PaginationItem>
        <PaginationEllipsis v-else :key="`ellipsis-${index}`" />
      </template>

      <PaginationNext />
    </PaginationContent>
  </Pagination>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import { useListPages } from '@/api/pages/pages'
import type { ListPages200ResultsItem } from '@/api/models'
import PageDialog from '@/components/page/PageDialog.vue'

/**
 * The group's pages, in the rail on every view that has one. Self-contained rather than emitting
 * upwards: three views render this block, and each would otherwise carry its own dialog.
 */
const props = defineProps<{ groupId: string; mayWrite: boolean }>()

const router = useRouter()

const { data } = useListPages(computed(() => props.groupId))
const pages = computed<ListPages200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const creating = ref<boolean>(false)

function openPage(pageId: string) {
  void router.push({ name: 'page', params: { groupId: props.groupId, pageId } })
}
</script>

<template>
  <div>
    <p v-if="pages.length === 0" class="text-rail text-ink-5">Noch keine Seiten.</p>

    <div v-else class="flex flex-col gap-1.5 text-rail">
      <RouterLink
        v-for="page in pages"
        :key="page.id"
        :to="{ name: 'page', params: { groupId, pageId: page.id } }"
        class="truncate text-ink-4 hover:text-ink-2"
      >
        {{ page.title }}
      </RouterLink>
    </div>

    <!-- Disabled rather than hidden for readers, as Nächste Schritte does it. -->
    <button
      type="button"
      class="mt-[9px] flex min-h-11 items-center gap-1 rounded-lg border border-line-5 bg-paper-3 px-2.5 text-[12.5px] font-medium text-oak-deep disabled:opacity-50 md:min-h-0 md:py-[5px]"
      :disabled="!mayWrite"
      :title="mayWrite ? undefined : 'Nur wer schreibt, kann Seiten anlegen'"
      aria-label="Seite anlegen"
      @click="creating = true"
    >
      <Plus :size="14" :stroke-width="1.5" />
      Seite
    </button>

    <PageDialog v-model:open="creating" :group-id="groupId" @created="openPage" />
  </div>
</template>

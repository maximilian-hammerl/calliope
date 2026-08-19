<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useListGroups } from '@/api/groups/groups'
import type { ListGroups200ResultsItem } from '@/api/models'
import AppLayout from '@/components/layout/AppLayout.vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import CreateGroupDialog from '@/components/group/CreateGroupDialog.vue'
import { Button } from '@/components/ui/button'
import { formatActivityTime } from '@/lib/format/formatTime'

const { data, isPending, isError } = useListGroups({
  limit: 100,
  sortAttribute: 'title',
  sortOrder: 'asc',
})

const groups = computed<ListGroups200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout @create-group="creating = true">
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <h1 class="mb-5 text-[25px] leading-[1.2] text-ink-1">Meine Gruppen</h1>

        <p v-if="isPending" class="text-[12.5px] text-ink-5">Gruppen werden geladen …</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Gruppen lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>

        <div v-else-if="groups.length === 0" class="max-w-[46ch]">
          <p class="text-[13.5px] leading-[1.7] text-ink-4">
            Du gehörst noch zu keiner Gruppe. Gründe eine, um mit anderen zu schreiben, oder warte
            auf eine Einladung.
          </p>
          <!-- Only below md: from there up the left rail carries this, and two buttons for
               one action on one screen is what this replaced. -->
          <Button class="mt-5 md:hidden" @click="creating = true">
            <Plus data-icon="inline-start" :stroke-width="1.5" />
            Gruppe gründen
          </Button>
        </div>

        <div v-else>
          <Button class="mb-6 md:hidden" @click="creating = true">
            <Plus data-icon="inline-start" :stroke-width="1.5" />
            Gruppe gründen
          </Button>

          <!-- Hairline rows, no cards: nothing in the reading surface is boxed or rounded. -->
          <div
            v-for="(group, index) in groups"
            :key="group.id"
            class="py-[26px]"
            :class="index > 0 ? 'border-t border-line-2' : 'pt-0'"
          >
            <div class="flex flex-wrap items-baseline gap-3">
              <RouterLink
                :to="{ name: 'group', params: { groupId: group.id } }"
                class="text-[20px] leading-[1.3] text-ink-1"
              >
                {{ group.title }}
              </RouterLink>
              <CalliopeBadge>
                {{ group.visibility === 'private' ? 'Privat' : 'Öffentlich' }}
              </CalliopeBadge>
            </div>

            <p
              v-if="group.description"
              class="mt-[6px] max-w-[60ch] text-[13px] leading-[1.6] text-ink-4"
            >
              {{ group.description }}
            </p>

            <div class="mt-[6px] text-[12.5px] leading-[1.95] text-ink-5">
              zuletzt {{ formatActivityTime(group.lastActivityAt) }}
            </div>

            <div class="mt-[10px]">
              <Button
                variant="outline"
                size="sm"
                @click="$router.push({ name: 'group', params: { groupId: group.id } })"
              >
                Gruppe öffnen
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>

  <CreateGroupDialog v-model:open="creating" />
</template>

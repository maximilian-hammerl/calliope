<script setup lang="ts">
import { ChevronRight, Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useListGroups } from '@/api/groups/groups'
import type { ListGroups200ResultsItem } from '@/api/models'
import AppLayout from '@/components/layout/AppLayout.vue'
import CreateGroupDialog from '@/components/group/CreateGroupDialog.vue'
import GroupInvitationRow from '@/components/group/GroupInvitationRow.vue'
import GroupRow from '@/components/group/GroupRow.vue'
import { Button } from '@/components/ui/button'
import { countLabel } from '@/lib/format/formatTime'

// The default is the groups this member has joined; being allowed to read a public group is
// not the same as belonging to it, and this page is called Meine Gruppen.
const { data, isPending, isError } = useListGroups({
  limit: 100,
  sortAttribute: 'title',
  sortOrder: 'asc',
})

const groups = computed<ListGroups200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

/**
 * Invitations are a separate ask, so they are a separate query rather than a filter over one
 * list. They are not in the rail either: the rail is the groups you are in.
 */
const { data: invitationsData } = useListGroups({
  limit: 100,
  membership: 'invited',
  sortAttribute: 'title',
  sortOrder: 'asc',
})

const invitations = computed<ListGroups200ResultsItem[]>(() =>
  invitationsData.value?.status === 200 ? invitationsData.value.data.results : [],
)

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout @create-group="creating = true">
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <!-- Above the heading, because an invitation is waiting on an answer and the groups
             below are not waiting on anything. Absent entirely when there are none. -->
        <section v-if="invitations.length > 0" class="mb-9">
          <div class="flex flex-wrap items-baseline gap-3 border-b border-line-3 pb-[10px]">
            <h2 class="text-[15px] leading-[1.3] font-semibold text-ink-2">Einladungen</h2>
            <span class="text-[11.5px] text-ink-5">
              {{ countLabel(invitations.length, 'Einladung', 'Einladungen') }}
            </span>
          </div>

          <div
            v-for="(invitation, index) in invitations"
            :key="invitation.id"
            :class="index > 0 ? 'border-t border-line-2' : ''"
          >
            <GroupInvitationRow :group="invitation" />
          </div>
        </section>

        <h1 class="mb-5 text-[25px] leading-[1.2] text-ink-1">Meine Gruppen</h1>

        <p v-if="isPending" class="text-[12.5px] text-ink-5">Gruppen werden geladen …</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Gruppen lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>

        <div v-else-if="groups.length === 0" class="max-w-[46ch]">
          <p class="text-[13.5px] leading-[1.7] text-ink-4">
            Du gehörst noch zu keiner Gruppe. Gründe eine, um mit anderen zu schreiben, sieh dich
            bei den öffentlichen Gruppen um, oder warte auf eine Einladung.
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

          <GroupRow
            v-for="(group, index) in groups"
            :key="group.id"
            :group="group"
            :class="index > 0 ? 'border-t border-line-2' : 'pt-0'"
          >
            <template #actions>
              <Button
                variant="outline"
                size="sm"
                @click="$router.push({ name: 'group', params: { groupId: group.id } })"
              >
                Gruppe öffnen
              </Button>
            </template>
          </GroupRow>
        </div>

        <!-- The way out of this page: without it, listing only your own groups would leave
             no way to find a public one. -->
        <RouterLink
          :to="{ name: 'discover' }"
          class="mt-8 inline-flex items-center gap-[4px] border-t border-line-2 pt-6 text-[13px] text-ink-5 hover:text-oak-deep"
        >
          Öffentliche Gruppen entdecken
          <ChevronRight :size="14" :stroke-width="1.5" />
        </RouterLink>
      </div>
    </div>
  </AppLayout>

  <CreateGroupDialog v-model:open="creating" />
</template>

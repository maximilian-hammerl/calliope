<script setup lang="ts">
/**
 * Where the story is, and the one place to move it. A select rather than a dialog: this is the
 * field that changes most often, and opening a form to change one enum was the friction.
 */
import { computed, ref } from 'vue'
import { getGetGroupQueryKey, getListGroupsQueryKey, useUpdateGroup } from '@/api/groups/groups'
import type { GetGroup200, GetGroup200StoryStatus } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { STORY_STATUS } from '@/lib/format/storyStatus'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{ group: GetGroup200; mayEdit: boolean }>()

const { mutateAsync: updateGroup, isPending } = useUpdateGroup()

const failed = ref<boolean>(false)

const status = computed<GetGroup200StoryStatus>(() => props.group.storyStatus)

async function change(next: GetGroup200StoryStatus) {
  if (next === props.group.storyStatus) {
    return
  }

  failed.value = false

  try {
    await updateGroup({ groupId: props.group.id, data: { storyStatus: next } })
  } catch {
    failed.value = true
    return
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(props.group.id) }),
    queryClient.invalidateQueries(listOnlyFilter(getListGroupsQueryKey())),
  ])
}
</script>

<template>
  <div>
    <Select
      v-if="mayEdit"
      :model-value="status"
      :disabled="isPending"
      @update:model-value="(value) => change(value as GetGroup200StoryStatus)"
    >
      <!-- „Story-Status" is the rail block's heading, which nothing associates with the control. -->
      <SelectTrigger aria-label="Story-Status" class="w-full text-[12.5px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="entry in STORY_STATUS" :key="entry.value" :value="entry.value">
          {{ entry.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <p v-else class="text-rail font-medium text-ink-4">
      {{ STORY_STATUS.find((entry) => entry.value === status)?.label }}
    </p>

    <p v-if="failed" class="mt-2 text-[11.5px] leading-[1.5] text-destructive" role="alert">
      Der Status ließ sich nicht ändern. Versuche es später noch einmal.
    </p>
  </div>
</template>

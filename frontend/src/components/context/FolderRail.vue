<script setup lang="ts">
import { computed } from 'vue'
import { useFolderTree } from '@/composables/useFolderTree'
import type { TreeNode } from '@/lib/folder/buildTree'
import type { TreeScope } from '@/lib/folder/treeScope'
import FolderRailNode from '@/components/context/FolderRailNode.vue'

/**
 * The group's tree in the rail, to read and to navigate. Read-only on purpose: everything that
 * changes the structure lives on the group's own page, so the rail needs no room for actions and
 * there is one place to look for them.
 */
const props = defineProps<{ groupId: string }>()

const { tree } = useFolderTree(computed<string>(() => props.groupId))

const nodes = computed<TreeNode[]>(() => tree.value)
const scope = computed<TreeScope>(() => ({ kind: 'group', groupId: props.groupId }))
</script>

<template>
  <div>
    <p v-if="nodes.length === 0" class="text-rail text-ink-5">Noch nichts angelegt.</p>

    <!-- A real list, as the group's own tree is: the nesting is what this says, and a margin
         says it only to the eye. -->
    <ul v-else class="flex flex-col gap-1.5 text-rail">
      <FolderRailNode v-for="node in nodes" :key="node.id" :node="node" :scope="scope" />
    </ul>
  </div>
</template>

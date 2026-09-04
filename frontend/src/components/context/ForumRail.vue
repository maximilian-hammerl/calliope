<script setup lang="ts">
import { computed } from 'vue'
import { useIsOperator } from '@/composables/useIsOperator'
import { useForumTree } from '@/composables/useForumTree'
import type { TreeNode } from '@/lib/folder/buildTree'
import type { TreeScope } from '@/lib/folder/treeScope'
import FolderRailNode from '@/components/context/FolderRailNode.vue'

/**
 * The forum's tree in the rail — the group's rail with a different scope. Read-only, as the
 * group's is: what changes the structure lives on the forum's own page.
 */
const { tree } = useForumTree()

/**
 * Only operators are shown what members may do: it is their decision to make, and a member's own
 * view already answers it.
 */
const isOperator = useIsOperator()

const nodes = computed<TreeNode[]>(() => tree.value)
const scope = computed<TreeScope>(() => ({
  kind: 'forum',
  isOperator: isOperator.value,
}))
</script>

<template>
  <div>
    <p v-if="nodes.length === 0" class="text-rail text-ink-5">Noch nichts angelegt.</p>

    <ul v-else class="flex flex-col gap-1.5 text-rail">
      <FolderRailNode v-for="node in nodes" :key="node.id" :node="node" :scope="scope" />
    </ul>
  </div>
</template>

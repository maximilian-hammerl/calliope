<script setup lang="ts">
/**
 * Renders a stored post document.
 *
 * Deliberately not `v-html` and deliberately not a read-only editor: the first would put an
 * injection surface on every post, and the second would mount a ProseMirror instance per post
 * — fifty of them in a long thread. This walks the node tree and emits elements, so a node
 * type nobody allowed simply renders nothing.
 */
import type { PostNode } from '@/lib/postDocument'
import { linkAttributes, marksOf, textOf } from '@/lib/postDocument'

defineProps<{ nodes: PostNode[] }>()
</script>

<template>
  <template v-for="(node, index) in nodes" :key="index">
    <p v-if="node.type === 'paragraph'" class="post-block">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </p>

    <h2 v-else-if="node.type === 'heading' && node.attrs?.level === 2" class="post-heading-2">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </h2>

    <h3 v-else-if="node.type === 'heading'" class="post-heading-3">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </h3>

    <!-- The 2px rule the design system reserves for a quote block. -->
    <blockquote v-else-if="node.type === 'blockquote'" class="post-quote">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </blockquote>

    <ul v-else-if="node.type === 'bulletList'" class="post-list list-disc">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </ul>

    <ol v-else-if="node.type === 'orderedList'" class="post-list list-decimal">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </ol>

    <li v-else-if="node.type === 'listItem'">
      <PostDocument v-if="node.content" :nodes="node.content" />
    </li>

    <br v-else-if="node.type === 'hardBreak'" />

    <template v-else-if="node.type === 'text'">
      <!-- Marks are nested by hand rather than by a lookup, so only these three can appear. -->
      <a
        v-if="linkAttributes(node)"
        :href="linkAttributes(node)?.href"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="text-oak-deep underline underline-offset-2"
      >
        <strong v-if="marksOf(node).bold"
          ><em v-if="marksOf(node).italic">{{ textOf(node) }}</em
          ><template v-else>{{ textOf(node) }}</template></strong
        >
        <em v-else-if="marksOf(node).italic">{{ textOf(node) }}</em>
        <template v-else>{{ textOf(node) }}</template>
      </a>
      <strong v-else-if="marksOf(node).bold"
        ><em v-if="marksOf(node).italic">{{ textOf(node) }}</em
        ><template v-else>{{ textOf(node) }}</template></strong
      >
      <em v-else-if="marksOf(node).italic">{{ textOf(node) }}</em>
      <template v-else>{{ textOf(node) }}</template>
    </template>
  </template>
</template>

<script setup lang="ts">
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/**
 * The three things a member can add, with a line each saying what they are for. Written once
 * and used by both menus — the root's and every folder row's — so the wording cannot drift.
 *
 * The lines exist because „Seite" against „Thema" means nothing to somebody new: the
 * difference is that one is revised and the other is answered.
 */
const emit = defineEmits<{ choose: [kind: 'folder' | 'page' | 'thread'] }>()

// Ordered by how often a member reaches for them: writing first, structure last. It is also the
// order the tree itself reads in, where leaves sit above folders.
const KINDS = [
  {
    kind: 'thread',
    label: 'Thema',
    note: 'Beiträge, die aufeinander folgen — hier wird erzählt.',
  },
  {
    kind: 'page',
    label: 'Seite',
    note: 'Ein Text, den die Gruppe pflegt: ein Ort, eine Figur, eine Regel.',
  },
  { kind: 'folder', label: 'Ordner', note: 'Ordnet Themen, Seiten und weitere Ordner.' },
] as const
</script>

<template>
  <DropdownMenuItem
    v-for="entry in KINDS"
    :key="entry.kind"
    class="flex-col items-start gap-0.5"
    @click="emit('choose', entry.kind)"
  >
    <span class="font-medium">{{ entry.label }}</span>
    <span class="max-w-[34ch] text-[11.5px] leading-[1.35] text-ink-5">{{ entry.note }}</span>
  </DropdownMenuItem>
</template>

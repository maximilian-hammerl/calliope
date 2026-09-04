<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/**
 * The three things a member can add, with a line each saying what they are for. Written once
 * and used by both menus — the root's and every folder row's — so the wording cannot drift.
 *
 * The lines exist because „Seite" against „Thema" means nothing to somebody new. They open on
 * the same contrast in the same shape — **viele Beiträge** against **ein Text** — because that
 * is the difference: a thema accumulates posts that each belong to whoever wrote them, a seite
 * is one document the group writes together. The permissions follow from it, so the wording and
 * `mayAct`'s table say the same thing.
 */
const emit = defineEmits<{ choose: [kind: Kind] }>()

type Kind = 'folder' | 'page' | 'thread'

/**
 * Which of the three to offer. The forum leaves `folder` out until there is a surface for its
 * permissions (#32's seventh slice) — a restriction rather than a second component, so the
 * wording still cannot drift.
 */
const props = defineProps<{ only?: ReadonlyArray<Kind> }>()

// Ordered by how often a member reaches for them: writing first, structure last. It is also the
// order the tree itself reads in, where leaves sit above folders.
const KINDS = [
  {
    kind: 'thread',
    label: 'Thema',
    note: 'Viele Beiträge, einer nach dem anderen. Jeder gehört dem, der ihn geschrieben hat.',
  },
  {
    kind: 'page',
    label: 'Seite',
    note: 'Ein Text, den alle gemeinsam schreiben und ändern: ein Ort, eine Figur, eine Regel.',
  },
  { kind: 'folder', label: 'Ordner', note: 'Ordnet Themen, Seiten und weitere Ordner.' },
] as const

const offered = computed<ReadonlyArray<(typeof KINDS)[number]>>(() => {
  const only = props.only
  return only === undefined ? KINDS : KINDS.filter((entry) => only.includes(entry.kind))
})
</script>

<template>
  <DropdownMenuItem
    v-for="entry in offered"
    :key="entry.kind"
    class="flex-col items-start gap-0.5"
    @click="emit('choose', entry.kind)"
  >
    <span class="font-medium">{{ entry.label }}</span>
    <span class="max-w-[34ch] text-[11.5px] leading-[1.35] text-ink-5">{{ entry.note }}</span>
  </DropdownMenuItem>
</template>

<script setup lang="ts">
/**
 * The right rail as a bottom sheet, for the widths where the rail itself is not shown. Not
 * `ui/dialog`, which centres and zooms.
 *
 * shadcn-vue does ship a `sheet`, and it was compared: nine files and a four-sided `cva`, of
 * which this needs one side. Its bottom variant has no height cap and no `overflow`, so a tall
 * sheet runs off the screen; its `gap-4` sits on a box that is not `flex`, so it does nothing;
 * and its chrome — square corners, `bg-black/80`, an opacity-70 close — is overridden by every
 * rule this file follows anyway. What would be left of the generated component is the four
 * `DialogPortal` lines below. Reaching for reka here is the cheaper of the two.
 */
import { useId } from 'vue'
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

const open = defineModel<boolean>('open', { required: true })

/**
 * Both required, with no default: the sheet said „Gruppen-Kontext" wherever it was used, so the
 * forum's rail introduced itself as a group's. A default would have been the same bug with a
 * fallback under it.
 */
defineProps<{ label: string; description: string }>()

// reka only fills the content's id in for a `DialogTrigger`, and this opens from `open`.
const contentId = useId()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ink-1/40" />

      <DialogContent
        :id="contentId"
        data-slot="context-sheet"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col gap-5 overflow-y-auto rounded-t-lg border-t border-line-3 bg-paper-2 px-gutter pt-4 pb-8 shadow-[0_-2px_16px_rgba(43,38,32,0.14)] data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
      >
        <div class="flex items-center">
          <DialogTitle
            class="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-ink-label uppercase"
          >
            {{ label }}
          </DialogTitle>

          <!-- Not shown: a rail carries its label and nothing more. It exists because reka
               points `aria-describedby` at it regardless, and without it that reference
               dangles — a screen reader is promised a description and finds none. -->
          <DialogDescription class="sr-only">{{ description }}</DialogDescription>
          <DialogClose
            class="ml-auto flex size-11 items-center justify-center rounded-md text-ink-label"
            aria-label="Schließen"
          >
            <X :size="16" :stroke-width="1.5" />
          </DialogClose>
        </div>

        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

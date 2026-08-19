<script setup lang="ts">
/**
 * A door with nothing behind it yet. The personal menu names what will live there so the
 * shape of the product is legible before all of it exists, and each says plainly that it is
 * not built rather than pretending to be empty.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

defineProps<{ title: string; description: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <p class="text-[13.5px] leading-[1.7] text-ink-4">
        Diese Funktion gibt es noch nicht. Sie steht hier, damit du siehst, was kommt.
      </p>
    </DialogContent>
  </Dialog>
</template>

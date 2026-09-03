<script setup lang="ts">
/**
 * The sign-in, registration and mailed-link pages, which nine views wrote out identically.
 *
 * Centred by `m-auto`, not `items-center`: an overflowing flex item under `items-center` is
 * pushed past the start edge and cannot be scrolled back to — registration lost its heading.
 */
</script>

<template>
  <div class="flex flex-1 flex-col overflow-auto px-6 py-12">
    <div class="m-auto w-full max-w-[380px]">
      <slot />
    </div>
  </div>
</template>

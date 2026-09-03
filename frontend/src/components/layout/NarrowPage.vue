<script setup lang="ts">
/**
 * A single narrow column centred in the frame: the sign-in and registration pages, and the
 * landing pages a mailed link opens. Nine views wrote this shell out identically, which is how
 * all nine ended up with a `<main>` of their own nested inside `AppLayout`'s.
 *
 * It scrolls rather than growing the page: `AppLayout` is `h-svh`, so a form taller than the
 * viewport — registration at 375×667 — has to scroll inside this column.
 *
 * **Centred by `m-auto`, not by `items-center`.** An overflowing flex item under `items-center`
 * is pushed past the container's start edge and cannot be scrolled back to: registration lost
 * its heading and its first field, 113px above a top nobody could reach. Auto margins resolve
 * to zero when there is no free space, so the column centres when it fits and starts at the top
 * when it does not.
 */
</script>

<template>
  <div class="flex flex-1 flex-col overflow-auto px-6 py-12">
    <div class="m-auto w-full max-w-[380px]">
      <slot />
    </div>
  </div>
</template>

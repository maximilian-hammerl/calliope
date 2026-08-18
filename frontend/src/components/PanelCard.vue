<script setup lang="ts"></script>

<template>
  <!-- Panel cards are the only cards in the product, and they never cast a shadow. -->
  <div
    class="rounded-lg border border-line-3 bg-paper-0 px-[10px] py-[9px] text-[12.5px] leading-[1.3] text-ink-4"
  >
    <slot />
  </div>
</template>

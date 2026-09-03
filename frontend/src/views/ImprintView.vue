<script setup lang="ts">
/**
 * Lays out what `lib/imprint.ts` was configured with. German whatever the interface becomes: the
 * language of a legal notice is itself legally meaningful.
 */
import { IMPRINT, IMPRINT_ADDRESS } from '@/lib/imprint'
</script>

<template>
  <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
    <div class="reading-column">
      <h1 class="mb-6 text-h1 text-ink-1">Impressum</h1>

      <!-- DDG, not TMG: the duty moved in 2024 and the old citation is still copied around. -->
      <h2 class="mb-2 text-h2 text-ink-1">Angaben gemäß § 5 DDG</h2>
      <p class="text-body text-ink-4">{{ IMPRINT.name }}</p>

      <!-- Lines, not prose broken by `<br>`, so a screen reader reads it as an address. -->
      <address v-if="IMPRINT_ADDRESS" class="mt-1 text-body text-ink-4 not-italic">
        <span v-if="IMPRINT_ADDRESS.street" class="block">{{ IMPRINT_ADDRESS.street }}</span>
        <span class="block">{{ IMPRINT_ADDRESS.town }}</span>
      </address>

      <h2 class="mt-8 mb-2 text-h2 text-ink-1">Kontakt</h2>
      <dl class="flex flex-col gap-1 text-body text-ink-4">
        <div v-if="IMPRINT.telephone" class="flex flex-wrap gap-x-2">
          <dt>Telefon:</dt>
          <dd>
            <!-- Without the spaces a printed number carries, or a phone dials the gaps. -->
            <a
              class="underline underline-offset-2"
              :href="`tel:${IMPRINT.telephone.replace(/\s/gu, '')}`"
            >
              {{ IMPRINT.telephone }}
            </a>
          </dd>
        </div>
        <div class="flex flex-wrap gap-x-2">
          <dt>E-Mail:</dt>
          <dd>
            <a class="underline underline-offset-2" :href="`mailto:${IMPRINT.emailAddress}`">
              {{ IMPRINT.emailAddress }}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Lays out what `lib/imprint.ts` was configured with. German whatever the interface becomes: the
 * language of a legal notice is itself legally meaningful.
 */
import { WEBSITE_OPERATOR, WEBSITE_OPERATOR_ADDRESS } from '@/lib/websiteOperator'
</script>

<template>
  <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
    <div class="reading-column prose-legal">
      <h1 class="mb-6 text-h1 text-ink-1">Impressum</h1>

      <!-- DDG, not TMG: the duty moved in 2024 and the old citation is still copied around. -->
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>{{ WEBSITE_OPERATOR.name }}</p>

      <!-- Lines, not prose broken by `<br>`, so a screen reader reads it as an address. -->
      <address v-if="WEBSITE_OPERATOR_ADDRESS">
        <span v-if="WEBSITE_OPERATOR_ADDRESS.street" class="block">{{
          WEBSITE_OPERATOR_ADDRESS.street
        }}</span>
        <span class="block">{{ WEBSITE_OPERATOR_ADDRESS.town }}</span>
      </address>

      <h2>Kontakt</h2>
      <dl>
        <div v-if="WEBSITE_OPERATOR.telephoneNumber" class="flex flex-wrap gap-x-2">
          <dt>Telefon:</dt>
          <dd>
            <!-- Without the spaces a printed number carries, or a phone dials the gaps. -->
            <a :href="`tel:${WEBSITE_OPERATOR.telephoneNumber.replace(/\s/gu, '')}`">
              {{ WEBSITE_OPERATOR.telephoneNumber }}
            </a>
          </dd>
        </div>
        <div class="flex flex-wrap gap-x-2">
          <dt>E-Mail:</dt>
          <dd>
            <a :href="`mailto:${WEBSITE_OPERATOR.emailAddress}`">
              {{ WEBSITE_OPERATOR.emailAddress }}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>

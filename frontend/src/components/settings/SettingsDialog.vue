<script setup lang="ts">
/**
 * One accordion rather than a stack of forms: each section owns its own primary button, and
 * only one is ever open, so two of them never compete for the same glance. It also gives the
 * next setting somewhere obvious to go.
 *
 * A section per component, because each owns its own fields, validation and failure messages
 * and shares none of them.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import DeleteAccountSection from '@/components/settings/DeleteAccountSection.vue'
import AppearanceSection from '@/components/settings/AppearanceSection.vue'
import EmailAddressSection from '@/components/settings/EmailAddressSection.vue'
import PasswordSection from '@/components/settings/PasswordSection.vue'
import BlockedMembersSection from '@/components/settings/BlockedMembersSection.vue'
import SessionsSection from '@/components/settings/SessionsSection.vue'

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Einstellungen</DialogTitle>
        <DialogDescription>Dein Konto, und worüber du benachrichtigt wirst.</DialogDescription>
      </DialogHeader>

      <!-- All closed to begin with: opening this should not present a form asking for a
           password, and deleting the account must never be the first thing on screen. -->
      <Accordion type="single" collapsible class="w-full">
        <AccordionItem value="appearance">
          <AccordionTrigger>Erscheinungsbild</AccordionTrigger>
          <AccordionContent>
            <AppearanceSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="email">
          <AccordionTrigger>E-Mail-Adresse</AccordionTrigger>
          <AccordionContent>
            <EmailAddressSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="password">
          <AccordionTrigger>Passwort</AccordionTrigger>
          <AccordionContent>
            <PasswordSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sessions">
          <AccordionTrigger>Anmeldungen</AccordionTrigger>
          <AccordionContent>
            <SessionsSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="blocks">
          <AccordionTrigger>Blockierte Mitglieder</AccordionTrigger>
          <AccordionContent>
            <BlockedMembersSection />
          </AccordionContent>
        </AccordionItem>

        <!-- Last, and the only destructive action in the product: the one place a red button
             is the honest colour. -->
        <AccordionItem value="deletion">
          <AccordionTrigger>Konto löschen</AccordionTrigger>
          <AccordionContent>
            <DeleteAccountSection />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * The settings dialog's account-deletion section. Only the copy lives here: a member with
 * groups has to be told what happens to what they wrote, which the verification wall does not.
 */
import MailedLinkNote from '@/components/common/MailedLinkNote.vue'
import { computed, ref } from 'vue'
import { useGetCurrentUser } from '@/api/auth/auth'
import DeleteAccountForm from '@/components/settings/DeleteAccountForm.vue'

const { data: currentUser } = useGetCurrentUser()
const currentAddress = computed<string>(() =>
  currentUser.value?.status === 200 ? currentUser.value.data.emailAddress : '',
)

const requested = ref<boolean>(false)
</script>

<template>
  <template v-if="requested">
    <p class="text-row text-ink-5">
      Wir haben einen Link an <span class="text-ink-2">{{ currentAddress }}</span> geschickt. Erst
      wenn du ihn öffnest, wird dein Konto gelöscht. Bis dahin bleibt alles, wie es ist.
    </p>
    <MailedLinkNote class="mb-4 text-[13px]" />
  </template>

  <DeleteAccountForm @requested="requested = true">
    <p>
      Löschen ist <span class="text-ink-2">endgültig</span>. Wir können dein Konto danach nicht
      zurückholen.
    </p>
    <p>
      Es passiert nicht sofort: wir schicken dir erst einen Link an deine E-Mail-Adresse. Solange du
      ihn nicht öffnest, bleibt dein Konto bestehen.
    </p>
    <p>
      Weg sind dein Konto, deine Mitgliedschaften, deine Einladungen, deine Benachrichtigungen und
      deine Storyideen. Was du in Gruppen geschrieben hast, bleibt dort stehen — es gehört zu
      Geschichten, an denen andere weitergeschrieben haben — aber ohne deinen Namen. Gruppen, in
      denen sonst niemand mehr ist, werden mit gelöscht.
    </p>
  </DeleteAccountForm>
</template>

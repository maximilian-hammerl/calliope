<script setup lang="ts">
/**
 * What a member is told about the instance they are on, wherever there is room to say it in
 * full — the way in (sign in, register) and the page they land on. Everywhere else it is the
 * badge in the top bar, because the application already stacks three bars on a phone and this
 * must not become a fourth.
 *
 * Never `destructive`: red is reserved for irreversibly destroying writing, and a fill that
 * sits on every page of a test instance stops meaning anything by the time a real deletion
 * dialog needs it. The Quiet surface reads as chrome, which is what this is.
 */
import { computed } from 'vue'
import { ENVIRONMENT, PASSWORD_REUSE_WARNING, environmentNotice } from '@/lib/environment'

const props = defineProps<{
  /** Set where a password is chosen or typed; silent about passwords everywhere else. */
  aboutPasswords?: boolean
}>()

const notice = computed(() => environmentNotice(ENVIRONMENT))

const warnAboutPasswords = computed<boolean>(
  () => props.aboutPasswords && notice.value?.publiclyReachable === true,
)
</script>

<template>
  <div
    v-if="notice"
    class="rounded-lg border border-line-5 bg-paper-3 px-[13px] py-2.5"
    role="status"
  >
    <p class="text-[13px] leading-[1.5] text-ink-2">{{ notice.sentence }}</p>
    <p v-if="warnAboutPasswords" class="mt-1 text-control text-ink-4">
      {{ PASSWORD_REUSE_WARNING }}
    </p>
  </div>
</template>

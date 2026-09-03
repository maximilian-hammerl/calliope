<script setup lang="ts">
/**
 * The frame around every page, mounted once by `App.vue`: a page that rendered its own tore the
 * bars down on every navigation, taking the chat stream with them. Groups belong to `GroupLayout`.
 */
import { computed } from 'vue'
import type { GetCurrentUser200 } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import TopBar from '@/components/layout/TopBar.vue'
import BottomBar from '@/components/layout/BottomBar.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'

const { data: userData } = useGetCurrentUser()
const user = computed<GetCurrentUser200 | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data : undefined,
)
</script>

<template>
  <div class="flex h-svh flex-col bg-paper-1">
    <TopBar v-if="user" :user="user" />

    <main class="flex min-h-0 min-w-0 flex-1 flex-col">
      <slot />
    </main>

    <!-- Signed out only: below `md` the bottom edge already carries `BottomBar` and a thread's
         composer. Members reach the legal pages from the account menu. -->
    <SiteFooter v-if="!user" />

    <!-- Signed out every destination bounces back to sign-in. -->
    <BottomBar v-if="user" />
  </div>
</template>

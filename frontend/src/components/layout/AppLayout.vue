<script setup lang="ts">
/**
 * The frame around every page: the bars and the scrolling body between them. Mounted once by
 * `App.vue` around the router view, not by each page — when each page rendered its own, every
 * navigation tore the whole thing down and built it again, which closed and reopened the chat
 * stream and refetched the chat list each time.
 *
 * It knows nothing about groups. Anything a group's pages need — the rails, the sheet, the
 * group's own queries — belongs to `GroupLayout`, which is the parent route of those pages.
 */
import { computed } from 'vue'
import type { GetCurrentUser200 } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import TopBar from '@/components/layout/TopBar.vue'
import BottomBar from '@/components/layout/BottomBar.vue'

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

    <BottomBar />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GetCurrentUser200 } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import TopBar from '@/components/layout/TopBar.vue'

// The route guard has already resolved this query, so the cached answer is read here rather
// than fetched again.
const { data } = useGetCurrentUser()

// The generated type is a union over every declared status, and only the 200 branch carries
// a user.
const user = computed<GetCurrentUser200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)
</script>

<template>
  <TopBar v-if="user" :user="user" />
  <main />
</template>

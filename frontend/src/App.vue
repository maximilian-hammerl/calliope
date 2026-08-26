<script setup lang="ts">
import { RouterView } from 'vue-router'
import ConnectionLost from '@/components/common/ConnectionLost.vue'
import RateLimited from '@/components/common/RateLimited.vue'
import { backendReachable, rateLimited } from '@/lib/api/queryClient'
</script>

<template>
  <RouterView />

  <!-- Above the router view rather than inside a layout: it has to be able to cover an empty
       page, which is what a member reloading mid-deploy would otherwise be looking at. It
       mounts only while the API is unreachable, which is also what starts and stops the
       retrying it does. -->
  <ConnectionLost v-if="!backendReachable" />

  <!-- Never both: unreachable is the more urgent of the two and says everything this would.
       A limit is only worth reporting while the server is answering at all. -->
  <RateLimited v-else-if="rateLimited" />
</template>

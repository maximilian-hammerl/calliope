<script setup lang="ts">
/** Thin on purpose: the fields that answer "would this person suit me" come next. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGetUser } from '@/api/users/users'
import type { GetUser200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { formatJoinedDate } from '@/lib/format/formatTime'
import AppLayout from '@/components/layout/AppLayout.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { Spinner } from '@/components/ui/spinner'

const route = useRoute()
const userId = computed<string>(() => String(route.params.userId))

const { data, isPending, error } = useGetUser(userId)

const member = computed<GetUser200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)

// From `error`, not `data`: the mutator throws on any non-2xx, so no status reaches `data`.
const notFound = computed<boolean>(
  () => error.value instanceof ApiError && error.value.status === 404,
)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <div
          v-if="isPending"
          class="flex items-center gap-2 text-[13.5px] leading-[1.5] text-ink-5"
        >
          <Spinner data-icon="inline-start" />
          Einen Moment.
        </div>

        <template v-else-if="member">
          <div class="flex items-center gap-4">
            <UserAvatar :username="member.username" size="lg" />

            <div class="flex min-w-0 flex-col gap-1">
              <h1 class="truncate text-[25px] leading-[1.2]">{{ member.username }}</h1>
              <p class="text-[12px] text-ink-6">
                Dabei seit {{ formatJoinedDate(member.createdAt) }}
              </p>
            </div>
          </div>

          <!-- Said outright rather than left as blank space: an empty page reads as an error. -->
          <p class="mt-8 border-t border-line-3 pt-6 text-[13.5px] leading-[1.6] text-ink-5">
            {{ member.username }} hat noch nichts über sich erzählt. Steckbriefe für Mitglieder —
            Genres, woran jemand schreibt, was jemand sucht — kommen noch.
          </p>
        </template>

        <template v-else-if="notFound">
          <h1 class="text-[25px] leading-[1.2]">Kein Mitglied gefunden</h1>
          <p class="mt-5 text-[13.5px] leading-[1.6] text-ink-5">
            Dieses Konto gibt es nicht mehr, oder der Link stimmt nicht.
          </p>
        </template>

        <template v-else>
          <h1 class="text-[25px] leading-[1.2]">Das hat nicht geklappt</h1>
          <p class="mt-5 text-[13.5px] leading-[1.6] text-ink-5">
            Wir konnten dieses Mitglied gerade nicht laden. Versuche es später noch einmal.
          </p>
        </template>
      </div>
    </div>
  </AppLayout>
</template>

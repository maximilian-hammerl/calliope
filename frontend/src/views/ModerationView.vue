<script setup lang="ts">
/**
 * The operators' queue. Oldest open report first, because a queue worked newest-first lets its
 * bottom rot and the oldest report is the one somebody has been waiting longest on.
 *
 * Each row stands alone even when several name the same thing: grouping was considered and left
 * out until the queue is long enough for it to earn its cost.
 */
import { computed, ref, watch } from 'vue'
import { getListReportsQueryKey, useCloseReport, useListReports } from '@/api/reports/reports'
import type { ListReports200ResultsItem, ListReportsBody } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { formatActivityTime } from '@/lib/format/formatTime'
import { pluralize } from '@/lib/format/formatText'
import { REPORT_CATEGORY_LABELS } from '@/lib/format/report'
import { usePagedList } from '@/composables/usePagedList'
import AppLayout from '@/components/layout/AppLayout.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 20

type Status = NonNullable<ListReportsBody['status']>
type Category = NonNullable<ListReportsBody['category']>

const status = ref<Status>('open')
const category = ref<Category | 'all'>('all')

// Declared before the query it pages, and reading the total through a getter, because the
// total comes back from that same query — see the composable's own note.
const { page, offset, pageCount, goToPage } = usePagedList(PAGE_SIZE, () => total.value)

const body = computed<ListReportsBody>(() => ({
  limit: PAGE_SIZE,
  offset: offset.value,
  status: status.value,
  ...(category.value === 'all' ? {} : { category: category.value }),
}))

const { data, isPending } = useListReports(body)

const reports = computed<ListReports200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)
const total = computed<number>(() =>
  data.value?.status === 200 ? data.value.data.totalResults : 0,
)

// A filter narrows the queue, so whatever page was open is about a different set.
watch([status, category], () => goToPage(1))

const { mutateAsync: close, isPending: isClosing } = useCloseReport()
const closingId = ref<string | undefined>(undefined)
const error = ref<string | undefined>(undefined)

async function closeReport(reportId: string, next: 'resolved' | 'dismissed') {
  error.value = undefined
  closingId.value = reportId

  try {
    await close({ reportId, data: { status: next } })
  } catch {
    error.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  } finally {
    closingId.value = undefined
  }

  await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListReportsQueryKey()) })
}

const STATUS_LABELS: Record<Status, string> = {
  open: 'Offen',
  resolved: 'Erledigt',
  dismissed: 'Verworfen',
}

/** What the report is about, in words rather than the enum's. */
const TARGET_LABELS: Record<ListReports200ResultsItem['targetType'], string> = {
  writing_group: 'Gruppe',
  writing_thread: 'Thread',
  writing_post: 'Beitrag',
  story_idea: 'Storyidee',
  chat_group: 'Unterhaltung',
  chat_message: 'Nachricht',
  user: 'Mitglied',
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <h1 class="text-h1">Moderation</h1>
        <p class="mt-2 max-w-[60ch] text-body text-ink-4">
          Was Mitglieder gemeldet haben, das Älteste zuerst.
        </p>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <Select :model-value="status" @update:model-value="(value) => (status = value as Status)">
            <SelectTrigger class="w-[160px] text-[12.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            :model-value="category"
            @update:model-value="(value) => (category = value as Category | 'all')"
          >
            <SelectTrigger class="w-[220px] text-[12.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Gründe</SelectItem>
              <SelectItem
                v-for="(label, value) in REPORT_CATEGORY_LABELS"
                :key="value"
                :value="value"
              >
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p v-if="error" class="mt-4 text-[12.5px] text-destructive" role="alert">{{ error }}</p>

        <p v-if="isPending" class="mt-6 text-[13.5px] text-ink-5">Einen Moment.</p>

        <p v-else-if="reports.length === 0" class="mt-6 text-body text-ink-4">Nichts zu tun.</p>

        <template v-else>
          <p class="mt-6 text-[12.5px] text-ink-5">
            {{ pluralize(total, 'Meldung', 'Meldungen') }}
          </p>

          <ul class="mt-2 flex flex-col">
            <li
              v-for="report in reports"
              :key="report.id"
              class="border-b border-line-2 py-[18px] last:border-b-0"
            >
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span class="text-[13.5px] text-ink-2">
                  {{ TARGET_LABELS[report.targetType] }}
                </span>
                <CalliopeBadge>{{ REPORT_CATEGORY_LABELS[report.category] }}</CalliopeBadge>
                <!-- Only when it is gone: still being there is the ordinary case and says
                     nothing worth a mark. -->
                <CalliopeBadge v-if="!report.targetExists">Gelöscht</CalliopeBadge>
                <CalliopeBadge v-if="report.status !== 'open'">
                  {{ STATUS_LABELS[report.status] }}
                </CalliopeBadge>
              </div>

              <!-- What the thing said when it was reported, which is what makes a report about
                   deleted content still judgeable. -->
              <p class="mt-[6px] line-clamp-3 max-w-[60ch] text-row text-ink-3">
                {{ report.targetExcerpt }}
              </p>

              <p class="mt-[6px] max-w-[60ch] text-row text-ink-4">
                {{ report.reason }}
              </p>

              <p class="mt-[8px] text-[12.5px] leading-[1.6] text-ink-5">
                <template v-if="report.authorUsername">
                  von
                  <RouterLink
                    :to="{ name: 'member', params: { userId: report.authorId } }"
                    class="underline-offset-[6px] hover:underline"
                  >
                    {{ report.authorUsername }}
                  </RouterLink>
                </template>
                <template v-else>von einem gelöschten Konto</template>
                · gemeldet von {{ report.reporterUsername ?? 'einem gelöschten Konto' }} ·
                {{ formatActivityTime(report.createdAt) }}
              </p>

              <div v-if="report.status === 'open'" class="mt-[10px] flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="isClosing && closingId === report.id"
                  @click="closeReport(report.id, 'resolved')"
                >
                  Erledigt
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="isClosing && closingId === report.id"
                  @click="closeReport(report.id, 'dismissed')"
                >
                  Verwerfen
                </Button>
              </div>
            </li>
          </ul>

          <ListPagination :page="page" :page-count="pageCount" @go="goToPage" />
        </template>
      </div>
    </div>
  </AppLayout>
</template>

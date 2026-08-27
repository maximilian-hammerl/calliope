<script setup lang="ts">
/**
 * The operators' queue. Oldest open report first, because a queue worked newest-first lets its
 * bottom rot and the oldest report is the one somebody has been waiting longest on.
 *
 * Each row stands alone even when several name the same thing: grouping was considered and left
 * out until the queue is long enough for it to earn its cost. Note that one member can now file
 * several reports about one thing — one per category — because a second category is a second
 * claim rather than a correction.
 */
import { computed, ref, watch } from 'vue'
import { getListReportsQueryKey, useListReports, useMoveReport } from '@/api/reports/reports'
import type { ListReports200ResultsItem, ListReportsBody, MoveReportBody } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { formatActivityTime } from '@/lib/format/formatTime'
import { pluralize } from '@/lib/format/formatText'
import { REPORT_CATEGORY_LABELS, REPORT_OUTCOME_LABELS, REPORT_OUTCOMES } from '@/lib/format/report'
import { usePagedList } from '@/composables/usePagedList'
import AppLayout from '@/components/layout/AppLayout.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import CloseReportDialog from '@/components/report/CloseReportDialog.vue'
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
type Outcome = NonNullable<ListReportsBody['closingOutcome']>
type Report = ListReports200ResultsItem

const status = ref<Status>('open')
const category = ref<Category | 'all'>('all')
const outcome = ref<Outcome | 'all'>('all')

// Declared before the query it pages, and reading the total through a getter, because the
// total comes back from that same query — see the composable's own note.
const { page, offset, total, itemsPerPage, goToPage } = usePagedList(
  PAGE_SIZE,
  () => totalResults.value,
)

const body = computed<ListReportsBody>(() => ({
  limit: PAGE_SIZE,
  offset: offset.value,
  status: status.value,
  ...(category.value === 'all' ? {} : { category: category.value }),
  // Only meaningful on the closed queue, and only sent from there: an outcome filter with any
  // other status asks for reports that cannot exist.
  ...(status.value !== 'closed' || outcome.value === 'all'
    ? {}
    : { closingOutcome: outcome.value }),
}))

const { data, isPending } = useListReports(body)

const reports = computed<Report[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)
const totalResults = computed<number>(() =>
  data.value?.status === 200 ? data.value.data.totalResults : 0,
)

// A filter narrows the queue, so whatever page was open is about a different set.
watch([status, category, outcome], () => goToPage(1))

const { mutateAsync: move, isPending: isMoving } = useMoveReport()
const movingId = ref<string | undefined>(undefined)
const error = ref<string | undefined>(undefined)
const closing = ref<Report | undefined>(undefined)

const isBusy = (report: Report) => isMoving.value && movingId.value === report.id

/**
 * Both moves go through here, because they differ only in the body. Every refusal means the report
 * moved under the operator — somebody took it, or closed it — so refetching is at once the fix and
 * the explanation, and the queue is invalidated either way.
 */
async function moveReport(report: Report, to: MoveReportBody): Promise<boolean> {
  error.value = undefined
  movingId.value = report.id

  try {
    await move({ reportId: report.id, data: to })
  } catch {
    error.value = 'Die Meldung hat sich inzwischen geändert. Sie wird neu geladen.'
    return false
  } finally {
    movingId.value = undefined
    await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListReportsQueryKey()) })
  }

  return true
}

async function closeReport(chosen: NonNullable<Report['closingOutcome']>, note: string) {
  const report = closing.value
  if (report === undefined) return

  if (await moveReport(report, { status: 'closed', outcome: chosen, note })) {
    closing.value = undefined
  }
}

const STATUS_LABELS: Record<Status, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  closed: 'Geschlossen',
}

/** What the report is about, in words rather than the enum's. */
const TARGET_LABELS: Record<Report['targetType'], string> = {
  writing_group: 'Gruppe',
  writing_thread: 'Thread',
  writing_post: 'Beitrag',
  story_idea: 'Storyidee',
  chat_group: 'Chat',
  chat_message: 'Nachricht',
  user: 'Mitglied',
}

/**
 * Who is dealing with it and since when, as one line. It names a deleted account rather than
 * falling silent, because the move still happened — and on an in-progress report that is also what
 * says the claim is free for anybody to take over.
 */
function operatorAt(report: Report, at: string): string {
  const who = report.operatorUsername ?? 'ein gelöschtes Konto'
  return `${who}, ${formatActivityTime(at)}`
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <h1 class="text-h1">Moderation</h1>
      <p class="mt-2 max-w-[60ch] text-body text-ink-4">
        Was Mitglieder gemeldet haben, das Älteste zuerst.
      </p>

      <!-- Each names itself: these carry no visible label, and a value like „Offen" says nothing
           about what it selects once the trigger is read on its own. -->
      <div class="mt-6 flex flex-wrap items-center gap-3">
        <Select :model-value="status" @update:model-value="(value) => (status = value as Status)">
          <SelectTrigger aria-label="Status" class="w-[160px] text-[12.5px]">
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
          <SelectTrigger aria-label="Grund" class="w-[220px] text-[12.5px]">
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

        <!-- Only on the closed queue: an outcome is what closing a report produces, so asking
             for one among open reports would always answer with nothing. -->
        <Select
          v-if="status === 'closed'"
          :model-value="outcome"
          @update:model-value="(value) => (outcome = value as Outcome | 'all')"
        >
          <SelectTrigger aria-label="Ergebnis" class="w-[220px] text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Ergebnisse</SelectItem>
            <SelectItem v-for="entry in REPORT_OUTCOMES" :key="entry.value" :value="entry.value">
              {{ entry.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p v-if="error" class="mt-4 text-[12.5px] text-destructive" role="alert">{{ error }}</p>

      <p v-if="isPending" class="mt-6 text-[13.5px] text-ink-5">Einen Moment.</p>

      <p v-else-if="reports.length === 0" class="mt-6 text-body text-ink-4">Nichts zu tun.</p>

      <template v-else>
        <p class="mt-6 text-[12.5px] text-ink-5">
          {{ pluralize(totalResults, 'Meldung', 'Meldungen') }}
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

            <!-- Quoted, in the reading serif behind a rule: it is the writing under review,
                 and an operator must never read it as the reporter's words. -->
            <div class="mt-2 max-w-[60ch] border-l border-line-4 pl-3">
              <p class="line-clamp-3 font-serif text-row text-ink-2">
                {{ report.targetExcerpt }}
              </p>
              <p class="mt-1 text-control text-ink-5">
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
              </p>
            </div>

            <!-- Named where it is said, rather than pooled in a line below both texts. -->
            <p class="mt-2.5 max-w-[60ch] text-row text-ink-4">
              <span class="text-ink-5">
                {{ report.reporterUsername ?? 'Ein gelöschtes Konto' }} meldet:
              </span>
              {{ report.reason }}
            </p>

            <p class="mt-2 text-control text-ink-5">
              {{ formatActivityTime(report.createdAt) }}
            </p>

            <!-- Where it has got to, which is the whole point of recording it: an operator
                 seeing this reporter again reads what was decided last time. -->
            <div
              v-if="report.status !== 'open'"
              class="mt-2.5 max-w-[60ch] border-l border-line-4 pl-3"
            >
              <p class="text-control text-ink-5">
                <template v-if="report.status === 'in_progress' && report.inProgressAt">
                  In Arbeit bei {{ operatorAt(report, report.inProgressAt) }}
                </template>
                <template v-else-if="report.closedAt">
                  Geschlossen als
                  <span class="text-ink-4">
                    {{ report.closingOutcome ? REPORT_OUTCOME_LABELS[report.closingOutcome] : '—' }}
                  </span>
                  von {{ operatorAt(report, report.closedAt) }}
                </template>
              </p>
              <p v-if="report.closingNote" class="mt-1 text-row text-ink-4">
                {{ report.closingNote }}
              </p>
            </div>

            <!-- A closed report offers nothing: it is final, and the row above says what was
                 decided. Taking one somebody else holds is allowed, so a forgotten claim cannot
                 strand it — which is why there is no putting it back. -->
            <div v-if="report.status !== 'closed'" class="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="isBusy(report)"
                @click="moveReport(report, { status: 'in_progress' })"
              >
                {{ report.status === 'open' ? 'Übernehmen' : 'An mich übernehmen' }}
              </Button>

              <Button
                variant="outline"
                size="sm"
                :disabled="isBusy(report)"
                @click="closing = report"
              >
                Schließen
              </Button>
            </div>
          </li>
        </ul>

        <ListPagination v-model:page="page" :total="total" :items-per-page="itemsPerPage" />
      </template>

      <CloseReportDialog
        v-if="closing"
        :open="closing !== undefined"
        :subject="closing.targetExcerpt"
        :is-pending="isMoving"
        @update:open="(value) => !value && (closing = undefined)"
        @close="closeReport"
      />
    </div>
  </AppLayout>
</template>

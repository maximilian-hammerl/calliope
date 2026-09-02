<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { ChevronDown, ChevronRight, Plus, Square, SquareCheck, X } from '@lucide/vue'
import {
  getListStepsQueryKey,
  useCreateStep,
  useDeleteStep,
  useUpdateStep,
} from '@/api/steps/steps'
import type { ListSteps200ResultsItem } from '@/api/models'
import { useGetCurrentUser } from '@/api/auth/auth'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatActivityTime } from '@/lib/format/formatTime'
import { queryClient } from '@/lib/api/queryClient'
import { useSteps } from '@/composables/useSteps'
import PanelCard from '@/components/common/PanelCard.vue'
import { Input } from '@/components/ui/input'

const props = defineProps<{ groupId: string; mayWrite: boolean; mayAdminister: boolean }>()

const LIMIT = TEXT_LIMIT.createStep.text

const { open, completed } = useSteps(() => props.groupId)

const { data: userData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data.id : undefined,
)

function mayDelete(step: ListSteps200ResultsItem): boolean {
  // `mayWrite` first: a member demoted to reader keeps nothing, which is what makes demotion
  // worth anything against an account somebody else is using — see the backend's `mayAct`.
  if (!props.mayWrite) return false
  return props.mayAdminister || (step.createdBy !== null && step.createdBy === currentUserId.value)
}

/** One fact per state, as memberships do: who created it and when, or who completed it and when. */
function metaLine(step: ListSteps200ResultsItem): string {
  if (step.completedAt === null) {
    const by = step.createdByUsername ?? 'Gelöschtes Konto'
    return `angelegt ${formatActivityTime(step.createdAt)} von ${by}`
  }
  const by = step.completedByUsername ?? 'Gelöschtes Konto'
  return `erledigt ${formatActivityTime(step.completedAt)} von ${by}`
}

const failed = ref<boolean>(false)

async function refresh() {
  await queryClient.invalidateQueries({ queryKey: getListStepsQueryKey(props.groupId) })
}

const { mutateAsync: updateStep } = useUpdateStep()

async function setDone(step: ListSteps200ResultsItem, done: boolean) {
  failed.value = false
  try {
    await updateStep({ groupId: props.groupId, stepId: step.id, data: { done } })
  } catch {
    failed.value = true
    return
  }
  await refresh()
}

const { mutateAsync: deleteStep } = useDeleteStep()

async function remove(step: ListSteps200ResultsItem) {
  failed.value = false
  try {
    await deleteStep({ groupId: props.groupId, stepId: step.id })
  } catch {
    failed.value = true
    return
  }
  await refresh()
}

const adding = ref<boolean>(false)
const newText = ref<string>('')
const addRow = useTemplateRef<HTMLDivElement>('addRow')

async function startAdding() {
  adding.value = true
  await nextTick()
  addRow.value?.querySelector('input')?.focus()
}

const { mutateAsync: createStep, isPending: isCreating } = useCreateStep()

async function submit() {
  const text = newText.value.trim()
  if (text.length === 0) {
    return
  }
  failed.value = false
  try {
    await createStep({ groupId: props.groupId, data: { text } })
  } catch {
    failed.value = true
    return
  }
  newText.value = ''
  adding.value = false
  await refresh()
}

const showingCompleted = ref<boolean>(false)
</script>

<template>
  <div>
    <p v-if="failed" class="mb-2 text-[11.5px] leading-[1.5] text-destructive" role="alert">
      Das hat gerade nicht geklappt. Versuche es noch einmal.
    </p>

    <div class="flex flex-col gap-1.5">
      <PanelCard v-for="step in open" :key="step.id">
        <div class="flex items-start gap-2">
          <!-- For a reader the mark is a mark, not a control: plain span, no pointer. -->
          <button
            v-if="mayWrite"
            type="button"
            class="flex flex-1 items-start gap-2 text-left"
            :aria-label="`„${step.text}“ als erledigt abhaken`"
            @click="setDone(step, true)"
          >
            <Square :size="14" :stroke-width="1.5" class="mt-0.5 shrink-0 text-ink-6" />
            <span class="flex-1">
              {{ step.text }}
              <br />
              <span class="text-[11.5px] text-ink-6">
                {{ metaLine(step) }}
              </span>
            </span>
          </button>
          <span v-else class="flex flex-1 items-start gap-2">
            <Square :size="14" :stroke-width="1.5" class="mt-0.5 shrink-0 text-ink-6" />
            <span class="flex-1">
              {{ step.text }}
              <br />
              <span class="text-[11.5px] text-ink-6">
                {{ metaLine(step) }}
              </span>
            </span>
          </span>

          <button
            v-if="mayDelete(step)"
            type="button"
            class="shrink-0 text-ink-6 hover:text-ink-3"
            :aria-label="`„${step.text}“ löschen`"
            @click="remove(step)"
          >
            <X :size="14" :stroke-width="1.5" />
          </button>
        </div>
      </PanelCard>
    </div>

    <div v-if="adding" ref="addRow" class="mt-[9px] flex items-center gap-2">
      <Input
        v-model="newText"
        class="flex-1"
        name="stepText"
        :maxlength="LIMIT.maxLength"
        placeholder="z. B. Kapitel 2 anlegen"
        :aria-label="'Neuer Schritt'"
        @keydown.enter.prevent="submit"
        @keydown.escape="adding = false"
      />
      <button
        type="button"
        class="flex min-h-11 items-center rounded-lg border border-line-5 bg-paper-3 px-2.5 text-[12.5px] font-medium text-oak-deep disabled:opacity-50 md:min-h-0 md:py-[5px]"
        :disabled="isCreating || newText.trim().length === 0"
        @click="submit"
      >
        Anlegen
      </button>
    </div>

    <!-- Rendered disabled for readers rather than hidden, so it is plain the feature exists
         and is not theirs — a deliberate exception to hiding what one cannot do. -->
    <button
      v-else
      type="button"
      class="mt-[9px] flex min-h-11 items-center gap-1 rounded-lg border border-line-5 bg-paper-3 px-2.5 text-[12.5px] font-medium text-oak-deep disabled:opacity-50 md:min-h-0 md:py-[5px]"
      :disabled="!mayWrite"
      :title="mayWrite ? undefined : 'Nur wer schreibt, kann Schritte anlegen'"
      aria-label="Schritt anlegen"
      @click="startAdding"
    >
      <Plus :size="14" :stroke-width="1.5" />
      Schritt
    </button>

    <div v-if="completed.length > 0" class="mt-3">
      <button
        type="button"
        class="flex min-h-11 items-center gap-1 text-[12.5px] text-ink-5 hover:text-ink-2 md:min-h-0"
        @click="showingCompleted = !showingCompleted"
      >
        <component
          :is="showingCompleted ? ChevronDown : ChevronRight"
          :size="14"
          :stroke-width="1.5"
        />
        Erledigt ({{ completed.length }})
      </button>

      <div v-if="showingCompleted" class="mt-1.5 flex flex-col gap-1.5">
        <PanelCard v-for="step in completed" :key="step.id">
          <div class="flex items-start gap-2">
            <button
              v-if="mayWrite"
              type="button"
              class="flex flex-1 items-start gap-2 text-left"
              :aria-label="`„${step.text}“ wieder öffnen`"
              @click="setDone(step, false)"
            >
              <SquareCheck :size="14" :stroke-width="1.5" class="mt-0.5 shrink-0 text-ink-6" />
              <span class="flex-1 text-ink-5">
                {{ step.text }}
                <br />
                <span class="text-[11.5px] text-ink-6">
                  {{ metaLine(step) }}
                </span>
              </span>
            </button>
            <span v-else class="flex flex-1 items-start gap-2">
              <SquareCheck :size="14" :stroke-width="1.5" class="mt-0.5 shrink-0 text-ink-6" />
              <span class="flex-1 text-ink-5">
                {{ step.text }}
                <br />
                <span class="text-[11.5px] text-ink-6">
                  {{ metaLine(step) }}
                </span>
              </span>
            </span>

            <button
              v-if="mayDelete(step)"
              type="button"
              class="shrink-0 text-ink-6 hover:text-ink-3"
              :aria-label="`„${step.text}“ löschen`"
              @click="remove(step)"
            >
              <X :size="14" :stroke-width="1.5" />
            </button>
          </div>
        </PanelCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Closing a report, which needs an outcome and a note and so cannot be a button in the row the way
 * „Erledigt" and „Verwerfen" were. Its own component rather than a verb on `ReportDialog`: that one
 * is a member saying what they saw, this is an operator saying what was decided, and they share
 * neither audience nor fields.
 *
 * The note is what the next operator to meet this reporter reads, so it is required — the same
 * reason a member's own report needs a reason beside its category. It is also the only account
 * there will be: closing is final, so the dialog says so.
 */
import { ref, watch } from 'vue'
import type { MoveReportBody } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { REPORT_OUTCOMES } from '@/lib/format/report'

/** The closing branch of the request body, which is the only one this dialog builds. */
type Closing = Extract<MoveReportBody, { status: 'closed' }>
type Outcome = Closing['outcome']

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  /** What was reported, so the dialog says it back rather than „diese Meldung". */
  subject: string
  isPending: boolean
}>()

// Emits rather than closing the report itself: where the queue goes afterwards — which page it is
// on, what it invalidates — belongs to the caller, the same rule `GroupDialog` follows.
const emit = defineEmits<{ close: [outcome: Outcome, note: string] }>()

const outcome = ref<Outcome | undefined>(undefined)
const note = ref<string>('')
const error = ref<string | undefined>(undefined)

watch(open, () => {
  outcome.value = undefined
  note.value = ''
  error.value = undefined
})

function confirm() {
  error.value = undefined

  if (outcome.value === undefined) {
    error.value = 'Wähle aus, was aus der Meldung geworden ist.'
    return
  }

  if (note.value.trim() === '') {
    error.value = 'Schreib kurz, was du entschieden hast.'
    return
  }

  emit('close', outcome.value, note.value.trim())
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Meldung schließen</DialogTitle>
        <DialogDescription>
          „{{ props.subject }}“ — was du hier einträgst, bleibt für die Moderation lesbar. Eine
          geschlossene Meldung lässt sich nicht wieder öffnen.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <Alert v-if="error" variant="destructive" role="alert">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field>
            <FieldLabel for="closeReportOutcome">Was ist daraus geworden?</FieldLabel>
            <Select v-model="outcome">
              <SelectTrigger id="closeReportOutcome" class="w-full">
                <SelectValue placeholder="Bitte auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="entry in REPORT_OUTCOMES"
                  :key="entry.value"
                  :value="entry.value"
                >
                  {{ entry.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel for="closeReportNote">Was hast du entschieden?</FieldLabel>
            <Textarea
              id="closeReportNote"
              v-model="note"
              name="closeReportNote"
              rows="4"
              :maxlength="TEXT_LIMIT.moveReport.note.maxLength"
            />
            <p class="text-control text-ink-5">
              Nur für die Moderation. Wer gemeldet hat, liest das nicht.
            </p>
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="props.isPending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" :disabled="props.isPending" @click="confirm">
          <Spinner v-if="props.isPending" />
          Schließen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

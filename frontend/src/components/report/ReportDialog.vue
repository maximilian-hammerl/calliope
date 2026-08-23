<script setup lang="ts">
/**
 * One dialog for all seven kinds, because reporting is the same act whatever it names: this is
 * what I saw, and here is why. The kind and the id go to the API; the copy of what was reported
 * is made by the server, so nothing here decides what the operators will read.
 */
import { ref, watch } from 'vue'
import { useCreateReport } from '@/api/reports/reports'
import type { CreateReportBody, CreateReportBodyTargetType } from '@/api/models'
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
import { REPORT_CATEGORIES } from '@/lib/format/report'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  targetType: CreateReportBodyTargetType
  targetId: string
  /** What is being reported, so the dialog can say it back rather than "diesen Inhalt". */
  subject: string
}>()

const { mutateAsync: createReport, isPending } = useCreateReport()
const category = ref<CreateReportBody['category'] | undefined>(undefined)
const reason = ref<string>('')
const error = ref<string | undefined>(undefined)
const sent = ref<boolean>(false)

watch(open, () => {
  category.value = undefined
  reason.value = ''
  error.value = undefined
  sent.value = false
})

async function confirm() {
  error.value = undefined

  if (category.value === undefined) {
    error.value = 'Wähle aus, worum es geht.'
    return
  }

  if (reason.value.trim() === '') {
    error.value = 'Schreib kurz, worum es geht.'
    return
  }

  try {
    await createReport({
      data: {
        targetType: props.targetType,
        targetId: props.targetId,
        category: category.value,
        reason: reason.value.trim(),
      },
    })
  } catch {
    error.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  sent.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>{{ sent ? 'Danke' : `„${props.subject}“ melden` }}</DialogTitle>
        <DialogDescription>
          <template v-if="sent">
            Die Moderation sieht deine Meldung. Was daraus wird, erfährst du nicht — wir sagen
            nichts über das Konto einer anderen Person.
          </template>
          <template v-else>
            Die Moderation liest, was du schreibst, und sieht, was gemeldet wurde.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div v-if="!sent" class="flex flex-col gap-3">
        <Alert v-if="error" variant="destructive" role="alert">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field>
            <FieldLabel for="reportCategory">Worum geht es?</FieldLabel>
            <Select v-model="category">
              <SelectTrigger id="reportCategory" class="w-full">
                <SelectValue placeholder="Bitte auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="entry in REPORT_CATEGORIES"
                  :key="entry.value"
                  :value="entry.value"
                >
                  {{ entry.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel for="reportReason">Was ist passiert?</FieldLabel>
            <Textarea
              id="reportReason"
              v-model="reason"
              name="reportReason"
              rows="4"
              :maxlength="TEXT_LIMIT.createReport.reason.maxLength"
            />
            <p class="text-[12.5px] leading-[1.5] text-ink-5">
              Die gemeldete Person erfährt nicht, wer sie gemeldet hat.
            </p>
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter>
        <template v-if="sent">
          <Button type="button" @click="open = false">Schließen</Button>
        </template>
        <template v-else>
          <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
            Abbrechen
          </Button>
          <Button type="button" :disabled="isPending" @click="confirm">
            <Spinner v-if="isPending" data-icon="inline-start" />
            Melden
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * One dialog for posting and editing — the same shape `GroupDialog` uses, which was two files
 * until the duplication had cost the same field twice. Nothing differs between the flows but
 * the words and the mutation, and every field is the member's own.
 */
import { computed, ref, watch } from 'vue'
import {
  getGetStoryIdeaQueryKey,
  getListStoryIdeasQueryKey,
  useCreateStoryIdea,
  useUpdateStoryIdea,
} from '@/api/story-ideas/story-ideas'
import type { GetStoryIdea200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { fromTags, toTags } from '@/lib/format/storyTags'
import { IDEA_STATUS_LABELS, LANGUAGE_LABELS, PARTY_SIZE_LABELS } from '@/lib/format/storyIdea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ idea?: GetStoryIdea200 }>()
const emit = defineEmits<{ saved: [id: string] }>()

const LIMIT = TEXT_LIMIT.createStoryIdea

const { mutateAsync: create, isPending: isCreating } = useCreateStoryIdea()
const { mutateAsync: update, isPending: isUpdating } = useUpdateStoryIdea()
const isPending = computed<boolean>(() => isCreating.value || isUpdating.value)

const title = ref<string>('')
const subtitle = ref<string>('')
const teaser = ref<string>('')
const synopsis = ref<string>('')
const genres = ref<string>('')
const subgenres = ref<string>('')
const tropes = ref<string>('')
const contentWarnings = ref<string>('')
const tense = ref<string>('')
const perspective = ref<string>('')
const language = ref<GetStoryIdea200['language']>('german')
const lookingFor = ref<string>('')
const partySize = ref<string>('')
const status = ref<GetStoryIdea200['status']>('open')

const titleError = ref<string | undefined>(undefined)
const teaserError = ref<string | undefined>(undefined)
const synopsisError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  titleError.value = undefined
  teaserError.value = undefined
  synopsisError.value = undefined
  formError.value = undefined
  title.value = props.idea?.title ?? ''
  subtitle.value = props.idea?.subtitle ?? ''
  teaser.value = props.idea?.teaser ?? ''
  synopsis.value = props.idea?.synopsis ?? ''
  genres.value = fromTags(props.idea?.genres ?? [])
  subgenres.value = fromTags(props.idea?.subgenres ?? [])
  tropes.value = fromTags(props.idea?.tropes ?? [])
  contentWarnings.value = fromTags(props.idea?.contentWarnings ?? [])
  tense.value = props.idea?.tense ?? ''
  perspective.value = props.idea?.perspective ?? ''
  language.value = props.idea?.language ?? 'german'
  lookingFor.value = props.idea?.lookingFor ?? ''
  partySize.value = props.idea?.partySize ?? ''
  status.value = props.idea?.status ?? 'open'
})

const blank = (value: string) => (value.trim().length === 0 ? null : value.trim())

async function submit() {
  titleError.value = title.value.trim().length === 0 ? 'Gib deiner Idee einen Titel.' : undefined
  teaserError.value =
    teaser.value.trim().length === 0 ? 'Fass deine Idee in ein paar Sätzen zusammen.' : undefined
  synopsisError.value =
    synopsis.value.trim().length === 0 ? 'Erzähl deine Idee ausführlich.' : undefined
  formError.value = undefined

  // Neither text carries a `maxlength`, so the bound is said here rather than by typing that
  // stops dead — and only at the moment it matters.
  if (teaserError.value === undefined && teaser.value.trim().length > LIMIT.teaser.maxLength) {
    teaserError.value = `Die kurze Fassung darf höchstens ${formatCount(LIMIT.teaser.maxLength)} Zeichen lang sein.`
  }
  if (
    synopsisError.value === undefined &&
    synopsis.value.trim().length > LIMIT.synopsis.maxLength
  ) {
    synopsisError.value = `Die ausführliche Fassung darf höchstens ${formatCount(LIMIT.synopsis.maxLength)} Zeichen lang sein.`
  }

  if (
    titleError.value !== undefined ||
    teaserError.value !== undefined ||
    synopsisError.value !== undefined
  ) {
    return
  }

  const values = {
    title: title.value.trim(),
    subtitle: blank(subtitle.value),
    teaser: teaser.value.trim(),
    synopsis: synopsis.value.trim(),
    genres: toTags(genres.value),
    subgenres: toTags(subgenres.value),
    tropes: toTags(tropes.value),
    contentWarnings: toTags(contentWarnings.value),
    tense: blank(tense.value),
    perspective: blank(perspective.value),
    language: language.value,
    lookingFor: blank(lookingFor.value),
    partySize: partySize.value === '' ? null : (partySize.value as GetStoryIdea200['partySize']),
    status: status.value,
  }

  let savedId: string
  try {
    if (props.idea === undefined) {
      const created = await create({ data: values })
      savedId = created.status === 201 ? created.data.id : ''
    } else {
      await update({ ideaId: props.idea.id, data: values })
      savedId = props.idea.id
    }
  } catch {
    formError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    return
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListStoryIdeasQueryKey()) }),
    ...(props.idea === undefined
      ? []
      : [queryClient.invalidateQueries({ queryKey: getGetStoryIdeaQueryKey(props.idea.id) })]),
  ])

  open.value = false
  emit('saved', savedId)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-wide">
      <DialogHeader>
        <DialogTitle>{{
          props.idea ? 'Storyidee bearbeiten' : 'Storyidee vorstellen'
        }}</DialogTitle>
        <DialogDescription>
          Eine Idee, die Mitschreibende sucht. Nötig sind der Titel und beide Fassungen der Idee —
          die kurze steht auf der Übersicht, die ausführliche auf der Seite dazu.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field :data-invalid="titleError !== undefined ? true : undefined">
            <FieldLabel for="idea-title">Titel</FieldLabel>
            <Input
              id="idea-title"
              v-model="title"
              name="title"
              :maxlength="LIMIT.title.maxLength"
              placeholder="z. B. Briefe aus dem Leuchtturm"
              required
              :aria-invalid="titleError !== undefined ? true : undefined"
            />
            <FieldError :errors="[titleError]" />
          </Field>

          <Field>
            <FieldLabel optional for="idea-subtitle">Untertitel</FieldLabel>
            <Input
              id="idea-subtitle"
              v-model="subtitle"
              name="subtitle"
              :maxlength="LIMIT.subtitle.maxLength"
              placeholder="z. B. Zwei Wächter, eine See, die es nicht mehr gibt"
            />
          </Field>

          <!-- Both required, and the short one first: it is what a board shows, and it reads
               as the opening of the long one rather than a summary of it. -->
          <Field :data-invalid="teaserError !== undefined ? true : undefined">
            <FieldLabel for="idea-teaser">Die Idee, kurz</FieldLabel>
            <Textarea
              id="idea-teaser"
              v-model="teaser"
              name="teaser"
              rows="3"
              placeholder="Ein paar Sätze, die für sich stehen — das sieht man auf der Übersicht."
              required
              :aria-invalid="teaserError !== undefined ? true : undefined"
            />
            <FieldError :errors="[teaserError]" />
          </Field>

          <Field :data-invalid="synopsisError !== undefined ? true : undefined">
            <FieldLabel for="idea-synopsis">Die Idee, ausführlich</FieldLabel>
            <Textarea
              id="idea-synopsis"
              v-model="synopsis"
              name="synopsis"
              rows="8"
              placeholder="Worum geht es, und wie soll gemeinsam daran geschrieben werden?"
              required
              :aria-invalid="synopsisError !== undefined ? true : undefined"
            />
            <FieldError :errors="[synopsisError]" />
          </Field>

          <Field>
            <FieldLabel optional for="idea-looking-for">Wen oder was suchst du?</FieldLabel>
            <Input
              id="idea-looking-for"
              v-model="lookingFor"
              name="lookingFor"
              :maxlength="LIMIT.lookingFor.maxLength"
              placeholder="z. B. Eine Person, die den zweiten Wächter schreibt"
            />
          </Field>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel optional for="idea-party-size">Konstellation</FieldLabel>
              <select
                id="idea-party-size"
                v-model="partySize"
                class="h-11 rounded-lg border border-input bg-transparent px-3 text-[13px] md:h-9"
              >
                <option value="">Keine Angabe</option>
                <option v-for="(label, value) in PARTY_SIZE_LABELS" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </Field>

            <Field>
              <FieldLabel for="idea-language">Sprache</FieldLabel>
              <select
                id="idea-language"
                v-model="language"
                class="h-11 rounded-lg border border-input bg-transparent px-3 text-[13px] md:h-9"
              >
                <option v-for="(label, value) in LANGUAGE_LABELS" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </Field>
          </div>

          <Field v-if="props.idea !== undefined">
            <FieldLabel for="idea-status">Status</FieldLabel>
            <select
              id="idea-status"
              v-model="status"
              class="h-11 rounded-lg border border-input bg-transparent px-3 text-[13px] md:h-9"
            >
              <option v-for="(label, value) in IDEA_STATUS_LABELS" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </Field>

          <!-- Paired from `sm` up: a comma list is short, and two rows of two keep the
               dialog inside the viewport instead of scrolling it. -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel optional for="idea-genres">Genres</FieldLabel>
              <Input
                id="idea-genres"
                v-model="genres"
                name="genres"
                placeholder="z. B. Fantasy, Mystery"
              />
              <FieldDescription>Mehrere durch Kommas trennen.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel optional for="idea-subgenres">Subgenres</FieldLabel>
              <Input
                id="idea-subgenres"
                v-model="subgenres"
                name="subgenres"
                placeholder="z. B. Cyberpunk, Dark Romance"
              />
            </Field>

            <Field>
              <FieldLabel optional for="idea-tropes">Tropes</FieldLabel>
              <Input
                id="idea-tropes"
                v-model="tropes"
                name="tropes"
                placeholder="z. B. Epistolary, Slow Burn"
              />
            </Field>

            <Field>
              <FieldLabel optional for="idea-content-warnings">Inhaltswarnungen</FieldLabel>
              <Input
                id="idea-content-warnings"
                v-model="contentWarnings"
                name="contentWarnings"
                placeholder="z. B. Verlust"
              />
            </Field>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel optional for="idea-tense">Zeitform</FieldLabel>
              <Input
                id="idea-tense"
                v-model="tense"
                name="tense"
                :maxlength="LIMIT.tense.maxLength"
                placeholder="z. B. Vergangenheit"
              />
            </Field>
            <Field>
              <FieldLabel optional for="idea-perspective">Perspektive</FieldLabel>
              <Input
                id="idea-perspective"
                v-model="perspective"
                name="perspective"
                :maxlength="LIMIT.perspective.maxLength"
                placeholder="z. B. Erste Person"
              />
            </Field>
          </div>
        </FieldGroup>

        <Button type="submit" :disabled="isPending">
          <Spinner v-if="isPending" data-icon="inline-start" />
          {{ props.idea ? 'Änderungen speichern' : 'Idee vorstellen' }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

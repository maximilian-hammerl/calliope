<script setup lang="ts">
/**
 * One dialog for posting and editing: unlike a group's two dialogs, nothing differs between
 * the flows but the words and the mutation, and every field is the member's own.
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
const ideaText = ref<string>('')
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
const ideaError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  titleError.value = undefined
  ideaError.value = undefined
  formError.value = undefined
  title.value = props.idea?.title ?? ''
  subtitle.value = props.idea?.subtitle ?? ''
  ideaText.value = props.idea?.idea ?? ''
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
  ideaError.value = ideaText.value.trim().length === 0 ? 'Beschreib deine Idee.' : undefined
  formError.value = undefined

  if (titleError.value !== undefined || ideaError.value !== undefined) {
    return
  }

  const values = {
    title: title.value.trim(),
    subtitle: blank(subtitle.value),
    idea: ideaText.value.trim(),
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
          Eine Idee, die Mitschreibende sucht. Nur Titel und die Idee selbst sind nötig.
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
              class="h-11 md:h-9"
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
              class="h-11 md:h-9"
              name="subtitle"
              :maxlength="LIMIT.subtitle.maxLength"
              placeholder="z. B. Zwei Wächter, eine See, die es nicht mehr gibt"
            />
          </Field>

          <Field :data-invalid="ideaError !== undefined ? true : undefined">
            <FieldLabel for="idea-text">Die Idee</FieldLabel>
            <Textarea
              id="idea-text"
              v-model="ideaText"
              name="idea"
              rows="4"
              placeholder="Worum geht es, und wie soll gemeinsam daran geschrieben werden?"
              required
              :aria-invalid="ideaError !== undefined ? true : undefined"
            />
            <FieldError :errors="[ideaError]" />
          </Field>

          <Field>
            <FieldLabel optional for="idea-looking-for">Wen oder was suchst du?</FieldLabel>
            <Input
              id="idea-looking-for"
              v-model="lookingFor"
              class="h-11 md:h-9"
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
                class="h-11 rounded-md border border-input bg-transparent px-3 text-[13px] md:h-9"
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
                class="h-11 rounded-md border border-input bg-transparent px-3 text-[13px] md:h-9"
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
              class="h-11 rounded-md border border-input bg-transparent px-3 text-[13px] md:h-9"
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
                class="h-11 md:h-9"
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
                class="h-11 md:h-9"
                name="subgenres"
                placeholder="z. B. Cyberpunk, Dark Romance"
              />
            </Field>

            <Field>
              <FieldLabel optional for="idea-tropes">Tropes</FieldLabel>
              <Input
                id="idea-tropes"
                v-model="tropes"
                class="h-11 md:h-9"
                name="tropes"
                placeholder="z. B. Epistolary, Slow Burn"
              />
            </Field>

            <Field>
              <FieldLabel optional for="idea-content-warnings">Inhaltswarnungen</FieldLabel>
              <Input
                id="idea-content-warnings"
                v-model="contentWarnings"
                class="h-11 md:h-9"
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
                class="h-11 md:h-9"
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
                class="h-11 md:h-9"
                name="perspective"
                :maxlength="LIMIT.perspective.maxLength"
                placeholder="z. B. Erste Person"
              />
            </Field>
          </div>
        </FieldGroup>

        <Button type="submit" class="h-11 md:h-9" :disabled="isPending">
          <Spinner v-if="isPending" data-icon="inline-start" />
          {{ props.idea ? 'Änderungen speichern' : 'Idee vorstellen' }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

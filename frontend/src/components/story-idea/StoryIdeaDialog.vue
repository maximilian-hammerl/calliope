<script setup lang="ts">
/**
 * One dialog for posting and editing — the same shape `GroupDialog` uses, which was two files
 * until the duplication had cost the same field twice. Nothing differs between the flows but
 * the words and the mutation, and every field is the member's own.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import {
  getGetStoryIdeaQueryKey,
  getListStoryIdeasQueryKey,
  useCreateStoryIdea,
  useUpdateStoryIdea,
} from '@/api/story-ideas/story-ideas'
import type { GetStoryIdea200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/format/formatNumber'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, parsed, proseSchema, titleSchema } from '@/lib/validation/fieldSchemas'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { IDEA_STATUS_LABELS, LANGUAGE_LABELS, PARTY_SIZE_LABELS } from '@/lib/format/storyIdea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import StoryVocabularyFields from '@/components/story/StoryVocabularyFields.vue'
import type { StoryVocabulary } from '@/components/story/StoryVocabularyFields.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ idea?: GetStoryIdea200 }>()
/** Only on posting, as `ThreadDialog` does: an edit leaves the reader where they were. */
const emit = defineEmits<{ created: [id: string] }>()

const LIMIT = TEXT_LIMIT.createStoryIdea

const TITLE = titleSchema(LIMIT.title, 'Gib deiner Idee einen Titel.')
const TEASER = proseSchema(
  LIMIT.teaser,
  `Die kurze Fassung darf höchstens ${formatCount(LIMIT.teaser.maxLength)} Zeichen lang sein.`,
  'Fass deine Idee in ein paar Sätzen zusammen.',
)
const SYNOPSIS = proseSchema(
  LIMIT.synopsis,
  `Die ausführliche Fassung darf höchstens ${formatCount(LIMIT.synopsis.maxLength)} Zeichen lang sein.`,
  'Erzähl deine Idee ausführlich.',
)

const { mutateAsync: create, isPending: isCreating } = useCreateStoryIdea()
const { mutateAsync: update, isPending: isUpdating } = useUpdateStoryIdea()
const isPending = computed<boolean>(() => isCreating.value || isUpdating.value)

// The three selects stay outside the form: they carry no validation and their own type, which a
// form field of strings would have to cast back.
const language = ref<GetStoryIdea200['language']>('german')
const partySize = ref<string>('')
const status = ref<GetStoryIdea200['status']>('open')

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const blank = (value: string) => (value.trim().length === 0 ? null : value.trim())

const emptyVocabulary = (): StoryVocabulary => ({
  genres: [],
  subgenres: [],
  tropes: [],
  contentWarnings: [],
  storyThemes: '',
  storySettings: '',
  tense: '',
  perspective: '',
})

const vocabulary = ref<StoryVocabulary>(emptyVocabulary())

const form = useForm({
  defaultValues: {
    title: '',
    subtitle: '',
    teaser: '',
    synopsis: '',
    lookingFor: '',
  },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    const values = {
      title: parsed(TITLE, value.title),
      subtitle: blank(value.subtitle),
      teaser: parsed(TEASER, value.teaser),
      synopsis: parsed(SYNOPSIS, value.synopsis),
      genres: vocabulary.value.genres,
      subgenres: vocabulary.value.subgenres,
      tropes: vocabulary.value.tropes,
      contentWarnings: vocabulary.value.contentWarnings,
      storyThemes: blank(vocabulary.value.storyThemes),
      storySettings: blank(vocabulary.value.storySettings),
      tense: vocabulary.value.tense === '' ? null : vocabulary.value.tense,
      perspective: vocabulary.value.perspective === '' ? null : vocabulary.value.perspective,
      language: language.value,
      lookingFor: blank(value.lookingFor),
      partySize: partySize.value === '' ? null : (partySize.value as GetStoryIdea200['partySize']),
      status: status.value,
    }

    let createdId: string | undefined
    try {
      if (props.idea === undefined) {
        const created = await create({ data: values })
        // 201 is the only documented success and `apiFetch` throws on the rest, so this narrows
        // rather than handles: no id, no event — the idea is posted either way.
        createdId = created.status === 201 ? created.data.id : undefined
      } else {
        await update({ ideaId: props.idea.id, data: values })
      }
    } catch (error) {
      formError.value = failureMessage(error)
      return
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListStoryIdeasQueryKey()) }),
      ...(props.idea === undefined
        ? []
        : [queryClient.invalidateQueries({ queryKey: getGetStoryIdeaQueryKey(props.idea.id) })]),
    ])

    open.value = false
    if (createdId !== undefined) {
      emit('created', createdId)
    }
  },
})

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  formError.value = undefined
  form.reset({
    title: props.idea?.title ?? '',
    subtitle: props.idea?.subtitle ?? '',
    teaser: props.idea?.teaser ?? '',
    synopsis: props.idea?.synopsis ?? '',
    lookingFor: props.idea?.lookingFor ?? '',
  })
  vocabulary.value = props.idea
    ? {
        genres: [...props.idea.genres],
        subgenres: [...props.idea.subgenres],
        tropes: [...props.idea.tropes],
        contentWarnings: [...props.idea.contentWarnings],
        storyThemes: props.idea.storyThemes ?? '',
        storySettings: props.idea.storySettings ?? '',
        tense: props.idea.tense ?? '',
        perspective: props.idea.perspective ?? '',
      }
    : emptyVocabulary()
  language.value = props.idea?.language ?? 'german'
  partySize.value = props.idea?.partySize ?? ''
  status.value = props.idea?.status ?? 'open'
})
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

      <form
        ref="formElement"
        class="flex flex-col gap-4"
        novalidate
        @submit.prevent="form.handleSubmit()"
      >
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <form.Field name="title" :validators="{ onSubmit: TITLE }">
            <template v-slot="{ field }">
              <FormTextField
                id="idea-title"
                :field="field"
                label="Titel"
                :maxlength="LIMIT.title.maxLength"
                placeholder="z. B. Briefe aus dem Leuchtturm"
                required
              />
            </template>
          </form.Field>

          <form.Field name="subtitle">
            <template v-slot="{ field }">
              <FormTextField
                id="idea-subtitle"
                :field="field"
                label="Untertitel"
                optional
                :maxlength="LIMIT.subtitle.maxLength"
                placeholder="z. B. Zwei Wächter, eine See, die es nicht mehr gibt"
              />
            </template>
          </form.Field>

          <!-- Both required, and the short one first: it is what a board shows, and it reads
               as the opening of the long one rather than a summary of it. -->
          <form.Field name="teaser" :validators="{ onSubmit: TEASER }">
            <template v-slot="{ field }">
              <FormTextField
                id="idea-teaser"
                :field="field"
                label="Die Idee, kurz"
                multiline
                rows="3"
                placeholder="Ein paar Sätze, die für sich stehen — das sieht man auf der Übersicht."
                required
              />
            </template>
          </form.Field>

          <form.Field name="synopsis" :validators="{ onSubmit: SYNOPSIS }">
            <template v-slot="{ field }">
              <FormTextField
                id="idea-synopsis"
                :field="field"
                label="Die Idee, ausführlich"
                multiline
                rows="8"
                placeholder="Worum geht es, und wie soll gemeinsam daran geschrieben werden?"
                required
              />
            </template>
          </form.Field>

          <form.Field name="lookingFor">
            <template v-slot="{ field }">
              <FormTextField
                id="idea-looking-for"
                :field="field"
                label="Wen oder was suchst du?"
                optional
                :maxlength="LIMIT.lookingFor.maxLength"
                placeholder="z. B. Eine Person, die den zweiten Wächter schreibt"
              />
            </template>
          </form.Field>

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

          <StoryVocabularyFields v-model="vocabulary" id-prefix="idea" />
        </FieldGroup>

        <Button type="submit" :disabled="isPending">
          <Spinner v-if="isPending" />
          {{ props.idea ? 'Änderungen speichern' : 'Idee vorstellen' }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

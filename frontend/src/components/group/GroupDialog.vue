<script setup lang="ts">
/**
 * One dialog for founding and for editing, the same shape the story-idea dialog uses. The two
 * it replaced shared about three hundred and fifty lines and differed in six small ways — the
 * mutation, the words, where the initial values come from, and what happens afterwards — which
 * is how `language` and the optional markers each had to be added twice.
 *
 * `group` present means editing that group. Otherwise it founds one, from `initial` when a
 * story idea supplied the values. The two props are alternatives; `group` wins if both arrive.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getGetGroupQueryKey,
  getListGroupsQueryKey,
  useCreateGroup,
  useUpdateGroup,
} from '@/api/groups/groups'
import type { GetGroup200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import StoryMetadataFields from '@/components/group/StoryMetadataFields.vue'
import type {
  ContentWarning,
  Genre,
  Perspective,
  Subgenre,
  Tense,
  Trope,
} from '@/lib/story/storyVocabulary'
import type { StoryMetadata } from '@/components/group/StoryMetadataFields.vue'
import { formatCount } from '@/lib/format/formatNumber'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, parsed, proseSchema, titleSchema } from '@/lib/validation/fieldSchemas'
import { listOnlyFilter } from '@/lib/api/queryKeys'
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
import FormTextField from '@/components/common/FormTextField.vue'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

/** What a story idea hands over when a group is founded from it. */
export type GroupInitialValues = {
  title: string
  subtitle: string | null
  synopsis: string
  genres: Genre[]
  subgenres: Subgenre[]
  tropes: Trope[]
  contentWarnings: ContentWarning[]
  storyThemes: string | null
  storySettings: string | null
  tense: Tense | null
  perspective: Perspective | null
  language: 'german' | 'english'
}

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ group?: GetGroup200; initial?: GroupInitialValues }>()

/**
 * The id of the group that was founded. Emitted rather than navigated to: where to go afterwards
 * is the caller's business — the groups list opens the new group, the group's own page stays.
 *
 * Only on founding, as `ThreadDialog` does. An edit has nothing to go to, and an event named for
 * saving would invite a caller to navigate after one.
 */
const emit = defineEmits<{ created: [groupId: string] }>()

const queryClient = useQueryClient()

const editing = computed<boolean>(() => props.group !== undefined)

const visibility = ref<'private' | 'public'>('private')

const emptyMetadata = (): StoryMetadata => ({
  storyStatus: 'planning',
  genres: [],
  subgenres: [],
  tropes: [],
  contentWarnings: [],
  storyThemes: '',
  storySettings: '',
  tense: '',
  perspective: '',
  language: 'german',
})

const metadata = ref<StoryMetadata>(emptyMetadata())

/** The form holds chosen values; the API takes the same values, and null for "not said". */
function metadataForApi() {
  return {
    storyStatus: metadata.value.storyStatus,
    genres: metadata.value.genres,
    subgenres: metadata.value.subgenres,
    tropes: metadata.value.tropes,
    contentWarnings: metadata.value.contentWarnings,
    storyThemes: blank(metadata.value.storyThemes),
    storySettings: blank(metadata.value.storySettings),
    tense: metadata.value.tense === '' ? null : metadata.value.tense,
    perspective: metadata.value.perspective === '' ? null : metadata.value.perspective,
    language: metadata.value.language,
  }
}

// The two operations carry the same bounds, and a form cannot enforce two sets at once.
/** An emptied optional field means null, not an empty string, to the API. */
const blank = (value: string) => (value.trim().length === 0 ? null : value.trim())

const LIMIT = TEXT_LIMIT.createGroup

const TITLE = titleSchema(LIMIT.title, 'Gib deiner Gruppe einen Titel.')
const SYNOPSIS = proseSchema(
  LIMIT.synopsis,
  `Die Beschreibung darf höchstens ${formatCount(LIMIT.synopsis.maxLength)} Zeichen lang sein.`,
)

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const { mutateAsync: createGroup, isPending: isCreating } = useCreateGroup()
const { mutateAsync: updateGroup, isPending: isUpdating } = useUpdateGroup()
const isPending = computed<boolean>(() => isCreating.value || isUpdating.value)

const form = useForm({
  defaultValues: { title: '', subtitle: '', synopsis: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    const values = {
      title: parsed(TITLE, value.title),
      subtitle: blank(value.subtitle),
      synopsis: parsed(SYNOPSIS, value.synopsis),
      visibility: visibility.value,
      ...metadataForApi(),
    }

    let createdId: string | undefined
    try {
      if (props.group !== undefined) {
        await updateGroup({ groupId: props.group.id, data: values })
      } else {
        const created = await createGroup({ data: values })
        // 201 is the only documented success and `apiFetch` throws on the rest, so this narrows
        // rather than handles: no id, no event — the group is founded either way.
        createdId = created.status === 201 ? created.data.id : undefined
      }
    } catch (error) {
      formError.value = failureMessage(
        error,
        editing.value
          ? 'Die Änderungen konnten nicht gespeichert werden. Versuche es noch einmal.'
          : 'Die Gruppe konnte nicht gegründet werden. Versuche es noch einmal.',
      )
      return
    }

    // The list shows the title and the privacy badge, so it goes stale with either operation.
    await Promise.all([
      queryClient.invalidateQueries(listOnlyFilter(getListGroupsQueryKey())),
      ...(props.group === undefined
        ? []
        : [queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(props.group.id) })]),
    ])

    open.value = false
    if (createdId !== undefined) {
      emit('created', createdId)
    }
  },
})

/**
 * Filled on opening rather than at setup, so a second visit shows what the group says now
 * instead of what it said when the page was first rendered.
 */
watch(open, (isOpen) => {
  formError.value = undefined

  if (!isOpen) {
    return
  }

  const source = props.group ?? props.initial
  if (source === undefined) {
    form.reset()
    visibility.value = 'private'
    metadata.value = emptyMetadata()
    return
  }

  form.reset({
    title: source.title,
    subtitle: source.subtitle ?? '',
    synopsis: source.synopsis,
  })
  // An idea has no visibility or status of its own: founding from one starts where a new group
  // starts, and the author decides both before confirming.
  visibility.value = props.group?.visibility ?? 'private'
  metadata.value = {
    storyStatus: props.group?.storyStatus ?? 'planning',
    genres: [...source.genres],
    subgenres: [...source.subgenres],
    tropes: [...source.tropes],
    contentWarnings: [...source.contentWarnings],
    storyThemes: source.storyThemes ?? '',
    storySettings: source.storySettings ?? '',
    tense: source.tense ?? '',
    perspective: source.perspective ?? '',
    language: source.language,
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-wide">
      <DialogHeader>
        <!-- Founding a group is a social act, so the verb is not "erstellen". -->
        <DialogTitle>{{ editing ? 'Gruppe bearbeiten' : 'Gruppe gründen' }}</DialogTitle>
        <DialogDescription>
          Nur der Titel ist nötig.
          {{
            editing
              ? 'Titel, Beschreibung und Sichtbarkeit gelten für alle Mitglieder.'
              : 'Eine private Gruppe sehen nur ihre Mitglieder.'
          }}
        </DialogDescription>
      </DialogHeader>

      <form
        ref="formElement"
        class="flex flex-col gap-5"
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
                id="group-title"
                :field="field"
                label="Titel"
                :maxlength="LIMIT.title.maxLength"
                placeholder="z. B. Der Erinnerungsmarkt"
                required
              />
            </template>
          </form.Field>

          <form.Field name="subtitle">
            <template v-slot="{ field }">
              <FormTextField
                id="group-subtitle"
                :field="field"
                label="Untertitel"
                optional
                :maxlength="LIMIT.subtitle.maxLength"
                placeholder="z. B. Was du vergisst, gehört jemand anderem"
              />
            </template>
          </form.Field>

          <form.Field name="synopsis" :validators="{ onSubmit: SYNOPSIS }">
            <template v-slot="{ field }">
              <FormTextField
                id="group-synopsis"
                :field="field"
                label="Worum geht es?"
                optional
                multiline
                rows="3"
                placeholder="z. B. Ein Markt, der nur nach Einbruch der Dunkelheit öffnet."
              />
            </template>
          </form.Field>

          <Field>
            <FieldLabel for="group-visibility">Sichtbarkeit</FieldLabel>
            <select
              id="group-visibility"
              v-model="visibility"
              name="visibility"
              class="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm md:h-9"
            >
              <option value="private">Privat — nur Mitglieder sehen die Gruppe</option>
              <option value="public">Öffentlich — alle können mitlesen</option>
            </select>
          </Field>

          <StoryMetadataFields v-model="metadata" />
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isPending">
            <Spinner v-if="isPending" />
            {{ editing ? 'Änderungen speichern' : 'Gruppe gründen' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

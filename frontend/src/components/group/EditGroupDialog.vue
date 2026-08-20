<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getGetGroupQueryKey, getListGroupsQueryKey, useUpdateGroup } from '@/api/groups/groups'
import type { GetGroup200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import StoryMetadataFields, { type StoryMetadata } from '@/components/group/StoryMetadataFields.vue'
import { fromTags, toTags } from '@/lib/format/storyTags'
import { formatCount } from '@/lib/format/formatNumber'
import { listKeyPrefix } from '@/lib/api/queryKeys'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{ group: GetGroup200 }>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()

const title = ref<string>('')
const subtitle = ref<string>('')
const description = ref<string>('')
const visibility = ref<'private' | 'public'>('private')

const emptyMetadata = (): StoryMetadata => ({
  storyStatus: 'planning',
  genres: '',
  subgenres: '',
  tropes: '',
  contentWarnings: '',
  tense: '',
  perspective: '',
})

const metadata = ref<StoryMetadata>(emptyMetadata())

/** The form holds comma-separated text; the API takes arrays and nulls. */
function metadataForApi() {
  const blank = (value: string) => (value.trim().length === 0 ? null : value.trim())
  return {
    subtitle: blank(subtitle.value),
    storyStatus: metadata.value.storyStatus,
    genres: toTags(metadata.value.genres),
    subgenres: toTags(metadata.value.subgenres),
    tropes: toTags(metadata.value.tropes),
    contentWarnings: toTags(metadata.value.contentWarnings),
    tense: blank(metadata.value.tense),
    perspective: blank(metadata.value.perspective),
  }
}

const LIMIT = TEXT_LIMIT.updateGroup

const titleError = ref<string | undefined>(undefined)
const descriptionError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

const { mutateAsync: updateGroup, isPending } = useUpdateGroup()

// Filled on opening rather than at setup, so a second visit shows what the group says now
// instead of what it said when the page was first rendered.
watch(open, (isOpen) => {
  titleError.value = undefined
  descriptionError.value = undefined
  formError.value = undefined

  if (!isOpen) {
    return
  }
  title.value = props.group.title
  description.value = props.group.blurb
  visibility.value = props.group.visibility
  subtitle.value = props.group.subtitle ?? ''
  metadata.value = {
    storyStatus: props.group.storyStatus,
    genres: fromTags(props.group.genres),
    subgenres: fromTags(props.group.subgenres),
    tropes: fromTags(props.group.tropes),
    contentWarnings: fromTags(props.group.contentWarnings),
    tense: props.group.tense ?? '',
    perspective: props.group.perspective ?? '',
  }
})

async function submit() {
  titleError.value = undefined
  descriptionError.value = undefined
  formError.value = undefined

  if (title.value.trim().length === 0) {
    titleError.value = 'Gib deiner Gruppe einen Titel.'
    return
  }

  if (description.value.trim().length > LIMIT.blurb.maxLength) {
    descriptionError.value = `Die Beschreibung darf höchstens ${formatCount(LIMIT.blurb.maxLength)} Zeichen lang sein.`
    return
  }

  try {
    await updateGroup({
      groupId: props.group.id,
      data: {
        title: title.value.trim(),
        blurb: description.value.trim(),
        ...metadataForApi(),
        visibility: visibility.value,
      },
    })
  } catch {
    formError.value = 'Die Änderungen konnten nicht gespeichert werden. Versuche es noch einmal.'
    return
  }

  // The group list shows the title and the privacy badge, so it goes stale with this too.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(props.group.id) }),
    queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListGroupsQueryKey()) }),
  ])
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Gruppe bearbeiten</DialogTitle>
        <DialogDescription>
          Titel, Beschreibung und Sichtbarkeit gelten für alle Mitglieder.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field :data-invalid="titleError !== undefined ? true : undefined">
            <FieldLabel for="edit-group-title">Titel</FieldLabel>
            <Input
              id="edit-group-title"
              v-model="title"
              class="h-11 md:h-9"
              name="title"
              :maxlength="LIMIT.title.maxLength"
              placeholder="z. B. Der Erinnerungsmarkt"
              required
              :aria-invalid="titleError !== undefined ? true : undefined"
            />
            <FieldError :errors="[titleError]" />
          </Field>

          <Field>
            <FieldLabel for="edit-group-subtitle">Untertitel</FieldLabel>
            <Input
              id="edit-group-subtitle"
              v-model="subtitle"
              class="h-11 md:h-9"
              name="subtitle"
              :maxlength="LIMIT.subtitle.maxLength"
              placeholder="z. B. Was du vergisst, gehört jemand anderem"
            />
          </Field>

          <Field :data-invalid="descriptionError !== undefined ? true : undefined">
            <FieldLabel for="edit-group-description">Worum geht es?</FieldLabel>
            <Textarea
              id="edit-group-description"
              v-model="description"
              name="description"
              rows="3"
              placeholder="z. B. Ein Markt, der nur nach Einbruch der Dunkelheit öffnet."
              :aria-invalid="descriptionError !== undefined ? true : undefined"
            />
            <FieldError :errors="[descriptionError]" />
          </Field>

          <Field>
            <FieldLabel for="edit-group-visibility">Sichtbarkeit</FieldLabel>
            <select
              id="edit-group-visibility"
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
            <Spinner v-if="isPending" data-icon="inline-start" />
            Änderungen speichern
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

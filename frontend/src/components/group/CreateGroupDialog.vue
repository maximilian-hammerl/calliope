<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { getListGroupsQueryKey, useCreateGroup } from '@/api/groups/groups'
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

const open = defineModel<boolean>('open', { required: true })

/** Founding a group from a story idea: the fields arrive filled and stay editable. */
export type GroupPrefill = {
  title: string
  subtitle: string | null
  blurb: string
  genres: string[]
  subgenres: string[]
  tropes: string[]
  contentWarnings: string[]
  tense: string | null
  perspective: string | null
  language: 'german' | 'english'
}

const props = defineProps<{ prefill?: GroupPrefill }>()

const router = useRouter()
const queryClient = useQueryClient()

const title = ref<string>('')
const subtitle = ref<string>('')
const description = ref<string>('')
const visibility = ref<'private' | 'public'>('private')

// Taken from the design system's own dialog rather than invented, so they already match what
// the column will hold once perspective is stored.
const emptyMetadata = (): StoryMetadata => ({
  storyStatus: 'planning',
  genres: '',
  subgenres: '',
  tropes: '',
  contentWarnings: '',
  tense: '',
  perspective: '',
  language: 'german',
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
    language: metadata.value.language,
  }
}

const LIMIT = TEXT_LIMIT.createGroup

const titleError = ref<string | undefined>(undefined)
const descriptionError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

const { mutateAsync: createGroup, isPending } = useCreateGroup()

watch(open, (isOpen) => {
  if (isOpen) {
    // Opening from a story idea: the copy the columns were kept in step for.
    if (props.prefill !== undefined) {
      title.value = props.prefill.title
      subtitle.value = props.prefill.subtitle ?? ''
      description.value = props.prefill.blurb
      metadata.value = {
        storyStatus: 'planning',
        genres: fromTags(props.prefill.genres),
        subgenres: fromTags(props.prefill.subgenres),
        tropes: fromTags(props.prefill.tropes),
        contentWarnings: fromTags(props.prefill.contentWarnings),
        tense: props.prefill.tense ?? '',
        perspective: props.prefill.perspective ?? '',
        language: props.prefill.language,
      }
    }
    return
  }
  title.value = ''
  subtitle.value = ''
  description.value = ''
  visibility.value = 'private'
  metadata.value = emptyMetadata()
  titleError.value = undefined
  descriptionError.value = undefined
  formError.value = undefined
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

  let created
  try {
    created = await createGroup({
      data: {
        title: title.value.trim(),
        blurb: description.value.trim(),
        visibility: visibility.value,
        ...metadataForApi(),
      },
    })
  } catch {
    formError.value = 'Die Gruppe konnte nicht gegründet werden. Versuche es noch einmal.'
    return
  }

  await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListGroupsQueryKey()) })
  open.value = false

  if (created.status === 201) {
    await router.push({ name: 'group', params: { groupId: created.data.id } })
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[440px]">
      <DialogHeader>
        <!-- Founding a group is a social act, so the verb is not "erstellen". -->
        <DialogTitle>Gruppe gründen</DialogTitle>
        <DialogDescription> Eine private Gruppe sehen nur ihre Mitglieder. </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field :data-invalid="titleError !== undefined ? true : undefined">
            <FieldLabel for="group-title">Titel</FieldLabel>
            <Input
              id="group-title"
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
            <FieldLabel for="group-subtitle">Untertitel</FieldLabel>
            <Input
              id="group-subtitle"
              v-model="subtitle"
              class="h-11 md:h-9"
              name="subtitle"
              :maxlength="LIMIT.subtitle.maxLength"
              placeholder="z. B. Was du vergisst, gehört jemand anderem"
            />
          </Field>

          <Field :data-invalid="descriptionError !== undefined ? true : undefined">
            <FieldLabel for="group-description">Worum geht es?</FieldLabel>
            <Textarea
              id="group-description"
              v-model="description"
              name="description"
              rows="3"
              placeholder="z. B. Ein Markt, der nur nach Einbruch der Dunkelheit öffnet."
              :aria-invalid="descriptionError !== undefined ? true : undefined"
            />
            <FieldError :errors="[descriptionError]" />
          </Field>

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
            <Spinner v-if="isPending" data-icon="inline-start" />
            Gruppe gründen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

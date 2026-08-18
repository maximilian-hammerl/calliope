<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { getListGroupsQueryKey, useCreateGroup } from '@/api/groups/groups'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/formatNumber'
import { listKeyPrefix } from '@/lib/queryKeys'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const queryClient = useQueryClient()

const title = ref<string>('')
const description = ref<string>('')
const visibility = ref<'private' | 'public'>('private')
// Not columns on writing_group yet. Present because members asked that founding a group force
// the standardising metadata, but nothing is sent or stored.
const genre = ref<string>('')
const perspective = ref<string>('')

// Taken from the design system's own dialog rather than invented, so they already match what
// the column will hold once perspective is stored.
const PERSPECTIVES = [
  '1. Person, Gegenwart',
  '1. Person, Vergangenheit',
  '3. Person, Gegenwart',
  '3. Person, Vergangenheit',
] as const

const LIMIT = TEXT_LIMIT.createGroup

const titleError = ref<string | undefined>(undefined)
const descriptionError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

const { mutateAsync: createGroup, isPending } = useCreateGroup()

watch(open, (isOpen) => {
  if (isOpen) {
    return
  }
  title.value = ''
  description.value = ''
  visibility.value = 'private'
  genre.value = ''
  perspective.value = ''
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

  if (description.value.trim().length > LIMIT.description.maxLength) {
    descriptionError.value = `Die Beschreibung darf höchstens ${formatCount(LIMIT.description.maxLength)} Zeichen lang sein.`
    return
  }

  let created
  try {
    created = await createGroup({
      data: {
        title: title.value.trim(),
        description: description.value.trim(),
        visibility: visibility.value,
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

          <Field>
            <FieldLabel for="group-genre">Genre</FieldLabel>
            <Input
              id="group-genre"
              v-model="genre"
              class="h-11 md:h-9"
              name="genre"
              placeholder="z. B. Fantasy, Mystery"
            />
            <FieldDescription>Wird noch nicht gespeichert.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel for="group-perspective">Perspektive</FieldLabel>
            <!-- A list rather than free text: "Perspektive" is the one field whose expected
                 answer a newcomer cannot guess, and the design system already fixes the four. -->
            <select
              id="group-perspective"
              v-model="perspective"
              name="perspective"
              class="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm md:h-9"
            >
              <option value="">Bitte wählen</option>
              <option v-for="option in PERSPECTIVES" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
            <FieldDescription>Wird noch nicht gespeichert.</FieldDescription>
          </Field>
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

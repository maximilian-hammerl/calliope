<script setup lang="ts">
/**
 * The board (§8). One view for both destinations: "entdecken" is everything still answerable,
 * `mine` is the member's own ideas regardless of status — closing one must not hide it from
 * its author.
 */
import { computed, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Plus } from '@lucide/vue'
import { useListStoryIdeas } from '@/api/story-ideas/story-ideas'
import type { ListStoryIdeas200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import AppLayout from '@/components/layout/AppLayout.vue'
import StoryIdeaDialog from '@/components/story-idea/StoryIdeaDialog.vue'
import StoryIdeaRow from '@/components/story-idea/StoryIdeaRow.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const props = defineProps<{ mine?: boolean }>()

const LIMIT = TEXT_LIMIT.listStoryIdeas.search

const term = ref<string>('')
const settled = ref<string>('')
const trimmed = computed<string>(() => term.value.trim())

watchDebounced(
  trimmed,
  (value) => {
    settled.value = value.length >= LIMIT.minLength ? value : ''
  },
  { debounce: 300 },
)

const { data, isPending, isError } = useListStoryIdeas(() => ({
  limit: 100,
  mine: props.mine === true,
  search: settled.value === '' ? undefined : settled.value,
}))

const ideas = computed<ListStoryIdeas200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const hasLoaded = computed<boolean>(() => data.value?.status === 200)

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <div class="mb-2 flex flex-wrap items-baseline gap-3">
          <h1 class="text-[25px] leading-[1.2] text-ink-1">
            {{ props.mine ? 'Meine Storyideen' : 'Storyideen entdecken' }}
          </h1>

          <div class="ml-auto">
            <Button
              variant="outline"
              size="sm"
              aria-label="Storyidee vorstellen"
              @click="creating = true"
            >
              <Plus data-icon="inline-start" :stroke-width="1.5" />
              Storyidee
            </Button>
          </div>
        </div>

        <p class="mb-6 max-w-[60ch] text-[13.5px] leading-[1.7] text-ink-4">
          <template v-if="props.mine">
            Deine Ideen, auch die abgeschlossenen. Ändere ihren Status, wenn sich etwas tut.
          </template>
          <template v-else>
            Ideen, die Mitschreibende suchen. Gefällt dir eine, sieh dir das Profil dazu an.
          </template>
        </p>

        <Field v-if="hasLoaded" class="mb-7 max-w-[380px]">
          <FieldLabel for="ideas-search">Suche</FieldLabel>
          <Input
            id="ideas-search"
            v-model="term"
            class="h-11 md:h-9"
            name="search"
            type="search"
            placeholder="z. B. Leuchtturm"
            :maxlength="LIMIT.maxLength"
            autocomplete="off"
            spellcheck="false"
          />
          <FieldDescription>
            Sucht in Titeln und Ideen, ab {{ LIMIT.minLength }} Zeichen.
          </FieldDescription>
        </Field>

        <p
          v-if="hasLoaded && ideas.length === 0"
          class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4"
        >
          <template v-if="settled !== ''">Keine Idee passt zu „{{ settled }}“.</template>
          <template v-else-if="props.mine"> Du hast noch keine Storyidee vorgestellt. </template>
          <template v-else>
            Im Moment sucht keine Idee nach Mitschreibenden. Stell deine vor.
          </template>
        </p>

        <div v-else-if="hasLoaded">
          <StoryIdeaRow
            v-for="(idea, index) in ideas"
            :key="idea.id"
            :idea="idea"
            :class="index > 0 ? 'border-t border-line-2' : 'pt-0'"
          />
        </div>

        <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Ideen werden geladen …</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Ideen lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>
      </div>
    </div>
  </AppLayout>

  <StoryIdeaDialog
    v-model:open="creating"
    @saved="(id) => $router.push({ name: 'storyIdea', params: { ideaId: id } })"
  />
</template>

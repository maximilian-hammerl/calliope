<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Check } from '@lucide/vue'
import { useListUsers } from '@/api/users/users'
import type { ListUsers200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * Search for a member by username and pick one. Both invitation flows use this — the group
 * dialog keeps the pick so a role can be chosen for it, the chat panel invites on the spot —
 * so it owns the field as well as the list: the keyboard wiring runs between the two, and
 * splitting them would make `aria-activedescendant` the caller's problem.
 */
const props = withDefaults(
  defineProps<{
    /** Ids to leave out, normally whoever is already a member. */
    excludeIds: string[]
    label?: string
    placeholder?: string
    disabled?: boolean
    /** False while the surrounding dialog or panel is closed, so nothing is fetched. */
    active?: boolean
  }>(),
  { label: undefined, placeholder: 'z. B. mira', disabled: false, active: true },
)

/** Its own, so two pickers can share a screen — the caller used to have to name them. */
const inputId = useId()

/** The committed pick. Left unbound by callers that act on `pick` immediately. */
const selected = defineModel<ListUsers200ResultsItem | undefined>({ default: undefined })

const emit = defineEmits<{ pick: [user: ListUsers200ResultsItem] }>()

const term = ref<string>('')
/** The keyboard cursor. -1 is no row, so a stray Enter cannot invite the wrong person. */
const activeIndex = ref<number>(-1)

/** The API's own bounds. Below the minimum nothing is asked for at all. */
const LIMIT = TEXT_LIMIT.listUsers.search

const trimmedTerm = computed<string>(() => term.value.trim())
const termIsLongEnough = computed<boolean>(() => trimmedTerm.value.length >= LIMIT.minLength)

const { data: usersData, isFetching } = useListUsers(
  () => ({ search: trimmedTerm.value, limit: 8 }),
  {
    query: {
      // Both guards matter: without a term the endpoint would return everyone, and a closed
      // dialog has no reason to be asking.
      enabled: () => props.active && termIsLongEnough.value,
      // A name does not change between keystrokes, so a repeated term is served from cache.
      staleTime: 30_000,
    },
  },
)

/**
 * People already in the group are dropped rather than shown as unavailable: an invitation
 * they cannot accept twice is not a useful thing to look at, and the list is short.
 */
const candidates = computed<ListUsers200ResultsItem[]>(() => {
  if (usersData.value?.status !== 200) {
    return []
  }
  return usersData.value.data.results.filter((user) => !props.excludeIds.includes(user.id))
})

// Typing again is a new search, so neither an earlier pick nor the keyboard cursor may
// silently survive it.
watch(trimmedTerm, () => {
  selected.value = undefined
  activeIndex.value = -1
})

function optionId(user: ListUsers200ResultsItem): string {
  return `${inputId}-option-${user.id}`
}

const activeOptionId = computed<string | undefined>(() => {
  const user = candidates.value[activeIndex.value]
  return user === undefined ? undefined : optionId(user)
})

function pick(user: ListUsers200ResultsItem) {
  selected.value = user
  emit('pick', user)
}

/** Wraps at both ends, which is what a short list wants. */
function move(step: number) {
  const { length } = candidates.value
  if (length === 0) {
    return
  }
  activeIndex.value = (activeIndex.value + step + length) % length
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    // Otherwise the caret jumps to the far end of the field instead.
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  const user = candidates.value[activeIndex.value]
  if (user === undefined) {
    return
  }
  // Only when a row is actually under the cursor, so Enter still submits the form otherwise.
  event.preventDefault()
  pick(user)
}

/** Cleared by the caller between openings, since the field belongs to this component. */
function reset() {
  term.value = ''
  activeIndex.value = -1
}

defineExpose({ reset })
</script>

<template>
  <div>
    <Field>
      <FieldLabel v-if="label" :for="inputId">{{ label }}</FieldLabel>
      <Input
        :id="inputId"
        v-model="term"
        name="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="candidates.length > 0"
        :aria-controls="`${inputId}-options`"
        :aria-activedescendant="activeOptionId"
        :maxlength="LIMIT.maxLength"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        @keydown="onKeydown"
      />
    </Field>

    <!-- Results are rows rather than a native menu: the set changes with every keystroke, and
         a menu would close over the field being typed into. -->
    <div class="mt-3 min-h-[44px]">
      <p v-if="!termIsLongEnough" class="text-control text-ink-5">
        Gib mindestens {{ LIMIT.minLength }} Zeichen ein. Ein Teil des Namens genügt.
      </p>
      <p v-else-if="isFetching" class="text-control text-ink-5">Wird gesucht …</p>
      <p v-else-if="candidates.length === 0" class="text-control text-ink-5">
        Niemand gefunden, der oder die nicht schon dabei ist.
      </p>

      <ul
        v-else
        :id="`${inputId}-options`"
        class="-mx-2 flex flex-col border-t border-line-3"
        role="listbox"
      >
        <li v-for="(user, index) in candidates" :key="user.id" role="presentation">
          <!-- Selection is the rule, as it is for thread tabs and the group rail; a fill here
               would read as disabled. The keyboard cursor shares the hover fill, so moving by
               arrow looks the same as moving by mouse. -->
          <button
            :id="optionId(user)"
            type="button"
            role="option"
            class="flex min-h-[44px] w-full items-center gap-2.5 border-b border-line-3 border-l-2 pr-2 pl-2.5 text-left text-[13.5px] hover:bg-paper-2 hover:text-ink-1 md:min-h-[38px]"
            :class="[
              // One border-left-color utility at a time: paired with a static
              // border-l-transparent, Tailwind's own emission order decides the winner
              // rather than this condition, and the rule silently never appears.
              selected?.id === user.id
                ? 'border-l-oak font-medium text-ink-1'
                : 'border-l-transparent text-ink-4',
              index === activeIndex ? 'bg-paper-2 text-ink-1' : '',
            ]"
            :aria-selected="selected?.id === user.id"
            :disabled="disabled"
            @click="pick(user)"
            @mousemove="activeIndex = index"
          >
            <UserAvatar :username="user.username" :avatar-url="user.avatarUrl" />
            <span class="min-w-0 truncate">{{ user.username }}</span>
            <Check
              v-if="selected?.id === user.id"
              class="ml-auto shrink-0 text-oak"
              :size="14"
              :stroke-width="1.5"
            />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

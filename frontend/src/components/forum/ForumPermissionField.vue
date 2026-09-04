<script setup lang="ts">
import { computed } from 'vue'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { forumPermissionChoices } from '@/lib/format/forum'
import type { ForumPermission, ForumPermissionKind } from '@/lib/format/forum'

/**
 * What members may do with one row of the forum, as three radios rather than a select: each option
 * carries a sentence, and a shut select would hide the one that matters.
 *
 * Its own component because two dialogs ask it — a folder's, where it sits beside the title, and
 * the leaf dialog, where it is the whole form. The wording cannot drift between them.
 *
 * The value is the row's **own** setting, never the reduced one: something above it may still be
 * closing it, and re-opening that folder has to restore what was chosen here.
 */
const props = defineProps<{ kind: ForumPermissionKind }>()

const permission = defineModel<ForumPermission>({ required: true })

const choices = computed<ReturnType<typeof forumPermissionChoices>>(() =>
  forumPermissionChoices(props.kind),
)
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-control font-medium text-ink-2">Was Mitglieder hier dürfen</legend>

    <RadioGroup v-model="permission" class="gap-0">
      <Label
        v-for="choice in choices"
        :key="choice.value"
        class="flex min-h-11 cursor-pointer items-start gap-3 py-1 font-normal md:min-h-0"
      >
        <RadioGroupItem :value="choice.value" class="mt-[3px]" />
        <span class="flex flex-col gap-0.5">
          <span class="text-body text-ink-2">{{ choice.label }}</span>
          <span class="text-note text-ink-5">{{ choice.note }}</span>
        </span>
      </Label>
    </RadioGroup>

    <slot name="warning" />
  </fieldset>
</template>

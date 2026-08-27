<script setup lang="ts">
/**
 * Choosing a picture, and the declaration that comes with it. The preview is the picture itself:
 * the server centre-crops the same way, so it shows what will actually be stored.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Camera } from '@lucide/vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { userInitial } from '@/lib/format/formatUser'
import { formatBytes } from '@/lib/format/formatNumber'
import {
  AVATAR_ORIGIN_LABELS,
  AVATAR_ORIGINS,
  AVATAR_TOO_LARGE,
  OWN_WORK,
} from '@/lib/format/avatar'
import { TEXT_LIMIT } from '@/api/textLimit'
import type { SetAvatarBodyOrigin } from '@/api/models'

const props = defineProps<{ username: string; currentUrl: string | null; disabled?: boolean }>()

const file = defineModel<File | undefined>('file', { required: true })
const origin = defineModel<SetAvatarBodyOrigin>('origin', { required: true })
const credit = defineModel<string>('credit', { required: true })
const confirmed = defineModel<boolean>('confirmed', { required: true })

/** Mirrors the server's allowlist; SVG is deliberately absent from both. */
const ACCEPT = 'image/jpeg,image/png,image/webp'

const chosenUrl = ref<string | undefined>(undefined)
const tooLarge = ref<string | undefined>(undefined)

function forgetPreview(): void {
  if (chosenUrl.value !== undefined) {
    URL.revokeObjectURL(chosenUrl.value)
    chosenUrl.value = undefined
  }
}

watch(file, (chosen) => {
  forgetPreview()
  chosenUrl.value = chosen === undefined ? undefined : URL.createObjectURL(chosen)
})

// Or a picture chosen and then abandoned is held for as long as the page lives.
onBeforeUnmount(forgetPreview)

const previewUrl = computed<string | null>(() => chosenUrl.value ?? props.currentUrl)

/**
 * Refused here rather than after the upload: the size is known before anything is sent, and a
 * phone should not spend four megabytes of somebody's data to be told no.
 */
function choose(event: Event): void {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]

  if (chosen !== undefined && chosen.size > TEXT_LIMIT.setAvatar.image.maxLength) {
    tooLarge.value = AVATAR_TOO_LARGE
    file.value = undefined
    input.value = ''
    return
  }

  tooLarge.value = undefined
  file.value = chosen
}
</script>

<template>
  <!-- `min-w-0` at every level: the file name below is `truncate`, so its min-content width is the
       whole string, and without this it pushes the dialog wider than the screen. -->
  <div class="flex min-w-0 flex-col gap-5">
    <div class="flex min-w-0 items-center gap-4">
      <Avatar class="size-16 shrink-0">
        <AvatarImage v-if="previewUrl" :src="previewUrl" alt="" />
        <AvatarFallback class="text-[22px]">{{ userInitial(username) }}</AvatarFallback>
      </Avatar>

      <div class="flex min-w-0 flex-col gap-1">
        <!-- A label rather than a button around a hidden input: clicking the label opens the
             picker, and a screen reader announces it as the file field it is. -->
        <Label
          class="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-line-5 bg-paper-3 px-3 text-control font-medium text-oak-deep hover:bg-paper-4 md:min-h-9"
        >
          <Camera :size="14" :stroke-width="1.5" aria-hidden="true" />
          {{ file === undefined ? 'Bild wählen' : 'Anderes Bild' }}
          <input
            class="sr-only"
            type="file"
            :accept="ACCEPT"
            :disabled="disabled"
            @change="choose"
          />
        </Label>

        <!-- `break-all`, not `truncate`: a nowrap name's min-content is the whole string, which
             pushed the dialog wider than a phone. Wrapping cannot do that. -->
        <p v-if="file" class="line-clamp-2 break-all text-note text-ink-5">
          {{ file.name }} · {{ formatBytes(file.size) }}
        </p>
        <p v-else-if="tooLarge" class="text-note text-destructive" role="alert">{{ tooLarge }}</p>
        <p v-else class="text-note text-ink-5">
          JPEG, PNG oder WebP, bis zu {{ formatBytes(TEXT_LIMIT.setAvatar.image.maxLength) }}.
        </p>
      </div>
    </div>

    <template v-if="file">
      <Field>
        <FieldLabel>Woher stammt das Bild?</FieldLabel>
        <RadioGroup v-model="origin" :disabled="disabled" class="gap-0">
          <Label
            v-for="value in AVATAR_ORIGINS"
            :key="value"
            class="flex min-h-11 cursor-pointer items-center gap-3 text-body font-normal md:min-h-9"
          >
            <RadioGroupItem :value="value" />
            {{ AVATAR_ORIGIN_LABELS[value] }}
          </Label>
        </RadioGroup>
      </Field>

      <!-- Only where it is owed. Asking everybody for a source is what turns a declaration into a
           field people type „meins" into. -->
      <Field v-if="origin !== OWN_WORK">
        <FieldLabel for="avatar-credit">Quelle, Urheber und Lizenz</FieldLabel>
        <Input
          id="avatar-credit"
          v-model="credit"
          name="credit"
          :maxlength="TEXT_LIMIT.setAvatar.credit.maxLength"
          :disabled="disabled"
          placeholder="z. B. Foto: Jane Doe, CC BY 4.0, example.org/foto"
        />
        <FieldDescription>So viel, wie die Lizenz verlangt.</FieldDescription>
      </Field>

      <Label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-body font-normal md:min-h-9"
      >
        <Checkbox v-model="confirmed" :disabled="disabled" />
        Ich bestätige, dass ich dieses Bild verwenden darf.
      </Label>
    </template>
  </div>
</template>
